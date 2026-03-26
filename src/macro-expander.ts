import { BUILTIN_GATES } from "./gate-registry";
import { CircuitOp } from "./types";

export type MacroBodyGateOp = {
  kind: "gate";
  name: string;
  params: string[];
  targetRefs: string[];
  conditional?: string;
};

export type MacroBodyMeasureOp = {
  kind: "measure";
  targetRef: string;
  classical?: string;
};

export type MacroBodyResetOp = {
  kind: "reset";
  targetRef: string;
};

export type MacroBodyOp = MacroBodyGateOp | MacroBodyMeasureOp | MacroBodyResetOp;

export type MacroGateDef = {
  name: string;
  params: string[];
  type: "macro" | "blackbox" | "cgate";
  body?: MacroBodyOp[];
};

export type MacroCallGate = {
  kind: "gate";
  name: string;
  params: string[];
  targetRefs: string[];
  conditional?: string;
};

export type ResolvedOpRecord = {
  op: CircuitOp;
  line: number;
  explicitGroupId?: number;
  occupiedQubits?: number[];
};

function substituteRef(ref: string, paramBindings: Map<string, string>): string {
  const mapped = paramBindings.get(ref);
  return mapped ?? ref;
}

export function expandMacroCall(args: {
  def: MacroGateDef;
  call: MacroCallGate;
  callLine: number;
  explicitGroupId?: number;
  inheritedOccupiedQubits?: number[];
  gateDecls: Map<string, MacroGateDef>;
  aliasByName: Map<string, number>;
  resolvedQubits: number;
  declaredClassicalBits: Set<string>;
  resolvedOps: ResolvedOpRecord[];
  macroStack: string[];
  resolveQubitRef: (ref: string, aliasesByName: Map<string, number>, qubits: number, line: number) => number;
}): void {
  const {
    def,
    call,
    callLine,
    explicitGroupId,
    inheritedOccupiedQubits,
    gateDecls,
    aliasByName,
    resolvedQubits,
    declaredClassicalBits,
    resolvedOps,
    macroStack,
    resolveQubitRef
  } = args;

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

      const nestedCall: MacroCallGate = {
        kind: "gate",
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
            targets: nestedCall.targetRefs.map((ref) =>
              resolveQubitRef(ref, aliasByName, resolvedQubits, callLine)
            ),
            params: nestedCall.params,
            conditional: nestedCall.conditional,
            isCustom: true,
            isControlledCustom: nested.type === "cgate"
          }
        });
      } else {
        expandMacroCall({
          def: nested,
          call: nestedCall,
          callLine,
          explicitGroupId,
          inheritedOccupiedQubits: macroOccupiedQubits,
          gateDecls,
          aliasByName,
          resolvedQubits,
          declaredClassicalBits,
          resolvedOps,
          macroStack,
          resolveQubitRef
        });
      }
    }
  } finally {
    macroStack.pop();
  }
}
