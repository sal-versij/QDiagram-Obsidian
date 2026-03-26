export type GateOp = {
  type: "gate";
  name: string;
  targets: number[];
  params?: string[];
  conditional?: string;
  isCustom?: boolean;
};

export type MeasureOp = {
  type: "measure";
  target: number;
  classical?: string;
};

export type ResetOp = {
  type: "reset";
  target: number;
};

export type CircuitOp = GateOp | MeasureOp | ResetOp;

export type Phase = CircuitOp[];

export type GateDef = {
  type: "macro" | "blackbox";
  params: string[];
  body?: Phase[];
  metadata?: {
    description?: string;
  };
};

export type CircuitAst = {
  qubits: number;
  qubitAliases?: Map<number, string>;
  gateDefs?: Map<string, GateDef>;
  phases: Phase[];
  ops: CircuitOp[];
};

export function flattenPhasesToOps(phases: Phase[]): CircuitOp[] {
  return phases.flat();
}
