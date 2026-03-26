import { CircuitAst, CircuitOp } from "./types";
import {
  Layout,
  DEFAULT_LAYOUT,
  estimateTextWidth,
  wireY,
  phaseX
} from "./circuit-layout";
import { collectClassicalRouting } from "./classical-router";
import { renderOperation } from "./gate-renderer";
import { opTouchedQubits } from "./op-utils";

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

type MacroInterval = {
  name: string;
  startPhase: number;
  endPhase: number;
  minQubit: number;
  maxQubit: number;
  lane: number;
};

function assignMacroLanes(
  intervals: Array<{ name: string; startPhase: number; endPhase: number; minQubit: number; maxQubit: number }>
): MacroInterval[] {
  const sorted = [...intervals].sort((a, b) => {
    if (a.startPhase !== b.startPhase) return a.startPhase - b.startPhase;
    return a.endPhase - b.endPhase;
  });
  const laneLast: Array<{ endPhase: number; minQubit: number; maxQubit: number } | undefined> = [];
  const withLanes: MacroInterval[] = [];

  for (const interval of sorted) {
    let lane = 0;
    while (lane < laneLast.length) {
      const state = laneLast[lane];
      if (!state) {
        break;
      }
      const phaseOverlap = state.endPhase >= interval.startPhase;
      const qubitOverlap = !(interval.maxQubit < state.minQubit || interval.minQubit > state.maxQubit);
      if (!(phaseOverlap && qubitOverlap)) {
        break;
      }
      lane += 1;
    }
    if (lane === laneLast.length) {
      laneLast.push({ endPhase: interval.endPhase, minQubit: interval.minQubit, maxQubit: interval.maxQubit });
    } else {
      laneLast[lane] = { endPhase: interval.endPhase, minQubit: interval.minQubit, maxQubit: interval.maxQubit };
    }
    withLanes.push({ ...interval, lane });
  }

  return withLanes;
}

function renderMacroContainer(
  interval: MacroInterval,
  laneCount: number,
  layout: Layout
): { box: string; labelBg: string; label: string } {
  const x1 = phaseX(interval.startPhase, layout) - layout.colGap * 0.42;
  const x2 = phaseX(interval.endPhase, layout) + layout.colGap * 0.42;
  const laneStep = 12;
  const verticalPad = 5;
  const topTouchedY = wireY(interval.minQubit, layout) - layout.gateHeight / 2 - verticalPad;
  const y = Math.max(6, topTouchedY - interval.lane * laneStep);
  const bottomTouchedY = wireY(interval.maxQubit, layout) + layout.gateHeight / 2 + verticalPad;
  const h = Math.max(18, bottomTouchedY - y);
  const w = x2 - x1;
  const labelY = Math.max(9, y + 2);
  const labelW = estimateTextWidth(interval.name, 10) + 8;
  const labelBgX = x1 + 7;
  const labelBgY = labelY - 9;

  return {
    box: `<rect class="quantum-macro-container" x="${x1}" y="${y}" width="${w}" height="${h}" rx="10" ry="10" fill="none" stroke="var(--text-muted)" stroke-width="1.2" opacity="0.55" />`,
    labelBg: `<rect class="quantum-macro-container-label-bg" x="${labelBgX}" y="${labelBgY}" width="${labelW}" height="11" rx="3" ry="3" fill="var(--background-primary)" opacity="0.98" />`,
    label: `<text class="quantum-macro-container-label" x="${x1 + 10}" y="${labelY}" text-anchor="start" font-size="10" fill="var(--text-muted)">${esc(interval.name)}</text>`
  };
}

export function renderCircuitSvg(ast: CircuitAst): string {
  const labels = Array.from({ length: ast.qubits }, (_, q) => ast.qubitAliases?.get(q) ?? `q${q}`);
  const longestLabel = labels.reduce((max, label) => Math.max(max, label.length), 2);
  const labelAreaWidth = Math.max(32, estimateTextWidth("W".repeat(longestLabel), 11) + 16);

  const opToPhase = new Map<CircuitOp, number>();
  for (let phaseIdx = 0; phaseIdx < ast.phases.length; phaseIdx += 1) {
    const phase = ast.phases[phaseIdx];
    for (const op of phase) {
      opToPhase.set(op, phaseIdx);
    }
  }

  const macroIntervals = assignMacroLanes(
    (ast.macroExpansions ?? [])
      .map((expansion) => {
        const startOp = ast.ops[expansion.startOpIndex];
        const endOp = ast.ops[expansion.endOpIndex];
        const startPhase = startOp ? opToPhase.get(startOp) : undefined;
        const endPhase = endOp ? opToPhase.get(endOp) : undefined;
        if (startPhase === undefined || endPhase === undefined) {
          return undefined;
        }
        const touchedQubits: number[] = [];
        for (let opIndex = expansion.startOpIndex; opIndex <= expansion.endOpIndex; opIndex += 1) {
          const op = ast.ops[opIndex];
          if (!op) {
            continue;
          }
          touchedQubits.push(...opTouchedQubits(op));
        }
        if (touchedQubits.length === 0) {
          return undefined;
        }

        return {
          name: expansion.name,
          startPhase,
          endPhase,
          minQubit: Math.min(...touchedQubits),
          maxQubit: Math.max(...touchedQubits)
        };
      })
      .filter(
        (item): item is { name: string; startPhase: number; endPhase: number; minQubit: number; maxQubit: number } =>
          item !== undefined
      )
  );
  const macroLaneCount = macroIntervals.length > 0 ? Math.max(...macroIntervals.map((m) => m.lane)) + 1 : 0;

  const layout: Layout = {
    ...DEFAULT_LAYOUT,
    leftPadding: Math.max(DEFAULT_LAYOUT.leftPadding, labelAreaWidth + 20),
    topPadding: macroLaneCount > 0 ? DEFAULT_LAYOUT.topPadding + macroLaneCount * 10 + 4 : DEFAULT_LAYOUT.topPadding
  };
  const width = layout.leftPadding + (ast.phases.length + 2) * layout.colGap;
  const height = layout.topPadding * 2 + (ast.qubits - 1) * layout.rowGap;

  const { pipeEls, firstMeasureXByQubit } = collectClassicalRouting(ast, layout);

  const wireEls: string[] = [];
  const labelEls: string[] = [];
  const wireStartX = labelAreaWidth + 8;
  for (let q = 0; q < ast.qubits; q += 1) {
    const y = wireY(q, layout);
    const measureX = firstMeasureXByQubit.get(q);
    const wireEndX = measureX !== undefined ? measureX + 14 : width - 20;
    wireEls.push(`<line class="quantum-wire" x1="${wireStartX}" y1="${y}" x2="${wireEndX}" y2="${y}" stroke="var(--text-muted)" />`);

    // Use alias if available, otherwise use qN
    let label = `q${q}`;
    if (ast.qubitAliases && ast.qubitAliases.has(q)) {
      label = ast.qubitAliases.get(q) || label;
    }
    const textWidth = estimateTextWidth(label, 11);
    const textX = wireStartX - 10;
    const bgX = textX - textWidth - 4;
    labelEls.push(`<rect class="quantum-wire-label-bg" x="${bgX}" y="${y - 9}" width="${textWidth + 8}" height="16" fill="var(--background-primary)" />`);
    labelEls.push(`<text class="quantum-wire-label" x="${textX}" y="${y + 4}" text-anchor="end" font-size="11" fill="var(--text-muted)">${esc(label)}</text>`);
  }

  // Render operations grouped by phase
  const opEls: string[] = [];
  for (let phaseIdx = 0; phaseIdx < ast.phases.length; phaseIdx += 1) {
    const phase = ast.phases[phaseIdx];
    const phaseCenterX = phaseX(phaseIdx, layout);
    for (let opInPhase = 0; opInPhase < phase.length; opInPhase += 1) {
      const op = phase[opInPhase];
      opEls.push(renderOperation(op, phaseCenterX, layout));
    }
  }

  const macroRendered = macroIntervals.map((interval) => renderMacroContainer(interval, macroLaneCount, layout));
  const macroBoxEls = macroRendered.map((item) => item.box);
  const macroLabelBgEls = macroRendered.map((item) => item.labelBg);
  const macroLabelEls = macroRendered.map((item) => item.label);

  return [
    `<svg class="quantum-circuit-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Quantum circuit with ${ast.qubits} qubits and ${ast.phases.length} phases">`,
    ...wireEls,
    ...labelEls,
    ...macroBoxEls,
    ...pipeEls,
    ...opEls,
    ...macroLabelBgEls,
    ...macroLabelEls,
    "</svg>"
  ].join("");
}
