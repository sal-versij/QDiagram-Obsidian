import { CircuitAst, CircuitOp, GateDef, Phase } from "./types";
import {
  BUILTIN_GATES,
  SINGLE_QUBIT_GATES,
  TWO_QUBIT_GATES,
  THREE_QUBIT_GATES
} from "./gate-registry";

type ChunkToken = {
  type: "chunk" | "comma" | "semi" | "lbrace" | "rbrace" | "newline";
  text?: string;
  line: number;
};

type AliasDecl = {
  line: number;
  index: number;
  name: string;
};

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

function tokenize(source: string): ChunkToken[] {
  const tokens: ChunkToken[] = [];
  let current = "";
  let currentLine = 1;
  let line = 1;

  const flush = (): void => {
    const text = current.trim();
    if (text.length > 0) {
      tokens.push({ type: "chunk", text, line: currentLine });
    }
    current = "";
  };

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];

    if (ch === "#") {
      while (i + 1 < source.length && source[i + 1] !== "\n") {
        i += 1;
      }
      continue;
    }

    if (ch === "\r") {
      continue;
    }

    if (ch === "\n") {
      flush();
      tokens.push({ type: "newline", line });
      line += 1;
      currentLine = line;
      continue;
    }

    if (ch === "," || ch === ";" || ch === "{" || ch === "}") {
      flush();
      if (ch === ",") {
        tokens.push({ type: "comma", line });
      } else if (ch === ";") {
        tokens.push({ type: "semi", line });
      } else if (ch === "{") {
        tokens.push({ type: "lbrace", line });
      } else {
        tokens.push({ type: "rbrace", line });
      }
      currentLine = line;
      continue;
    }

    if (current.length === 0) {
      currentLine = line;
    }
    current += ch;
  }

  flush();
  return tokens;
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

  if (SINGLE_QUBIT_GATES.has(gate)) {
    if (argRefs.length !== 1) {
      throw new Error(`Line ${line}: gate ${gate} expects one qubit target.`);
    }
    return { kind: "gate", line, name: gate, params, targetRefs: argRefs, conditional };
  }

  if (TWO_QUBIT_GATES.has(gate)) {
    if (argRefs.length !== 2) {
      throw new Error(`Line ${line}: gate ${gate} expects two qubit targets.`);
    }
    return { kind: "gate", line, name: gate, params, targetRefs: argRefs, conditional };
  }

  if (THREE_QUBIT_GATES.has(gate)) {
    if (argRefs.length !== 3) {
      throw new Error(`Line ${line}: gate ${gate} expects three qubit targets.`);
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

function substituteRef(ref: string, paramBindings: Map<string, string>): string {
  const mapped = paramBindings.get(ref);
  return mapped ?? ref;
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

function opTargets(op: CircuitOp): number[] {
  if (op.type === "gate") {
    return op.targets;
  }
  return [op.target];
}

function opOccupiedQubits(op: CircuitOp): number[] {
  const targets = opTargets(op);
  if (targets.length <= 1) {
    return targets;
  }

  const minQ = Math.min(...targets);
  const maxQ = Math.max(...targets);
  const occupied: number[] = [];
  for (let q = minQ; q <= maxQ; q += 1) {
    occupied.push(q);
  }
  return occupied;
}

function buildPhases(
  parsedOps: Array<{ op: CircuitOp; line: number; explicitGroupId?: number; occupiedQubits?: number[] }>
): Phase[] {
  const units: Array<{
    ops: CircuitOp[];
    opIndices: number[];
    forced: boolean;
    qubits: Set<number>;
    occupiedQubits: Set<number>;
    conditionals: string[];
  }> = [];

  let i = 0;
  while (i < parsedOps.length) {
    const item = parsedOps[i];
    if (item.explicitGroupId === undefined) {
      const op = item.op;
      const conditionals = op.type === "gate" && op.conditional ? [op.conditional] : [];
      units.push({
        ops: [op],
        opIndices: [i],
        forced: false,
        qubits: new Set(opTargets(op)),
        occupiedQubits: new Set(item.occupiedQubits ?? opOccupiedQubits(op)),
        conditionals
      });
      i += 1;
      continue;
    }

    const groupId = item.explicitGroupId;
    const groupedOps: CircuitOp[] = [];
    const groupedIndices: number[] = [];
    const groupedQubits = new Set<number>();
    const groupedOccupiedQubits = new Set<number>();
    const groupedConditionals = new Set<string>();

    while (i < parsedOps.length && parsedOps[i].explicitGroupId === groupId) {
      const grouped = parsedOps[i].op;
      groupedOps.push(grouped);
      groupedIndices.push(i);
      for (const q of opTargets(grouped)) {
        groupedQubits.add(q);
      }
      for (const q of parsedOps[i].occupiedQubits ?? opOccupiedQubits(grouped)) {
        groupedOccupiedQubits.add(q);
      }
      if (grouped.type === "gate" && grouped.conditional) {
        groupedConditionals.add(grouped.conditional);
      }
      i += 1;
    }

    units.push({
      ops: groupedOps,
      opIndices: groupedIndices,
      forced: true,
      qubits: groupedQubits,
      occupiedQubits: groupedOccupiedQubits,
      conditionals: Array.from(groupedConditionals)
    });
  }

  const phases: Phase[] = [];
  const phaseOccupiedQubits: Array<Set<number>> = [];
  const phaseLocked: boolean[] = [];
  const opToPhase = new Map<number, number>();
  const measureProducerOp = new Map<string, number>();
  const qubitLastPhase = new Map<number, number>();

  for (let opIndex = 0; opIndex < parsedOps.length; opIndex += 1) {
    const op = parsedOps[opIndex].op;
    if (op.type === "measure" && op.classical) {
      measureProducerOp.set(op.classical, opIndex);
    }
  }

  for (const unit of units) {
    let minPhase = 0;
    for (const q of unit.qubits) {
      const last = qubitLastPhase.get(q);
      if (last !== undefined) {
        minPhase = Math.max(minPhase, last);
      }
    }

    let selectedPhase = phases.length;
    for (let phaseIndex = minPhase; phaseIndex < phases.length; phaseIndex += 1) {
      if (phaseLocked[phaseIndex]) {
        continue;
      }

      const used = phaseOccupiedQubits[phaseIndex];
      let conflict = false;

      for (const q of unit.occupiedQubits) {
        if (used.has(q)) {
          conflict = true;
          break;
        }
      }

      if (conflict) {
        continue;
      }

      let hasClassicalConflict = false;
      for (const bit of unit.conditionals) {
        const producerOp = measureProducerOp.get(bit);
        if (producerOp === undefined) {
          continue;
        }
        const producerPhase = opToPhase.get(producerOp);
        if (producerPhase === undefined || producerPhase >= phaseIndex) {
          hasClassicalConflict = true;
          break;
        }
      }

      if (!hasClassicalConflict) {
        selectedPhase = phaseIndex;
        break;
      }
    }

    if (selectedPhase === phases.length) {
      phases.push([]);
      phaseOccupiedQubits.push(new Set<number>());
      phaseLocked.push(false);
    }

    const phase = phases[selectedPhase];
    for (const op of unit.ops) {
      phase.push(op);
    }
    for (const q of unit.occupiedQubits) {
      phaseOccupiedQubits[selectedPhase].add(q);
    }
    for (const q of unit.qubits) {
      qubitLastPhase.set(q, selectedPhase);
    }
    for (const opIdx of unit.opIndices) {
      opToPhase.set(opIdx, selectedPhase);
    }
    if (unit.forced) {
      phaseLocked[selectedPhase] = true;
    }
  }

  return phases;
}

export function parseCircuitDsl(source: string): CircuitAst {
  const tokens = tokenize(source);
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

  const resolvedQubits = qubits ?? (() => {
    let maxRef = -1;
    for (const item of parsedItems) {
      const op = item.op;
      const refs = op.kind === "gate" ? op.targetRefs : [op.targetRef];
      for (const ref of refs) {
        const numeric = ref.match(/^\d+$/) || ref.match(/^q(\d+)$/i);
        if (numeric) {
          const value = numeric.length === 1 ? parsePositiveInt(numeric[0], item.line, "qubit index") : parsePositiveInt(numeric[1], item.line, "qubit index");
          maxRef = Math.max(maxRef, value);
        }
      }
    }
    return Math.max(1, maxRef + 1);
  })();

  const aliasByIndex = new Map<number, string>();
  const aliasByName = new Map<string, number>();
  for (const alias of aliasDecls) {
    if (alias.index >= resolvedQubits) {
      throw new Error(`Line ${alias.line}: alias q${alias.index} exceeds declared ${resolvedQubits} qubits.`);
    }
    if (aliasByIndex.has(alias.index)) {
      throw new Error(`Line ${alias.line}: duplicate alias for q${alias.index}.`);
    }
    if (aliasByName.has(alias.name)) {
      throw new Error(`Line ${alias.line}: duplicate alias name '${alias.name}'.`);
    }
    const aliasUpper = alias.name.toUpperCase();
    if (BUILTIN_GATES.has(aliasUpper)) {
      throw new Error(`Line ${alias.line}: alias name '${alias.name}' conflicts with built-in gate.`);
    }
    if (gateDecls.has(aliasUpper)) {
      throw new Error(`Line ${alias.line}: alias name '${alias.name}' conflicts with custom gate.`);
    }
    aliasByIndex.set(alias.index, alias.name);
    aliasByName.set(alias.name, alias.index);
  }

  const resolvedOps: Array<{ op: CircuitOp; line: number; explicitGroupId?: number; occupiedQubits?: number[] }> = [];
  const declaredClassicalBits = new Set<string>();
  const macroExpansions: Array<{ name: string; startOpIndex: number; endOpIndex: number }> = [];
  const macroStack: string[] = [];

  const expandMacro = (
    def: InternalGateDef,
    call: TempGate,
    callLine: number,
    explicitGroupId?: number,
    inheritedOccupiedQubits?: number[]
  ): void => {
    if (!def.body) {
      return;
    }
    if (macroStack.includes(def.name)) {
      throw new Error(`Line ${callLine}: recursive macro expansion detected for '${def.name}'.`);
    }

    const bindings = new Map<string, string>();
    for (let idx = 0; idx < def.params.length; idx += 1) {
      bindings.set(def.params[idx], call.targetRefs[idx]);
    }

    const resolvedCallTargets = call.targetRefs.map((ref) =>
      resolveQubitRef(ref, aliasByName, resolvedQubits, callLine)
    );
    let macroOccupiedQubits: number[] | undefined = inheritedOccupiedQubits;
    if (!macroOccupiedQubits && resolvedCallTargets.length > 1) {
      const minQ = Math.min(...resolvedCallTargets);
      const maxQ = Math.max(...resolvedCallTargets);
      macroOccupiedQubits = [];
      for (let q = minQ; q <= maxQ; q += 1) {
        macroOccupiedQubits.push(q);
      }
    }

    macroStack.push(def.name);
    try {
      for (const bodyOp of def.body) {
        if (bodyOp.kind === "measure") {
          const target = resolveQubitRef(
            substituteRef(bodyOp.targetRef, bindings),
            aliasByName,
            resolvedQubits,
            callLine
          );
          if (bodyOp.classical) {
            declaredClassicalBits.add(bodyOp.classical);
          }
          resolvedOps.push({
            line: callLine,
            explicitGroupId,
            occupiedQubits: macroOccupiedQubits,
            op: { type: "measure", target, classical: bodyOp.classical }
          });
          continue;
        }

        if (bodyOp.kind === "reset") {
          const target = resolveQubitRef(
            substituteRef(bodyOp.targetRef, bindings),
            aliasByName,
            resolvedQubits,
            callLine
          );
          resolvedOps.push({
            line: callLine,
            explicitGroupId,
            occupiedQubits: macroOccupiedQubits,
            op: { type: "reset", target }
          });
          continue;
        }

        const expandedTargets = bodyOp.targetRefs.map((ref) =>
          resolveQubitRef(substituteRef(ref, bindings), aliasByName, resolvedQubits, callLine)
        );
        const effectiveConditional = bodyOp.conditional ?? call.conditional;
        if (effectiveConditional && !declaredClassicalBits.has(effectiveConditional)) {
          throw new Error(`Line ${callLine}: classical bit '${effectiveConditional}' not declared.`);
        }

        if (BUILTIN_GATES.has(bodyOp.name)) {
          resolvedOps.push({
            line: callLine,
            explicitGroupId,
            occupiedQubits: macroOccupiedQubits,
            op: {
              type: "gate",
              name: bodyOp.name,
              targets: expandedTargets,
              params: bodyOp.params,
              conditional: effectiveConditional
            }
          });
          continue;
        }

        const nested = gateDecls.get(bodyOp.name);
        if (!nested) {
          throw new Error(`Line ${callLine}: unknown operation '${bodyOp.name}'.`);
        }
        if (expandedTargets.length !== nested.params.length) {
          throw new Error(
            `Line ${callLine}: gate ${nested.name} expects ${nested.params.length} qubit targets.`
          );
        }

        const nestedCall: TempGate = {
          kind: "gate",
          line: callLine,
          name: nested.name,
          params: bodyOp.params,
          targetRefs: bodyOp.targetRefs.map((ref) => substituteRef(ref, bindings)),
          conditional: effectiveConditional
        };

        if (nested.type === "blackbox" || nested.type === "cgate") {
          resolvedOps.push({
            line: callLine,
            explicitGroupId,
            occupiedQubits: macroOccupiedQubits,
            op: {
              type: "gate",
              name: nested.name,
              targets: nestedCall.targetRefs.map((ref) => resolveQubitRef(ref, aliasByName, resolvedQubits, callLine)),
              params: nestedCall.params,
              conditional: nestedCall.conditional,
              isCustom: true,
              isControlledCustom: nested.type === "cgate"
            }
          });
        } else {
          expandMacro(nested, nestedCall, callLine, explicitGroupId, macroOccupiedQubits);
        }
      }
    } finally {
      macroStack.pop();
    }
  };

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
          `Line ${item.line}: gate ${custom.name} expects ${custom.params.length} qubit targets.`
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
        expandMacro(custom, op, item.line, item.explicitGroupId);
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
