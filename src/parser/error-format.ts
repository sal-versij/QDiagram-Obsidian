export function formatQubitTargetCount(count: number, style: "word" | "number" = "number"): string {
  if (style === "number") {
    return `${count} qubit target${count === 1 ? "" : "s"}`;
  }

  if (count === 1) {
    return "one qubit target";
  }
  if (count === 2) {
    return "two qubit targets";
  }
  if (count === 3) {
    return "three qubit targets";
  }
  return `${count} qubit targets`;
}
