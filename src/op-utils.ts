import { CircuitOp } from "./types";

export function opTargets(op: CircuitOp): number[] {
  if (op.type === "gate") {
    return op.targets;
  }
  return [op.target];
}

export function opOccupiedQubits(op: CircuitOp): number[] {
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

export function opTouchedQubits(op: CircuitOp): number[] {
  return opTargets(op);
}
