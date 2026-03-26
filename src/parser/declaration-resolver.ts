import { BUILTIN_GATES } from "../shared/gate-registry";

export type AliasDecl = {
  line: number;
  index: number;
  name: string;
};

export type ClassicalAliasDecl = {
  line: number;
  index: number;
  name: string;
};

type TempOpLike =
  | {
      kind: "gate";
      targetRefs: string[];
      conditionalRef?: string;
    }
  | {
      kind: "measure";
      targetRef: string;
      classicalTargetRef: string;
    }
  | {
      kind: "reset";
      targetRef: string;
    };

export type ParsedItemLike = {
  line: number;
  op: TempOpLike;
};

function parsePositiveInt(value: string, line: number, label: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Line ${line}: invalid ${label} '${value}'.`);
  }
  return parsed;
}

export function resolveQubitsAndAliases(params: {
  qubits?: number;
  parsedItems: ParsedItemLike[];
  aliasDecls: AliasDecl[];
  customGateNames: Set<string>;
}): {
  resolvedQubits: number;
  aliasByIndex: Map<number, string>;
  aliasByName: Map<string, number>;
} {
  const { qubits, parsedItems, aliasDecls, customGateNames } = params;

  const resolvedQubits =
    qubits ??
    (() => {
      let maxRef = -1;
      for (const item of parsedItems) {
        const op = item.op;
        const refs = op.kind === "gate" ? op.targetRefs : [op.targetRef];
        for (const ref of refs) {
          const numeric = ref.match(/^\d+$/) || ref.match(/^q(\d+)$/i);
          if (numeric) {
            const value =
              numeric.length === 1
                ? parsePositiveInt(numeric[0], item.line, "qubit index")
                : parsePositiveInt(numeric[1], item.line, "qubit index");
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
    if (customGateNames.has(aliasUpper)) {
      throw new Error(`Line ${alias.line}: alias name '${alias.name}' conflicts with custom gate.`);
    }
    aliasByIndex.set(alias.index, alias.name);
    aliasByName.set(alias.name, alias.index);
  }

  return { resolvedQubits, aliasByIndex, aliasByName };
}

export function resolveClassicalBitsAndAliases(params: {
  classicalBits?: number;
  parsedItems: ParsedItemLike[];
  aliasDecls: ClassicalAliasDecl[];
  qubitAliasByName: Map<string, number>;
}): {
  resolvedClassicalBits: number;
  aliasByIndex: Map<number, string>;
  aliasByName: Map<string, number>;
} {
  const { classicalBits, parsedItems, aliasDecls, qubitAliasByName } = params;

  const resolvedClassicalBits =
    classicalBits ??
    (() => {
      let maxRef = -1;
      for (const item of parsedItems) {
        const refs: string[] = [];
        if (item.op.kind === "gate" && item.op.conditionalRef) {
          refs.push(item.op.conditionalRef);
        }
        if (item.op.kind === "measure") {
          refs.push(item.op.classicalTargetRef);
        }

        for (const ref of refs) {
          const numeric = ref.match(/^c(\d+)$/i) || ref.match(/^(\d+)$/);
          if (numeric) {
            const value = parsePositiveInt(numeric[1], item.line, "classical bit index");
            maxRef = Math.max(maxRef, value);
          }
        }
      }
      return Math.max(1, maxRef + 1);
    })();

  const aliasByIndex = new Map<number, string>();
  const aliasByName = new Map<string, number>();
  for (const alias of aliasDecls) {
    if (alias.index >= resolvedClassicalBits) {
      throw new Error(
        `Line ${alias.line}: alias c${alias.index} exceeds declared ${resolvedClassicalBits} classical bits.`
      );
    }
    if (aliasByIndex.has(alias.index)) {
      throw new Error(`Line ${alias.line}: duplicate alias for c${alias.index}.`);
    }
    if (aliasByName.has(alias.name)) {
      throw new Error(`Line ${alias.line}: duplicate classical alias name '${alias.name}'.`);
    }
    if (qubitAliasByName.has(alias.name)) {
      throw new Error(`Line ${alias.line}: alias name '${alias.name}' already used by a qubit alias.`);
    }
    aliasByIndex.set(alias.index, alias.name);
    aliasByName.set(alias.name, alias.index);
  }

  return { resolvedClassicalBits, aliasByIndex, aliasByName };
}
