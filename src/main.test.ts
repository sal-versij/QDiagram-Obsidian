import { describe, expect, it } from "vitest";
import { parseCircuitDsl } from "./parser";
import { renderCircuitSvg } from "./renderer";

describe("parseCircuitDsl", () => {
  it("parses a minimal circuit with classical write", () => {
    const ast = parseCircuitDsl(["qubits 2", "cbits 1", "H 0", "CNOT 0 1", "MEASURE 1 -> c0"].join("\n"));
    expect(ast.qubits).toBe(2);
    expect(ast.classicalBits).toBe(1);
    expect(ast.ops.length).toBe(3);
  });

  it("throws for unknown operations", () => {
    expect(() => parseCircuitDsl("qubits 1\nFOO 0")).toThrow();
  });

  describe("Classical bit lines", () => {
    it("parses declared classical bit aliases", () => {
      const ast = parseCircuitDsl([
        "qubits 2",
        "cbits 2: c0=flag, c1=done",
        "MEASURE 0 -> flag",
        "X 1 [flag]"
      ].join("\n"));

      expect(ast.classicalAliases?.get(0)).toBe("flag");
      expect(ast.classicalAliases?.get(1)).toBe("done");
      const gate = ast.ops[1];
      expect(gate.type).toBe("gate");
      if (gate.type === "gate") {
        expect(gate.conditionalBit).toBe(0);
      }
    });

    it("accepts standalone classical alias declarations", () => {
      const ast = parseCircuitDsl([
        "alias c0 = signal",
        "qubits 1",
        "cbits 1",
        "MEASURE 0 -> signal"
      ].join("\n"));

      expect(ast.classicalAliases?.get(0)).toBe("signal");
      expect(ast.ops[0].type).toBe("measure");
      if (ast.ops[0].type === "measure") {
        expect(ast.ops[0].classicalTarget).toBe(0);
      }
    });

    it("requires classical write target in measurement", () => {
      expect(() => parseCircuitDsl(["qubits 1", "cbits 1", "M 0"].join("\n"))).toThrow(/unknown operation/i);
    });

    it("throws for undefined classical alias reference", () => {
      expect(() => parseCircuitDsl(["qubits 2", "cbits 1", "X 1 [unknownFlag]"].join("\n"))).toThrow(
        /unknown classical bit reference 'unknownFlag'/i
      );
    });

    it("throws for classical index out of declared range", () => {
      expect(() => parseCircuitDsl(["qubits 1", "cbits 1", "MEASURE 0 -> c3"].join("\n"))).toThrow(
        /out of range/i
      );
    });

    it("supports conditionals with cN references", () => {
      const ast = parseCircuitDsl(["qubits 2", "cbits 1", "MEASURE 0 -> c0", "X 1 [c0]"].join("\n"));
      const gate = ast.ops[1];
      expect(gate.type).toBe("gate");
      if (gate.type === "gate") {
        expect(gate.conditionalBit).toBe(0);
      }
    });

    it("infers classical bit count from highest referenced cN", () => {
      const ast = parseCircuitDsl(["qubits 1", "MEASURE 0 -> c3", "X 0 [c3]"].join("\n"));
      expect(ast.classicalBits).toBe(4);
      expect(ast.ops[0].type).toBe("measure");
      if (ast.ops[0].type === "measure") {
        expect(ast.ops[0].classicalTarget).toBe(3);
      }
    });

    it("rejects same alias name across qubit and classical spaces", () => {
      expect(() =>
        parseCircuitDsl(["alias q0 = shared", "alias c0 = shared", "qubits 1", "cbits 1", "MEASURE 0 -> c0"].join("\n"))
      ).toThrow(/already used by a qubit alias/i);
    });

    it("allows conditionals before measure when cbits are declared", () => {
      const ast = parseCircuitDsl(["qubits 2", "cbits 1", "X 1 [c0]", "MEASURE 0 -> c0"].join("\n"));
      expect(ast.ops.length).toBe(2);
    });
  });

  describe("Qubit aliases", () => {
    it("parses standalone alias declarations", () => {
      const ast = parseCircuitDsl([
        "alias q0 = ancilla",
        "alias q1 = data",
        "qubits 2",
        "cbits 1",
        "H ancilla",
        "X data"
      ].join("\n"));
      expect(ast.qubitAliases?.get(0)).toBe("ancilla");
      expect(ast.qubitAliases?.get(1)).toBe("data");
    });

    it("parses inline aliases with qubits declaration", () => {
      const ast = parseCircuitDsl(["qubits 3: q0=a, q1=b, q2=c", "cbits 1", "H a", "CNOT b c"].join("\n"));
      expect(ast.qubitAliases?.get(0)).toBe("a");
      expect(ast.qubitAliases?.get(1)).toBe("b");
      expect(ast.qubitAliases?.get(2)).toBe("c");
    });
  });

  describe("Phase grouping", () => {
    it("groups independent operations into same phase", () => {
      const ast = parseCircuitDsl(["qubits 3", "cbits 1", "H 0", "X 1", "Y 2", "CNOT 0 1"].join("\n"));
      expect(ast.phases.length).toBe(2);
      expect(ast.phases[0].length).toBe(3);
      expect(ast.phases[1].length).toBe(1);
    });

    it("forces operations into same phase with braces", () => {
      const ast = parseCircuitDsl(["qubits 3", "cbits 1", "{ H 0; CNOT 0 1; X 2 }"] .join("\n"));
      expect(ast.phases.length).toBe(1);
      expect(ast.phases[0].length).toBe(3);
    });

    it("keeps conditioned gate after its measurement when both exist", () => {
      const ast = parseCircuitDsl(["qubits 2", "cbits 1", "H 0", "MEASURE 0 -> c0", "X 1 [c0]"].join("\n"));
      expect(ast.phases.length).toBe(3);
    });
  });

  describe("Custom gates", () => {
    it("parses blackbox gate definitions and calls", () => {
      const ast = parseCircuitDsl(["GATE ENTANGLE(a, b)", "qubits 2", "cbits 1", "ENTANGLE 0 1"].join("\n"));
      expect(ast.gateDefs?.has("ENTANGLE")).toBe(true);
      expect(ast.ops.length).toBe(1);
    });

    it("expands macro gate definitions inline", () => {
      const ast = parseCircuitDsl(["GATE BELL(a, b) = H a; CNOT a b", "qubits 2", "cbits 1", "BELL 0 1"].join("\n"));
      expect(ast.ops.length).toBe(2);
      expect(ast.macroExpansions?.length).toBe(1);
    });

    it("propagates call conditional to macro-expanded gates", () => {
      const ast = parseCircuitDsl([
        "GATE PREP(a, b) = H a; CNOT a b",
        "qubits 2",
        "cbits 1",
        "MEASURE 0 -> c0",
        "PREP 0 1 [c0]"
      ].join("\n"));

      const expanded = ast.ops.slice(1);
      expect(expanded[0].type).toBe("gate");
      expect(expanded[1].type).toBe("gate");
      if (expanded[0].type === "gate" && expanded[1].type === "gate") {
        expect(expanded[0].conditionalBit).toBe(0);
        expect(expanded[1].conditionalBit).toBe(0);
      }
    });
  });
});

describe("renderCircuitSvg", () => {
  it("renders classical bit lines and labels", () => {
    const ast = parseCircuitDsl([
      "qubits 2: q0=control, q1=target",
      "cbits 1: c0=flag",
      "MEASURE control -> flag",
      "X target [flag]"
    ].join("\n"));

    const svg = renderCircuitSvg(ast);
    expect(svg).toContain("quantum-classical-wire");
    expect(svg).toContain(">flag<");
  });

  it("renders measurement write marker to classical line", () => {
    const ast = parseCircuitDsl(["qubits 1", "cbits 1", "MEASURE 0 -> c0"].join("\n"));
    const svg = renderCircuitSvg(ast);

    expect(svg).toContain("quantum-classical-write");
    expect(svg).toContain("quantum-classical-write-head");
  });

  it("renders classical control link for conditioned gates", () => {
    const ast = parseCircuitDsl(["qubits 2", "cbits 1", "MEASURE 0 -> c0", "X 1 [c0]"].join("\n"));
    const svg = renderCircuitSvg(ast);

    expect(svg).toContain("quantum-classical-control-link");
    expect(svg).toContain("quantum-classical-control-dot");
    expect(svg).not.toContain("quantum-classical-pipe");
  });

  it("renders one classical write marker per measurement", () => {
    const ast = parseCircuitDsl([
      "qubits 2",
      "cbits 2",
      "MEASURE 0 -> c0",
      "MEASURE 1 -> c1"
    ].join("\n"));
    const svg = renderCircuitSvg(ast);

    const writes = (svg.match(/class=\"quantum-classical-write\"/g) || []).length;
    const writeHeads = (svg.match(/class=\"quantum-classical-write-head\"/g) || []).length;
    expect(writes).toBe(2);
    expect(writeHeads).toBe(2);
  });

  it("renders measurements with straight write lines to classical bits", () => {
    const ast = parseCircuitDsl([
      "qubits 2",
      "cbits 2",
      "MEASURE 0 -> c0",
      "MEASURE 1 -> c1"
    ].join("\n"));
    const svg = renderCircuitSvg(ast);

    const writePaths = Array.from(
      svg.matchAll(/class="quantum-classical-write"[^>]*d="M\s*([0-9.]+)\s*([0-9.]+)\s*L\s*([0-9.]+)\s*([0-9.]+)\s*V\s*([0-9.]+)"/g)
    );
    expect(writePaths.length).toBe(2);

    // Each measurement has a straight write line (measureX === laneX, no offset)
    for (const path of writePaths) {
      const measureX = Number(path[1]);
      const laneX = Number(path[3]);
      // Isolated measurements go straight down, no lateral offset
      expect(laneX).toBe(measureX);
    }
  });

  it("isolates measurements in separate phases from gates and other measurements", () => {
    const ast = parseCircuitDsl([
      "alias q0 = control",
      "alias q1 = data",
      "alias q2 = ancilla",
      "alias q3 = control2",
      "alias q4 = data2",
      "GATE BELL(a, b) = H a; CNOT a b",
      "qubits 5",
      "cbits 2: c0=mc, c1=md",
      "BELL control control2",
      "BELL data data2",
      "H ancilla",
      "MEASURE control -> mc",
      "MEASURE data -> md",
      "X ancilla [mc]",
      "Z ancilla [md]"
    ].join("\n"));

    const svg = renderCircuitSvg(ast);
    const writePaths = Array.from(
      svg.matchAll(/class="quantum-classical-write"[^>]*d="M\s*([0-9.]+)\s*([0-9.]+)\s*L\s*([0-9.]+)\s*([0-9.]+)\s*V\s*([0-9.]+)"/g)
    );
    expect(writePaths.length).toBeGreaterThanOrEqual(2);

    // Each measurement write goes straight down (no offset, no crossing with gates)
    for (const path of writePaths) {
      const measureX = Number(path[1]);
      const laneX = Number(path[3]);
      expect(laneX).toBe(measureX);
    }
  });

  it("renders one classical control marker per conditioned gate", () => {
    const ast = parseCircuitDsl([
      "qubits 3",
      "cbits 1",
      "MEASURE 0 -> c0",
      "X 1 [c0]",
      "Z 2 [c0]"
    ].join("\n"));
    const svg = renderCircuitSvg(ast);

    const links = (svg.match(/class=\"quantum-classical-control-link\"/g) || []).length;
    const dots = (svg.match(/class=\"quantum-classical-control-dot\"/g) || []).length;
    expect(links).toBe(2);
    expect(dots).toBe(2);
  });

  it("stops qubit wire after first measurement", () => {
    const ast = parseCircuitDsl(["qubits 1", "cbits 1", "H 0", "MEASURE 0 -> c0"].join("\n"));
    const svg = renderCircuitSvg(ast);

    const viewBoxMatch = svg.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
    const wireMatch = svg.match(/class="quantum-wire"[^>]*x2="([0-9.]+)"/);
    expect(viewBoxMatch).not.toBeNull();
    expect(wireMatch).not.toBeNull();

    const width = Number(viewBoxMatch?.[1] ?? "0");
    const wireEndX = Number(wireMatch?.[1] ?? "0");
    expect(wireEndX).toBeLessThan(width - 20);
  });

  it("renders macro expansion container annotation", () => {
    const ast = parseCircuitDsl(["GATE BELL(a, b) = H a; CNOT a b", "qubits 2", "cbits 1", "BELL 0 1"].join("\n"));
    const svg = renderCircuitSvg(ast);

    expect(svg).toContain("quantum-macro-container");
    expect(svg).toContain("BELL");
  });
});
