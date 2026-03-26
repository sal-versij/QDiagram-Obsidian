import { customGateWidth, Layout, wireY } from "./circuit-layout";
import { CircuitOp, GateOp } from "./types";

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
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

export function renderOperation(op: CircuitOp, phaseCenterX: number, layout: Layout): string {
  if (op.type === "measure") {
    return renderMeasure(op.target, phaseCenterX, layout);
  }
  if (op.type === "reset") {
    return renderReset(op.target, phaseCenterX, layout);
  }

  if (op.isControlledCustom) {
    return renderControlledCustom(op, phaseCenterX, layout);
  }

  if (op.isCustom) {
    return renderCustomGate(op, phaseCenterX, layout);
  }

  if (op.targets.length === 1) {
    return renderSingleGate(op, phaseCenterX, wireY(op.targets[0], layout), layout);
  }

  if (op.name === "CNOT" || op.name === "CX" || op.name === "CZ") {
    return renderControlled(op, phaseCenterX, layout);
  }

  if (op.name === "SWAP") {
    return renderSwap(op, phaseCenterX, layout);
  }

  if (op.name === "TOFFOLI" || op.name === "CCX") {
    const [c1, c2, target] = op.targets;
    const y1 = wireY(c1, layout);
    const y2 = wireY(c2, layout);
    const y3 = wireY(target, layout);
    const top = Math.min(y1, y2, y3);
    const bottom = Math.max(y1, y2, y3);
    return [
      `<line x1="${phaseCenterX}" y1="${top}" x2="${phaseCenterX}" y2="${bottom}" stroke="var(--text-normal)" />`,
      `<circle cx="${phaseCenterX}" cy="${y1}" r="5" fill="var(--text-normal)" />`,
      `<circle cx="${phaseCenterX}" cy="${y2}" r="5" fill="var(--text-normal)" />`,
      `<circle cx="${phaseCenterX}" cy="${y3}" r="10" fill="none" stroke="var(--text-normal)" />`,
      `<line x1="${phaseCenterX - 8}" y1="${y3}" x2="${phaseCenterX + 8}" y2="${y3}" stroke="var(--text-normal)" />`,
      `<line x1="${phaseCenterX}" y1="${y3 - 8}" x2="${phaseCenterX}" y2="${y3 + 8}" stroke="var(--text-normal)" />`
    ].join("");
  }

  // Fallback for unsupported multi-qubit gates.
  return renderSingleGate(
    { type: "gate", name: op.name, targets: [op.targets[0]], params: op.params },
    phaseCenterX,
    wireY(op.targets[0], layout),
    layout
  );
}
