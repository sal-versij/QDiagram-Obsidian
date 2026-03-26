import { CircuitOp, Phase } from "../shared/types";
import { opOccupiedQubits, opTargets } from "../shared/op-utils";

export type ScheduledOpInput = {
  op: CircuitOp;
  line: number;
  explicitGroupId?: number;
  occupiedQubits?: number[];
};

export function buildPhases(parsedOps: ScheduledOpInput[]): Phase[] {
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
