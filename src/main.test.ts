import { describe, expect, it } from "vitest";
import { parseCircuitDsl } from "./parser";

describe("parseCircuitDsl", () => {
  it("parses a minimal circuit", () => {
    const ast = parseCircuitDsl(["qubits 2", "H 0", "CNOT 0 1", "MEASURE 1 -> c0"].join("\n"));
    expect(ast.qubits).toBe(2);
    expect(ast.ops.length).toBe(3);
  });

  it("throws for unknown operations", () => {
    expect(() => parseCircuitDsl("qubits 1\nFOO 0")).toThrow();
  });

  it("parses a bell pair example", () => {
    const ast = parseCircuitDsl(
      ["qubits 2", "H 0", "CNOT 0 1", "MEASURE 0 -> c0", "MEASURE 1 -> c1"].join("\n")
    );
    expect(ast.qubits).toBe(2);
    expect(ast.ops.length).toBe(4);
  });

  it("parses a toffoli example", () => {
    const ast = parseCircuitDsl(["qubits 3", "H 0", "H 1", "TOFFOLI 0 1 2", "MEASURE 2"].join("\n"));
    expect(ast.qubits).toBe(3);
    expect(ast.ops.length).toBe(4);
  });

  it("throws when target is out of range", () => {
    expect(() => parseCircuitDsl("qubits 1\nH 5")).toThrow();
  });
});
