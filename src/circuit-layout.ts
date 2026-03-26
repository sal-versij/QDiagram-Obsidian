export type Layout = {
  leftPadding: number;
  topPadding: number;
  rowGap: number;
  colGap: number;
  gateWidth: number;
  gateHeight: number;
};

export const DEFAULT_LAYOUT: Layout = {
  leftPadding: 40,
  topPadding: 30,
  rowGap: 56,
  colGap: 84,
  gateWidth: 44,
  gateHeight: 30
};

export function estimateTextWidth(text: string, fontSize = 11): number {
  return Math.max(0, text.length * (fontSize * 0.62));
}

export function customGateWidth(label: string, layout: Layout): number {
  const estimated = estimateTextWidth(label, 11) + 20;
  const minWidth = layout.gateWidth;
  const maxWidth = layout.colGap * 1.6;
  return Math.max(minWidth, Math.min(maxWidth, estimated));
}

export function wireY(index: number, layout: Layout): number {
  return layout.topPadding + index * layout.rowGap;
}

export function phaseX(phaseIndex: number, layout: Layout): number {
  return layout.leftPadding + (phaseIndex + 1) * layout.colGap;
}
