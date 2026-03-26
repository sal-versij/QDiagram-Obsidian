export type GateOp = {
  type: "gate";
  name: string;
  targets: number[];
  params?: string[];
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

export type CircuitAst = {
  qubits: number;
  ops: CircuitOp[];
};
