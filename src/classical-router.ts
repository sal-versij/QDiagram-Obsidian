import { Layout, phaseX, wireY } from "./circuit-layout";
import { CircuitAst } from "./types";

function renderClassicalPipe(fromX: number, fromY: number, toX: number, toY: number): string {
  // Single split route: horizontal from measurement output, then vertical into gate boundary.
  const route = `M ${fromX} ${fromY} H ${toX} V ${toY}`;
  return [
    `<path class="quantum-classical-pipe" d="${route}" fill="none" stroke="var(--text-muted)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />`,
    `<path class="quantum-classical-pipe-inner" d="${route}" fill="none" stroke="var(--background-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`
  ].join("");
}

export function collectClassicalRouting(
  ast: CircuitAst,
  layout: Layout
): { pipeEls: string[]; firstMeasureXByQubit: Map<number, number> } {
  const classicalBitMap = new Map<string, { opIndex: number; phaseIndex: number; target: number; x: number; y: number }>();
  const opIndexToX = new Map<number, number>();
  const firstMeasureXByQubit = new Map<number, number>();

  let flatOpIndex = 0;
  for (let phaseIdx = 0; phaseIdx < ast.phases.length; phaseIdx += 1) {
    const phase = ast.phases[phaseIdx];
    const phaseCenterX = phaseX(phaseIdx, layout);
    for (let opInPhase = 0; opInPhase < phase.length; opInPhase += 1) {
      const op = phase[opInPhase];
      opIndexToX.set(flatOpIndex, phaseCenterX);
      if (op.type === "measure" && op.classical) {
        classicalBitMap.set(op.classical, {
          opIndex: flatOpIndex,
          phaseIndex: phaseIdx,
          target: op.target,
          x: phaseCenterX,
          y: wireY(op.target, layout)
        });
      }
      if (op.type === "measure") {
        const existing = firstMeasureXByQubit.get(op.target);
        if (existing === undefined || phaseCenterX < existing) {
          firstMeasureXByQubit.set(op.target, phaseCenterX);
        }
      }
      flatOpIndex += 1;
    }
  }

  const pipeEls: string[] = [];
  flatOpIndex = 0;
  for (let phaseIdx = 0; phaseIdx < ast.phases.length; phaseIdx += 1) {
    const phase = ast.phases[phaseIdx];
    for (let opInPhase = 0; opInPhase < phase.length; opInPhase += 1) {
      const op = phase[opInPhase];
      if (op.type === "gate" && op.conditional) {
        const measureInfo = classicalBitMap.get(op.conditional);
        if (measureInfo) {
          const gateX = opIndexToX.get(flatOpIndex) ?? phaseX(phaseIdx, layout);
          const gateTop =
            op.targets.length > 1
              ? wireY(Math.min(...op.targets), layout) - layout.gateHeight / 2
              : wireY(op.targets[0], layout) - layout.gateHeight / 2;
          const gateBottom =
            op.targets.length > 1
              ? wireY(Math.max(...op.targets), layout) + layout.gateHeight / 2
              : wireY(op.targets[0], layout) + layout.gateHeight / 2;
          const gateAnchorY = measureInfo.y <= (gateTop + gateBottom) / 2 ? gateTop : gateBottom;

          pipeEls.push(renderClassicalPipe(measureInfo.x + 14, measureInfo.y, gateX, gateAnchorY));
        }
      }
      flatOpIndex += 1;
    }
  }

  return { pipeEls, firstMeasureXByQubit };
}
