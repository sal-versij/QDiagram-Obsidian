import { CircuitAst, GateDef } from "./types";
import {
  BUILTIN_GATES,
  getBuiltinGateArity
} from "./gate-registry";
import { buildPhases } from "./phase-scheduler";
import { expandMacroCall, ResolvedOpRecord } from "./macro-expander";
import { tokenize } from "./dsl-tokenizer";
import { AliasDecl, resolveQubitsAndAliases } from "./declaration-resolver";
import { formatQubitTargetCount } from "./error-format";

type TempGate = {
  kind: "gate";
  line: number;
  name: string;
  params: string[];
  targetRefs: string[];
  conditional?: string;
};

type TempMeasure = {
  kind: "measure";
  line: number;
  targetRef: string;
  classical?: string;
};

type TempReset = {
  kind: "reset";
  line: number;
  targetRef: string;
};

type TempOp = TempGate | TempMeasure | TempReset;

type ParsedItem = {
  line: number;
  op: TempOp;
  explicitGroupId?: number;
};

type InternalGateDef = {
  name: string;
  params: string[];
  type: "macro" | "blackbox" | "cgate";
  body?: TempOp[];
};

function parsePositiveInt(value: string, line: number, label: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Line ${line}: invalid ${label} '${value}'.`);
  }
  return parsed;
}

function parseGateToken(token: string): { gate: string; params: string[] } {
  const withParams = token.match(/^([A-Za-z][A-Za-z0-9_]*)\((.*)\)$/);
  if (!withParams) {
    return { gate: token.toUpperCase(), params: [] };
  }

  const [, gateRaw, paramsRaw] = withParams;
  const params = paramsRaw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return { gate: gateRaw.toUpperCase(), params };
}

function parseAliasDecl(statement: string, line: number): AliasDecl {
  const match = statement.match(/^alias\s+q(\d+)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)$/i);
  if (!match) {
    throw new Error(`Line ${line}: invalid alias declaration '${statement}'.`);
  }
  return {
    line,
    index: parsePositiveInt(match[1], line, "alias index"),
    name: match[2]
  };
}

function parseInlineAliasList(aliasSource: string, line: number): AliasDecl[] {
  const specs = aliasSource
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const aliases: AliasDecl[] = [];
  for (const spec of specs) {
    const match = spec.match(/^q(\d+)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)$/i);
    if (!match) {
      throw new Error(`Line ${line}: invalid inline alias '${spec}'.`);
    }
    aliases.push({
      line,
      index: parsePositiveInt(match[1], line, "alias index"),
      name: match[2]
    });
  }
  return aliases;
}

function parseOperation(statement: string, line: number): TempOp {
  const measureMatch = statement.match(/^(MEASURE|M)\s+([^\s]+)(?:\s*->\s*([A-Za-z_][A-Za-z0-9_]*))?$/i);
  if (measureMatch) {
    return {
      kind: "measure",
      line,
      targetRef: measureMatch[2],
      classical: measureMatch[3]
    };
  }

  const resetMatch = statement.match(/^RESET\s+([^\s]+)$/i);
  if (resetMatch) {
    return {
      kind: "reset",
      line,
      targetRef: resetMatch[1]
    };
  }

  let conditional: string | undefined;
  const conditionalMatch = statement.match(/\[\s*([A-Za-z_][A-Za-z0-9_]*)\s*\]\s*$/);
  if (conditionalMatch) {
    conditional = conditionalMatch[1];
    statement = statement.slice(0, conditionalMatch.index).trim();
  }

  const parts = statement.split(/\s+/).filter((part) => part.length > 0);
  if (parts.length === 0) {
    throw new Error(`Line ${line}: empty operation.`);
  }

  const { gate, params } = parseGateToken(parts[0]);
  const argRefs = parts.slice(1);

  const arity = getBuiltinGateArity(gate);
  if (arity !== undefined) {
    if (argRefs.length !== arity) {
      throw new Error(`Line ${line}: gate ${gate} expects ${formatQubitTargetCount(arity, "word")}.`);
    }
    return { kind: "gate", line, name: gate, params, targetRefs: argRefs, conditional };
  }

  // Defer unknown gate validation to the resolution phase where custom gate defs are available.
  return { kind: "gate", line, name: gate, params, targetRefs: argRefs, conditional };
}

function parseIdentifierList(raw: string, line: number): string[] {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const values = trimmed.split(",").map((part) => part.trim());
  const seen = new Set<string>();
  for (const value of values) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
      throw new Error(`Line ${line}: invalid identifier '${value}' in gate definition.`);
    }
    if (seen.has(value)) {
      throw new Error(`Line ${line}: duplicate parameter '${value}' in gate definition.`);
    }
    seen.add(value);
  }
  return values;
}

function parseGateDefinition(statement: string, line: number): InternalGateDef {
  const cgateMatch = statement.match(/^CGATE\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*$/i);
  if (cgateMatch) {
    const [, rawName, rawParams] = cgateMatch;
    const name = rawName.toUpperCase();
    const params = parseIdentifierList(rawParams, line);
    if (params.length !== 2) {
      throw new Error(`Line ${line}: CGATE ${name} expects exactly 2 parameters.`);
    }
    return { name, params, type: "cgate" };
  }

  const gateMatch = statement.match(/^GATE\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*(?:=\s*(.*))?$/i);
  if (!gateMatch) {
    throw new Error(`Line ${line}: invalid gate definition syntax.`);
  }

  const [, rawName, rawParams, rawBody] = gateMatch;
  const name = rawName.toUpperCase();
  const params = parseIdentifierList(rawParams, line);

  if (!rawBody || rawBody.trim().length === 0) {
    return { name, params, type: "blackbox" };
  }

  const bodyStatements = rawBody
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (bodyStatements.length === 0) {
    throw new Error(`Line ${line}: macro gate body cannot be empty.`);
  }

  const body = bodyStatements.map((stmt) => parseOperation(stmt, line));
  return { name, params, type: "macro", body };
}

function resolveQubitRef(ref: string, aliasesByName: Map<string, number>, qubits: number, line: number): number {
  if (/^\d+$/.test(ref)) {
    const target = parsePositiveInt(ref, line, "qubit index");
    if (target >= qubits) {
      throw new Error(`Line ${line}: target q${target} is out of range for ${qubits} qubits.`);
    }
    return target;
  }

  const qStyle = ref.match(/^q(\d+)$/i);
  if (qStyle) {
    const target = parsePositiveInt(qStyle[1], line, "qubit index");
    if (target >= qubits) {
      throw new Error(`Line ${line}: target q${target} is out of range for ${qubits} qubits.`);
    }
    return target;
  }

  const aliasTarget = aliasesByName.get(ref);
  if (aliasTarget === undefined) {
    throw new Error(`Line ${line}: unknown qubit reference '${ref}'.`);
  }
  return aliasTarget;
}

class CircuitBuilder {
  constructor(private readonly source: string) {}

  build(): CircuitAst {
  const tokens = tokenize(this.source);
  let qubits: number | undefined;

  const aliasDecls: AliasDecl[] = [];
  const parsedItems: ParsedItem[] = [];
  const gateDecls = new Map<string, InternalGateDef>();

  let inBraces = false;
  let braceGroupId: number | undefined;
  let commaGroupId: number | undefined;
  let nextGroupId = 1;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];

    if (token.type === "newline" || token.type === "semi") {
      if (!inBraces) {
        commaGroupId = undefined;
      }
      continue;
    }

    if (token.type === "lbrace") {
      if (inBraces) {
        throw new Error(`Line ${token.line}: nested braces are not supported.`);
      }
      inBraces = true;
      braceGroupId = nextGroupId;
      nextGroupId += 1;
      commaGroupId = undefined;
      continue;
    }

    if (token.type === "rbrace") {
      if (!inBraces) {
        throw new Error(`Line ${token.line}: unmatched '}'.`);
      }
      inBraces = false;
      braceGroupId = undefined;
      commaGroupId = undefined;
      continue;
    }

    if (token.type === "comma") {
      continue;
    }

    const statement = (token.text || "").trim();
    if (statement.length === 0) {
      continue;
    }

    if (/^(gate|cgate)\b/i.test(statement)) {
      if (inBraces || commaGroupId !== undefined) {
        throw new Error(`Line ${token.line}: gate definition cannot appear inside an operation group.`);
      }

      let fullGateStatement = statement;
      let consumeIndex = i + 1;
      while (
        consumeIndex < tokens.length &&
        tokens[consumeIndex].line === token.line &&
        tokens[consumeIndex].type !== "newline"
      ) {
        const next = tokens[consumeIndex];
        if (next.type === "chunk") {
          fullGateStatement += ` ${next.text || ""}`;
        } else if (next.type === "comma") {
          fullGateStatement += ",";
        } else if (next.type === "semi") {
          fullGateStatement += ";";
        } else if (next.type === "lbrace") {
          fullGateStatement += "{";
        } else if (next.type === "rbrace") {
          fullGateStatement += "}";
        }
        consumeIndex += 1;
      }

      const def = parseGateDefinition(fullGateStatement, token.line);
      if (BUILTIN_GATES.has(def.name)) {
        throw new Error(`Line ${token.line}: cannot redefine built-in gate '${def.name}'.`);
      }
      gateDecls.set(def.name, def);
      i = consumeIndex - 1;
      continue;
    }

    if (inBraces && /^\s*(qubits|alias)\b/i.test(statement)) {
      throw new Error(`Line ${token.line}: declarations are not allowed inside explicit groups.`);
    }

    const qubitsMatch = statement.match(/^qubits\s+(\d+)(?:\s*:\s*(.+))?$/i);
    if (qubitsMatch) {
      if (inBraces || commaGroupId !== undefined) {
        throw new Error(`Line ${token.line}: 'qubits' cannot appear inside an operation group.`);
      }
      if (qubits !== undefined) {
        throw new Error(`Line ${token.line}: qubits already declared.`);
      }
      const count = parsePositiveInt(qubitsMatch[1], token.line, "qubit count");
      if (count <= 0) {
        throw new Error(`Line ${token.line}: qubits must be greater than zero.`);
      }
      qubits = count;

      let inlineAliasSource = qubitsMatch[2] ? qubitsMatch[2].trim() : "";
      let consumeIndex = i + 1;
      while (
        consumeIndex + 1 < tokens.length &&
        tokens[consumeIndex].type === "comma" &&
        tokens[consumeIndex + 1].type === "chunk" &&
        tokens[consumeIndex].line === token.line &&
        tokens[consumeIndex + 1].line === token.line
      ) {
        const nextChunk = tokens[consumeIndex + 1].text || "";
        inlineAliasSource = inlineAliasSource.length > 0 ? `${inlineAliasSource}, ${nextChunk}` : nextChunk;
        consumeIndex += 2;
      }

      if (inlineAliasSource.length > 0) {
        aliasDecls.push(...parseInlineAliasList(inlineAliasSource, token.line));
      }

      i = consumeIndex - 1;
      continue;
    }

    if (/^alias\b/i.test(statement)) {
      if (commaGroupId !== undefined) {
        throw new Error(`Line ${token.line}: alias declaration cannot be comma-grouped.`);
      }
      aliasDecls.push(parseAliasDecl(statement, token.line));
      continue;
    }

    const op = parseOperation(statement, token.line);
    let explicitGroupId: number | undefined;
    if (inBraces) {
      explicitGroupId = braceGroupId;
    } else {
      const nextToken = tokens[i + 1];
      if (nextToken && nextToken.type === "comma") {
        if (commaGroupId === undefined) {
          commaGroupId = nextGroupId;
          nextGroupId += 1;
        }
      }
      explicitGroupId = commaGroupId;
      if (!nextToken || nextToken.type !== "comma") {
        commaGroupId = undefined;
      }
    }

    parsedItems.push({ line: token.line, op, explicitGroupId });
  }

  if (inBraces) {
    const lastLine = tokens.length > 0 ? tokens[tokens.length - 1].line : 1;
    throw new Error(`Line ${lastLine}: missing closing '}'.`);
  }

  const { resolvedQubits, aliasByIndex, aliasByName } = resolveQubitsAndAliases({
    qubits,
    parsedItems,
    aliasDecls,
    customGateNames: new Set(gateDecls.keys())
  });

  const resolvedOps: ResolvedOpRecord[] = [];
  const declaredClassicalBits = new Set<string>();
  const macroExpansions: Array<{ name: string; startOpIndex: number; endOpIndex: number }> = [];
  const macroStack: string[] = [];

  for (const item of parsedItems) {
    const op = item.op;
    if (op.kind === "gate") {
      if (op.conditional && !declaredClassicalBits.has(op.conditional)) {
        throw new Error(`Line ${item.line}: classical bit '${op.conditional}' not declared.`);
      }

      if (BUILTIN_GATES.has(op.name)) {
        const targets = op.targetRefs.map((ref) =>
          resolveQubitRef(ref, aliasByName, resolvedQubits, item.line)
        );
        resolvedOps.push({
          line: item.line,
          explicitGroupId: item.explicitGroupId,
          op: {
            type: "gate",
            name: op.name,
            targets,
            params: op.params,
            conditional: op.conditional
          }
        });
        continue;
      }

      const custom = gateDecls.get(op.name);
      if (!custom) {
        throw new Error(`Line ${item.line}: unknown operation '${op.name}'.`);
      }
      if (op.targetRefs.length !== custom.params.length) {
        throw new Error(
          `Line ${item.line}: gate ${custom.name} expects ${formatQubitTargetCount(custom.params.length, "number")}.`
        );
      }

      if (custom.type === "blackbox" || custom.type === "cgate") {
        const targets = op.targetRefs.map((ref) =>
          resolveQubitRef(ref, aliasByName, resolvedQubits, item.line)
        );
        resolvedOps.push({
          line: item.line,
          explicitGroupId: item.explicitGroupId,
          op: {
            type: "gate",
            name: custom.name,
            targets,
            params: op.params,
            conditional: op.conditional,
            isCustom: true,
            isControlledCustom: custom.type === "cgate"
          }
        });
      } else {
        const startOpIndex = resolvedOps.length;
        expandMacroCall({
          def: custom,
          call: op,
          callLine: item.line,
          explicitGroupId: item.explicitGroupId,
          gateDecls,
          aliasByName,
          resolvedQubits,
          declaredClassicalBits,
          resolvedOps,
          macroStack,
          resolveQubitRef
        });
        const endOpIndex = resolvedOps.length - 1;
        if (endOpIndex >= startOpIndex) {
          macroExpansions.push({
            name: custom.name,
            startOpIndex,
            endOpIndex
          });
        }
      }
      continue;
    }

    if (op.kind === "measure") {
      const target = resolveQubitRef(op.targetRef, aliasByName, resolvedQubits, item.line);
      if (op.classical) {
        declaredClassicalBits.add(op.classical);
      }
      resolvedOps.push({
        line: item.line,
        explicitGroupId: item.explicitGroupId,
        op: { type: "measure", target, classical: op.classical }
      });
      continue;
    }

    const target = resolveQubitRef(op.targetRef, aliasByName, resolvedQubits, item.line);
    resolvedOps.push({
      line: item.line,
      explicitGroupId: item.explicitGroupId,
      op: { type: "reset", target }
    });
  }

  const phases = buildPhases(resolvedOps);
  const ops = resolvedOps.map((item) => item.op);

  const ast: CircuitAst = {
    qubits: resolvedQubits,
    phases,
    ops
  };

  if (aliasByIndex.size > 0) {
    ast.qubitAliases = aliasByIndex;
  }

  if (gateDecls.size > 0) {
    const defs = new Map<string, GateDef>();
    gateDecls.forEach((def, name) => {
      defs.set(name, {
        type: def.type,
        params: def.params
      });
    });
    ast.gateDefs = defs;
  }

  if (macroExpansions.length > 0) {
    ast.macroExpansions = macroExpansions;
  }

    return ast;
  }
}

export function parseCircuitDsl(source: string): CircuitAst {
  return new CircuitBuilder(source).build();
}
