import { Layout, phaseX, wireY } from "./layout";
import { CircuitAst, GateOp } from "../shared/types";

function gateAnchorY(op: GateOp, layout: Layout): number {
  if (op.targets.length <= 1) {
    return wireY(op.targets[0], layout);
  }
  const top = wireY(Math.min(...op.targets), layout) - layout.gateHeight / 2;
  const bottom = wireY(Math.max(...op.targets), layout) + layout.gateHeight / 2;
  return (top + bottom) / 2;
}

function renderMeasurementWrite(fromX: number, fromY: number, laneX: number, toY: number): string {
  const midY = fromY + 8;
  const route = `M ${fromX} ${fromY} L ${laneX} ${midY} V ${toY}`;
  const headSize = 4;
  const direction = toY >= midY ? 1 : -1;
  const head = [
    `M ${laneX - headSize} ${toY - direction * headSize}`,
    `L ${laneX} ${toY}`,
    `L ${laneX + headSize} ${toY - direction * headSize}`
  ].join(" ");

  return [
    `<path class="quantum-classical-write" d="${route}" fill="none" stroke="var(--text-muted)" stroke-width="1.6" stroke-linecap="round" />`,
    `<path class="quantum-classical-write-head" d="${head}" fill="none" stroke="var(--text-muted)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />`
  ].join("");
}

function renderClassicalControl(fromX: number, fromY: number, toX: number, toY: number): string {
  return [
    `<line class="quantum-classical-control-link" x1="${fromX}" y1="${fromY}" x2="${toX}" y2="${toY}" stroke="var(--text-muted)" stroke-width="1.6" stroke-dasharray="5 3" />`,
    `<circle class="quantum-classical-control-dot" cx="${fromX}" cy="${fromY}" r="4" fill="var(--text-normal)" />`
  ].join("");
}

export function collectClassicalRouting(
  ast: CircuitAst,
  layout: Layout,
  classicalWireY: (bit: number) => number
): { overlayEls: string[]; firstMeasureXByQubit: Map<number, number> } {
  const overlayEls: string[] = [];
  const firstMeasureXByQubit = new Map<number, number>();

  for (let phaseIdx = 0; phaseIdx < ast.phases.length; phaseIdx += 1) {
    const phase = ast.phases[phaseIdx];
    const phaseCenterX = phaseX(phaseIdx, layout);
    let measureIdx = 0;

    for (const op of phase) {
      if (op.type === "measure") {
        const measureX = phaseCenterX;
        const measureY = wireY(op.target, layout);
        const bitY = classicalWireY(op.classicalTarget);
        // Measurements are now isolated in their own phases, so write lines go straight down
        overlayEls.push(renderMeasurementWrite(measureX, measureY + 10, measureX, bitY));
        measureIdx += 1;

        const existing = firstMeasureXByQubit.get(op.target);
        if (existing === undefined || phaseCenterX < existing) {
          firstMeasureXByQubit.set(op.target, phaseCenterX);
        }
      }

      if (op.type === "gate" && op.conditionalBit !== undefined) {
        const fromX = phaseCenterX;
        const fromY = classicalWireY(op.conditionalBit);
        const toX = phaseCenterX;
        const toY = gateAnchorY(op, layout);
        overlayEls.push(renderClassicalControl(fromX, fromY, toX, toY));
      }
    }
  }

  return { overlayEls, firstMeasureXByQubit };
}
