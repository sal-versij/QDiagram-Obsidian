import { CircuitAst, CircuitOp, GateOp } from "./types";

type Layout = {
  leftPadding: number;
  topPadding: number;
  rowGap: number;
  colGap: number;
  gateWidth: number;
  gateHeight: number;
};

const DEFAULT_LAYOUT: Layout = {
  leftPadding: 40,
  topPadding: 30,
  rowGap: 56,
  colGap: 84,
  gateWidth: 44,
  gateHeight: 30
};

function estimateTextWidth(text: string, fontSize = 11): number {
  return Math.max(0, text.length * (fontSize * 0.62));
}

function customGateWidth(label: string, layout: Layout): number {
  const estimated = estimateTextWidth(label, 11) + 20;
  const minWidth = layout.gateWidth;
  const maxWidth = layout.colGap * 1.6;
  return Math.max(minWidth, Math.min(maxWidth, estimated));
}

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function wireY(index: number, layout: Layout): number {
  return layout.topPadding + index * layout.rowGap;
}

function phaseX(phaseIndex: number, layout: Layout): number {
  return layout.leftPadding + (phaseIndex + 1) * layout.colGap;
}

function renderSingleGate(op: GateOp, x: number, y: number, layout: Layout): string {
  const label = op.params && op.params.length > 0 ? `${op.name}(${op.params.join(",")})` : op.name;
  const rectX = x - layout.gateWidth / 2;
  const rectY = y - layout.gateHeight / 2;

  return [
    `<rect x="${rectX}" y="${rectY}" width="${layout.gateWidth}" height="${layout.gateHeight}" rx="5" ry="5" fill="var(--background-primary)" stroke="var(--text-normal)" />`,
    `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="12" fill="var(--text-normal)">${esc(label)}</text>`
  ].join("");
}

function renderControlled(op: GateOp, x: number, layout: Layout): string {
  const [control, target] = op.targets;
  const y1 = wireY(control, layout);
  const y2 = wireY(target, layout);
  const top = Math.min(y1, y2);
  const height = Math.abs(y1 - y2);

  const targetShape =
    op.name === "CZ"
      ? `<circle cx="${x}" cy="${y2}" r="10" fill="var(--background-primary)" stroke="var(--text-normal)" /><text x="${x}" y="${y2 + 4}" text-anchor="middle" font-size="11" fill="var(--text-normal)">Z</text>`
      : `<circle cx="${x}" cy="${y2}" r="10" fill="none" stroke="var(--text-normal)" /><line x1="${x - 8}" y1="${y2}" x2="${x + 8}" y2="${y2}" stroke="var(--text-normal)" /><line x1="${x}" y1="${y2 - 8}" x2="${x}" y2="${y2 + 8}" stroke="var(--text-normal)" />`;

  return [
    `<line x1="${x}" y1="${top}" x2="${x}" y2="${top + height}" stroke="var(--text-normal)" />`,
    `<circle cx="${x}" cy="${y1}" r="5" fill="var(--text-normal)" />`,
    targetShape
  ].join("");
}

function renderControlledCustom(op: GateOp, x: number, layout: Layout): string {
  const [control, target] = op.targets;
  const y1 = wireY(control, layout);
  const y2 = wireY(target, layout);
  const top = Math.min(y1, y2);
  const height = Math.abs(y1 - y2);
  const width = customGateWidth(op.name, layout);
  const rectX = x - width / 2;
  const rectY = y2 - layout.gateHeight / 2;

  return [
    `<line x1="${x}" y1="${top}" x2="${x}" y2="${top + height}" stroke="var(--text-normal)" />`,
    `<circle cx="${x}" cy="${y1}" r="5" fill="var(--text-normal)" />`,
    `<rect class="quantum-custom-gate" x="${rectX}" y="${rectY}" width="${width}" height="${layout.gateHeight}" rx="5" ry="5" fill="var(--background-primary)" stroke="var(--text-normal)" />`,
    `<text x="${x}" y="${y2 + 4}" text-anchor="middle" font-size="11" fill="var(--text-normal)">${esc(op.name)}</text>`
  ].join("");
}

function renderSwap(op: GateOp, x: number, layout: Layout): string {
  const [a, b] = op.targets;
  const y1 = wireY(a, layout);
  const y2 = wireY(b, layout);
  const top = Math.min(y1, y2);
  const height = Math.abs(y1 - y2);

  const swapX = (y: number): string => [
    `<line x1="${x - 7}" y1="${y - 7}" x2="${x + 7}" y2="${y + 7}" stroke="var(--text-normal)" />`,
    `<line x1="${x - 7}" y1="${y + 7}" x2="${x + 7}" y2="${y - 7}" stroke="var(--text-normal)" />`
  ].join("");

  return [
    `<line x1="${x}" y1="${top}" x2="${x}" y2="${top + height}" stroke="var(--text-normal)" />`,
    swapX(y1),
    swapX(y2)
  ].join("");
}

function renderCustomGate(op: GateOp, x: number, layout: Layout): string {
  const width = customGateWidth(op.name, layout);
  if (op.targets.length === 1) {
    const y = wireY(op.targets[0], layout);
    const rectX = x - width / 2;
    const rectY = y - layout.gateHeight / 2;
    return [
      `<rect class="quantum-custom-gate" x="${rectX}" y="${rectY}" width="${width}" height="${layout.gateHeight}" rx="5" ry="5" fill="var(--background-primary)" stroke="var(--text-normal)" />`,
      `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="11" fill="var(--text-normal)">${esc(op.name)}</text>`
    ].join("");
  }

  const minTarget = Math.min(...op.targets);
  const maxTarget = Math.max(...op.targets);
  const topY = wireY(minTarget, layout) - layout.gateHeight / 2;
  const bottomY = wireY(maxTarget, layout) + layout.gateHeight / 2;
  const rectX = x - width / 2;
  const height = bottomY - topY;

  return [
    `<rect class="quantum-custom-gate" x="${rectX}" y="${topY}" width="${width}" height="${height}" rx="5" ry="5" fill="var(--background-primary)" stroke="var(--text-normal)" />`,
    `<text x="${x}" y="${(topY + bottomY) / 2 + 4}" text-anchor="middle" font-size="11" fill="var(--text-normal)">${esc(op.name)}</text>`
  ].join("");
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

function opTouchedQubits(op: CircuitOp): number[] {
  if (op.type === "gate") {
    return op.targets;
  }
  return [op.target];
}

function renderMeasure(target: number, x: number, layout: Layout): string {
  const y = wireY(target, layout);
  const rectX = x - 14;
  const rectY = y - 12;
  const dialCx = x;
  const dialCy = y + 1;

  return [
    `<rect x="${rectX}" y="${rectY}" width="28" height="24" rx="4" ry="4" fill="var(--background-primary)" stroke="var(--text-normal)" />`,
    `<path class="quantum-measure-icon" d="M ${dialCx - 8} ${dialCy + 5} A 8 8 0 0 1 ${dialCx + 8} ${dialCy + 5}" fill="none" stroke="var(--text-normal)" stroke-width="1.4" />`,
    `<line class="quantum-measure-icon" x1="${dialCx}" y1="${dialCy + 5}" x2="${dialCx + 5}" y2="${dialCy + 1}" stroke="var(--text-normal)" stroke-width="1.4" />`,
    `<circle class="quantum-measure-icon" cx="${dialCx}" cy="${dialCy + 5}" r="1.3" fill="var(--text-normal)" />`
  ].join("");
}

function renderReset(target: number, x: number, layout: Layout): string {
  const y = wireY(target, layout);
  const rectX = x - 16;
  const rectY = y - 12;

  return [
    `<rect x="${rectX}" y="${rectY}" width="32" height="24" rx="4" ry="4" fill="var(--background-primary)" stroke="var(--text-normal)" />`,
    `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="10" fill="var(--text-normal)">RST</text>`
  ].join("");
}

function renderClassicalPipe(fromX: number, fromY: number, toX: number, toY: number): string {
  // Single split route: horizontal from measurement output, then vertical into gate boundary.
  const route = `M ${fromX} ${fromY} H ${toX} V ${toY}`;
  return [
    `<path class="quantum-classical-pipe" d="${route}" fill="none" stroke="var(--text-muted)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />`,
    `<path class="quantum-classical-pipe-inner" d="${route}" fill="none" stroke="var(--background-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`
  ].join("");
}

function renderOp(op: CircuitOp, phaseX: number, layout: Layout): string {
  const x = phaseX;

  if (op.type === "measure") {
    return renderMeasure(op.target, x, layout);
  }
  if (op.type === "reset") {
    return renderReset(op.target, x, layout);
  }

  if (op.isControlledCustom) {
    return renderControlledCustom(op, x, layout);
  }

  if (op.isCustom) {
    return renderCustomGate(op, x, layout);
  }

  if (op.targets.length === 1) {
    return renderSingleGate(op, x, wireY(op.targets[0], layout), layout);
  }

  if (op.name === "CNOT" || op.name === "CX" || op.name === "CZ") {
    return renderControlled(op, x, layout);
  }

  if (op.name === "SWAP") {
    return renderSwap(op, x, layout);
  }

  if (op.name === "TOFFOLI" || op.name === "CCX") {
    const [c1, c2, target] = op.targets;
    const y1 = wireY(c1, layout);
    const y2 = wireY(c2, layout);
    const y3 = wireY(target, layout);
    const top = Math.min(y1, y2, y3);
    const bottom = Math.max(y1, y2, y3);
    return [
      `<line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}" stroke="var(--text-normal)" />`,
      `<circle cx="${x}" cy="${y1}" r="5" fill="var(--text-normal)" />`,
      `<circle cx="${x}" cy="${y2}" r="5" fill="var(--text-normal)" />`,
      `<circle cx="${x}" cy="${y3}" r="10" fill="none" stroke="var(--text-normal)" />`,
      `<line x1="${x - 8}" y1="${y3}" x2="${x + 8}" y2="${y3}" stroke="var(--text-normal)" />`,
      `<line x1="${x}" y1="${y3 - 8}" x2="${x}" y2="${y3 + 8}" stroke="var(--text-normal)" />`
    ].join("");
  }

  // Fallback for unsupported multi-qubit gates.
  return renderSingleGate(
    { type: "gate", name: op.name, targets: [op.targets[0]], params: op.params },
    x,
    wireY(op.targets[0], layout),
    layout
  );
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

  // Build map of classical bit names to measurement geometry and per-op phase positions.
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

  // Collect classical pipes for rendering before gates
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
          const gateTop = op.targets.length > 1
            ? wireY(Math.min(...op.targets), layout) - layout.gateHeight / 2
            : wireY(op.targets[0], layout) - layout.gateHeight / 2;
          const gateBottom = op.targets.length > 1
            ? wireY(Math.max(...op.targets), layout) + layout.gateHeight / 2
            : wireY(op.targets[0], layout) + layout.gateHeight / 2;
          const gateAnchorY = measureInfo.y <= (gateTop + gateBottom) / 2 ? gateTop : gateBottom;

          pipeEls.push(
            renderClassicalPipe(
              measureInfo.x + 14,
              measureInfo.y,
              gateX,
              gateAnchorY
            )
          );
        }
      }
      flatOpIndex += 1;
    }
  }

  // Render operations grouped by phase
  const opEls: string[] = [];
  for (let phaseIdx = 0; phaseIdx < ast.phases.length; phaseIdx += 1) {
    const phase = ast.phases[phaseIdx];
    const phaseCenterX = phaseX(phaseIdx, layout);
    for (let opInPhase = 0; opInPhase < phase.length; opInPhase += 1) {
      const op = phase[opInPhase];
      opEls.push(renderOp(op, phaseCenterX, layout));
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
