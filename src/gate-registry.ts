export const SINGLE_QUBIT_GATES = new Set(["H", "X", "Y", "Z", "S", "T", "RX", "RY", "RZ"]);

export const TWO_QUBIT_GATES = new Set(["CNOT", "CX", "CZ", "SWAP"]);

export const THREE_QUBIT_GATES = new Set(["TOFFOLI", "CCX"]);

export const BUILTIN_GATES = new Set([
  ...Array.from(SINGLE_QUBIT_GATES),
  ...Array.from(TWO_QUBIT_GATES),
  ...Array.from(THREE_QUBIT_GATES)
]);

export function getBuiltinGateArity(gate: string): number | undefined {
  if (SINGLE_QUBIT_GATES.has(gate)) {
    return 1;
  }
  if (TWO_QUBIT_GATES.has(gate)) {
    return 2;
  }
  if (THREE_QUBIT_GATES.has(gate)) {
    return 3;
  }
  return undefined;
}

export function isBuiltinGate(gate: string): boolean {
  return BUILTIN_GATES.has(gate);
}
