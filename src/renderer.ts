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
  if (op.targets.length === 1) {
    return renderSingleGate(op, x, wireY(op.targets[0], layout), layout);
  }

  const minTarget = Math.min(...op.targets);
  const maxTarget = Math.max(...op.targets);
  const topY = wireY(minTarget, layout) - layout.gateHeight / 2;
  const bottomY = wireY(maxTarget, layout) + layout.gateHeight / 2;
  const rectX = x - layout.gateWidth / 2;
  const height = bottomY - topY;

  return [
    `<rect x="${rectX}" y="${topY}" width="${layout.gateWidth}" height="${height}" rx="5" ry="5" fill="var(--background-primary)" stroke="var(--text-normal)" />`,
    `<text x="${x}" y="${(topY + bottomY) / 2 + 4}" text-anchor="middle" font-size="11" fill="var(--text-normal)">${esc(op.name)}</text>`
  ].join("");
}

function renderMeasure(target: number, x: number, layout: Layout): string {
  const y = wireY(target, layout);
  const rectX = x - 14;
  const rectY = y - 12;

  return [
    `<rect x="${rectX}" y="${rectY}" width="28" height="24" rx="4" ry="4" fill="var(--background-primary)" stroke="var(--text-normal)" />`,
    `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="11" fill="var(--text-normal)">M</text>`
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

function renderClassicalPipe(
  fromPhaseIndex: number,
  toPhaseIndex: number,
  classicalBitIndex: number,
  layout: Layout
): string {
  const x1 = phaseX(fromPhaseIndex, layout);
  const x2 = phaseX(toPhaseIndex, layout);
  const y = wireY(classicalBitIndex, layout) + layout.rowGap / 2 + 8; // below the qubit wires

  // Two parallel dashed lines for classical bit pipe
  const offset = 3;
  return [
    `<line x1="${x1}" y1="${y - offset}" x2="${x2}" y2="${y - offset}" stroke="var(--text-muted)" stroke-dasharray="4,2" stroke-width="1.5" />`,
    `<line x1="${x1}" y1="${y + offset}" x2="${x2}" y2="${y + offset}" stroke="var(--text-muted)" stroke-dasharray="4,2" stroke-width="1.5" />`
  ].join("");
}

function renderOp(op: CircuitOp, phaseX: number, phaseOpsCount: number, opIndexInPhase: number, layout: Layout): string {
  // Calculate vertical offset for ops within the phase
  const opOffset = (opIndexInPhase - (phaseOpsCount - 1) / 2) * 8;
  const x = phaseX + opOffset;

  if (op.type === "measure") {
    return renderMeasure(op.target, x, layout);
  }
  if (op.type === "reset") {
    return renderReset(op.target, x, layout);
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
  const layout = DEFAULT_LAYOUT;
  const width = layout.leftPadding + (ast.phases.length + 2) * layout.colGap;
  const height = layout.topPadding * 2 + (ast.qubits - 1) * layout.rowGap;

  // Build map of classical bit names to their operation sequence index and measurement phase
  const classicalBitMap = new Map<string, { opIndex: number; phaseIndex: number; target: number }>();
  let flatOpIndex = 0;
  for (let phaseIdx = 0; phaseIdx < ast.phases.length; phaseIdx += 1) {
    const phase = ast.phases[phaseIdx];
    for (let opInPhase = 0; opInPhase < phase.length; opInPhase += 1) {
      const op = phase[opInPhase];
      if (op.type === "measure" && op.classical) {
        classicalBitMap.set(op.classical, { opIndex: flatOpIndex, phaseIndex: phaseIdx, target: op.target });
      }
      flatOpIndex += 1;
    }
  }

  const wireEls: string[] = [];
  for (let q = 0; q < ast.qubits; q += 1) {
    const y = wireY(q, layout);
    wireEls.push(`<line x1="20" y1="${y}" x2="${width - 20}" y2="${y}" stroke="var(--text-muted)" />`);

    // Use alias if available, otherwise use qN
    let label = `q${q}`;
    if (ast.qubitAliases && ast.qubitAliases.has(q)) {
      label = ast.qubitAliases.get(q) || label;
    }
    wireEls.push(`<text x="8" y="${y + 4}" font-size="11" fill="var(--text-muted)">${esc(label)}</text>`);
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
          pipeEls.push(renderClassicalPipe(measureInfo.phaseIndex, phaseIdx, measureInfo.target, layout));
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
      opEls.push(renderOp(op, phaseCenterX, phase.length, opInPhase, layout));
    }
  }

  return [
    `<svg class="quantum-circuit-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Quantum circuit with ${ast.qubits} qubits and ${ast.phases.length} phases">`,
    ...wireEls,
    ...pipeEls,
    ...opEls,
    "</svg>"
  ].join("");
}
