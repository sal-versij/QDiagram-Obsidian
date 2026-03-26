import { describe, expect, it } from "vitest";
import { parseCircuitDsl } from "./parser";
import { renderCircuitSvg } from "./renderer";

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

  describe("Classical bit piping", () => {
    it("parses conditional gate with classical reference", () => {
      const ast = parseCircuitDsl(
        ["qubits 2", "H 0", "MEASURE 0 -> c0", "X 1 [c0]"].join("\n")
      );
      expect(ast.ops.length).toBe(3);
      const lastOp = ast.ops[2];
      expect(lastOp.type).toBe("gate");
      if (lastOp.type === "gate") {
        expect(lastOp.conditional).toBe("c0");
      }
    });

    it("parses single-qubit gate with params and classical reference", () => {
      const ast = parseCircuitDsl(
        ["qubits 2", "H 0", "MEASURE 0 -> c0", "RZ(90) 1 [c0]"].join("\n")
      );
      const lastOp = ast.ops[2];
      expect(lastOp.type).toBe("gate");
      if (lastOp.type === "gate") {
        expect(lastOp.name).toBe("RZ");
        expect(lastOp.params).toContain("90");
        expect(lastOp.conditional).toBe("c0");
      }
    });

    it("parses two-qubit gate with classical reference", () => {
      const ast = parseCircuitDsl(
        ["qubits 3", "H 0", "MEASURE 0 -> c0", "CNOT 1 2 [c0]"].join("\n")
      );
      const lastOp = ast.ops[2];
      expect(lastOp.type).toBe("gate");
      if (lastOp.type === "gate") {
        expect(lastOp.name).toBe("CNOT");
        expect(lastOp.targets).toEqual([1, 2]);
        expect(lastOp.conditional).toBe("c0");
      }
    });

    it("throws for undefined classical bit reference", () => {
      expect(() => parseCircuitDsl(
        ["qubits 2", "X 0 [c_undefined]"].join("\n")
      )).toThrow(/classical bit 'c_undefined' not declared/);
    });

    it("allows multiple gates conditioned by same classical bit", () => {
      const ast = parseCircuitDsl(
        ["qubits 3", "H 0", "MEASURE 0 -> c0", "X 1 [c0]", "Z 2 [c0]"].join("\n")
      );
      expect(ast.ops.length).toBe(4);
      const op1 = ast.ops[2];
      const op2 = ast.ops[3];
      expect(op1.type).toBe("gate");
      expect(op2.type).toBe("gate");
      if (op1.type === "gate" && op2.type === "gate") {
        expect(op1.conditional).toBe("c0");
        expect(op2.conditional).toBe("c0");
      }
    });

    it("throws for forward references (gate before measure)", () => {
      expect(() => parseCircuitDsl(
        ["qubits 2", "X 1 [c0]", "H 0", "MEASURE 0 -> c0"].join("\n")
      )).toThrow(/classical bit 'c0' not declared/);
    });

    it("parses gate without classical reference (backward compat)", () => {
      const ast = parseCircuitDsl(
        ["qubits 2", "H 0", "X 1"].join("\n")
      );
      const lastOp = ast.ops[1];
      expect(lastOp.type).toBe("gate");
      if (lastOp.type === "gate") {
        expect(lastOp.conditional).toBeUndefined();
      }
    });
  });

  describe("Qubit aliases", () => {
    it("parses standalone alias declarations", () => {
      const ast = parseCircuitDsl(
        ["alias q0 = ancilla", "alias q1 = data", "qubits 2", "H ancilla", "X data"].join("\n")
      );
      expect(ast.qubitAliases).toBeDefined();
      expect(ast.qubitAliases?.get(0)).toBe("ancilla");
      expect(ast.qubitAliases?.get(1)).toBe("data");
      expect(ast.ops[0].type).toBe("gate");
      if (ast.ops[0].type === "gate") {
        expect(ast.ops[0].targets[0]).toBe(0);
      }
    });

    it("parses inline aliases with qubits declaration", () => {
      const ast = parseCircuitDsl(
        ["qubits 3: q0=a, q1=b, q2=c", "H a", "CNOT b c"].join("\n")
      );
      expect(ast.qubitAliases?.get(0)).toBe("a");
      expect(ast.qubitAliases?.get(1)).toBe("b");
      expect(ast.qubitAliases?.get(2)).toBe("c");
      const cnot = ast.ops[1];
      expect(cnot.type).toBe("gate");
      if (cnot.type === "gate") {
        expect(cnot.targets).toEqual([1, 2]);
      }
    });

    it("allows numeric and alias qubit references to mix", () => {
      const ast = parseCircuitDsl(
        ["alias q0 = working", "qubits 3", "H working", "X 1", "Z 2"].join("\n")
      );
      expect(ast.ops.length).toBe(3);
      expect(ast.ops[0].type).toBe("gate");
      if (ast.ops[0].type === "gate") {
        expect(ast.ops[0].targets[0]).toBe(0);
      }
    });

    it("throws for alias referencing non-existent qubit", () => {
      expect(() =>
        parseCircuitDsl(["alias q5 = x", "qubits 2"].join("\n"))
      ).toThrow(/alias q5 exceeds declared 2 qubits/);
    });
  });

  describe("Phase grouping (implicit parallelism)", () => {
    it("groups independent operations into same phase", () => {
      const ast = parseCircuitDsl(
        ["qubits 3", "H 0", "X 1", "Y 2", "CNOT 0 1"].join("\n")
      );
      // H, X, Y are independent → same phase; CNOT depends on 0 and 1 → separate phase
      expect(ast.phases.length).toBe(2);
      expect(ast.phases[0].length).toBe(3);
      expect(ast.phases[1].length).toBe(1);
    });

    it("separates dependent operations into different phases", () => {
      const ast = parseCircuitDsl(
        ["qubits 2", "H 0", "CNOT 0 1", "X 1"].join("\n")
      );
      // H on q0, CNOT on (0,1), X on q1 → all in different phases (dependencies)
      expect(ast.phases.length).toBe(3);
      expect(ast.phases[0].length).toBe(1); // H
      expect(ast.phases[1].length).toBe(1); // CNOT
      expect(ast.phases[2].length).toBe(1); // X
    });

    it("allows independent measurements in same phase", () => {
      const ast = parseCircuitDsl(
        ["qubits 2", "H 0", "H 1", "MEASURE 0 -> c0", "MEASURE 1 -> c1"].join("\n")
      );
      // H 0 and H 1 are independent → same phase
      // M 0 and M 1 are independent → same phase
      expect(ast.phases.length).toBe(2);
      expect(ast.phases[0].length).toBe(2); // H, H
      expect(ast.phases[1].length).toBe(2); // M, M
    });

    it("respects measurement-dependent gates as separate phases", () => {
      const ast = parseCircuitDsl(
        ["qubits 2", "H 0", "MEASURE 0 -> c0", "X 1 [c0]"].join("\n")
      );
      // H on q0 -> phase 0
      // MEASURE on q0 -> phase 1 (same qubit dependency)
      // X on q1 [c0] -> phase 2 (strictly after producer measurement phase)
      expect(ast.phases.length).toBe(3);
    });

    it("maintains original op sequence in flat ops array", () => {
      const ast = parseCircuitDsl(
        ["qubits 3", "H 0", "X 1", "Y 2", "CNOT 0 1"].join("\n")
      );
      expect(ast.ops.length).toBe(4);
      expect(ast.ops[0].type).toBe("gate");
      expect(ast.ops[1].type).toBe("gate");
      expect(ast.ops[2].type).toBe("gate");
      expect(ast.ops[3].type).toBe("gate");
      if (ast.ops[0].type === "gate") {
        expect(ast.ops[0].name).toBe("H");
        expect(ast.ops[1].type === "gate" && (ast.ops[1] as any).name).toBe("X");
      }
    });
  });

  describe("Explicit phase grouping", () => {
    it("groups comma-separated operations into same phase", () => {
      const ast = parseCircuitDsl(
        ["qubits 3", "H 0, X 1, Y 2"].join("\n")
      );
      // H 0, X 1, Y 2 are comma-separated → forced same phase
      expect(ast.phases.length).toBe(1);
      expect(ast.phases[0].length).toBe(3);
    });

    it("respects mixed comma and newline grouping", () => {
      const ast = parseCircuitDsl(
        ["qubits 3", "H 0, X 1", "Y 2", "CNOT 0 1"].join("\n")
      );
      // H, X on same line with comma → forced same phase
      // Y is independent from that phase → but can join if independent (no comma forces separation)
      // CNOT depends on 0,1 → separate phase
      expect(ast.phases[0].length).toBe(2); // H, X forced together
      expect(ast.phases.length).toBeGreaterThan(1); // CNOT in separate phase
    });

    it("forces operations into same phase with braces", () => {
      const ast = parseCircuitDsl(
        ["qubits 3", "{ H 0; CNOT 0 1; X 2 }"].join("\n")
      );
      // All ops inside braces forced to same phase regardless of dependencies
      expect(ast.phases.length).toBe(1);
      expect(ast.phases[0].length).toBe(3);
    });

    it("parses multi-line braced blocks", () => {
      const ast = parseCircuitDsl(
        ["qubits 3", "{", "  H 0", "  X 1", "  Y 2", "}"].join("\n")
      );
      // All ops in braced block → same phase
      expect(ast.phases.length).toBe(1);
      expect(ast.phases[0].length).toBe(3);
    });

    it("handles comma-separated multi-qubit gates", () => {
      const ast = parseCircuitDsl(
        ["qubits 4", "CNOT 0 1, CNOT 2 3"].join("\n")
      );
      // Two-qubit gates on comma-separated line → forced same phase (independent ops)
      expect(ast.phases.length).toBe(1);
      expect(ast.phases[0].length).toBe(2);
    });
  });

  describe("Custom gates", () => {
    it("parses blackbox gate definitions and calls", () => {
      const ast = parseCircuitDsl([
        "GATE ENTANGLE(a, b)",
        "qubits 2",
        "ENTANGLE 0 1"
      ].join("\n"));

      expect(ast.gateDefs?.has("ENTANGLE")).toBe(true);
      expect(ast.ops.length).toBe(1);
      expect(ast.ops[0].type).toBe("gate");
      if (ast.ops[0].type === "gate") {
        expect(ast.ops[0].isCustom).toBe(true);
        expect(ast.ops[0].name).toBe("ENTANGLE");
      }
    });

    it("expands macro gate definitions inline", () => {
      const ast = parseCircuitDsl([
        "GATE BELL(a, b) = H a; CNOT a b",
        "qubits 2",
        "BELL 0 1"
      ].join("\n"));

      expect(ast.ops.length).toBe(2);
      expect(ast.ops[0].type).toBe("gate");
      expect(ast.ops[1].type).toBe("gate");
      if (ast.ops[0].type === "gate" && ast.ops[1].type === "gate") {
        expect(ast.ops[0].name).toBe("H");
        expect(ast.ops[1].name).toBe("CNOT");
        expect(ast.ops[1].targets).toEqual([0, 1]);
      }
    });

    it("throws for undefined custom gate call", () => {
      expect(() =>
        parseCircuitDsl(["qubits 2", "MYGATE 0 1"].join("\n"))
      ).toThrow(/unknown operation/i);
    });

    it("throws for custom gate arity mismatch", () => {
      expect(() =>
        parseCircuitDsl([
          "GATE ENTANGLE(a, b)",
          "qubits 2",
          "ENTANGLE 0"
        ].join("\n"))
      ).toThrow(/expects 2 qubit targets/i);
    });

    it("parses controlled custom gate definitions and calls", () => {
      const ast = parseCircuitDsl([
        "CGATE DRIVE(control, target)",
        "qubits 2",
        "DRIVE 0 1"
      ].join("\n"));

      expect(ast.gateDefs?.has("DRIVE")).toBe(true);
      expect(ast.ops.length).toBe(1);
      expect(ast.ops[0].type).toBe("gate");
      if (ast.ops[0].type === "gate") {
        expect(ast.ops[0].isCustom).toBe(true);
        expect(ast.ops[0].isControlledCustom).toBe(true);
        expect(ast.ops[0].targets).toEqual([0, 1]);
      }
    });

    it("throws when CGATE definition does not use exactly two parameters", () => {
      expect(() =>
        parseCircuitDsl([
          "CGATE DRIVE(a, b, c)",
          "qubits 3",
          "DRIVE 0 1 2"
        ].join("\n"))
      ).toThrow(/expects exactly 2 parameters/i);
    });

    it("throws for recursive macro expansion", () => {
      expect(() =>
        parseCircuitDsl([
          "GATE LOOP(a) = LOOP a",
          "qubits 1",
          "LOOP 0"
        ].join("\n"))
      ).toThrow(/recursive macro expansion/i);
    });

    it("propagates call conditional to macro-expanded gates", () => {
      const ast = parseCircuitDsl([
        "GATE PREP(a, b) = H a; CNOT a b",
        "qubits 2",
        "MEASURE 0 -> c0",
        "PREP 0 1 [c0]"
      ].join("\n"));

      expect(ast.ops.length).toBe(3);
      const expanded = ast.ops.slice(1);
      expect(expanded[0].type).toBe("gate");
      expect(expanded[1].type).toBe("gate");
      if (expanded[0].type === "gate" && expanded[1].type === "gate") {
        expect(expanded[0].conditional).toBe("c0");
        expect(expanded[1].conditional).toBe("c0");
      }
    });
  });

  describe("Regression fixes", () => {
    it("parses reset operations", () => {
      const ast = parseCircuitDsl([
        "qubits 1",
        "RESET 0"
      ].join("\n"));

      expect(ast.ops.length).toBe(1);
      expect(ast.ops[0].type).toBe("reset");
      if (ast.ops[0].type === "reset") {
        expect(ast.ops[0].target).toBe(0);
      }
    });

    it("accepts measurement shorthand without classical target", () => {
      const ast = parseCircuitDsl([
        "qubits 1",
        "M 0"
      ].join("\n"));

      expect(ast.ops.length).toBe(1);
      expect(ast.ops[0].type).toBe("measure");
      if (ast.ops[0].type === "measure") {
        expect(ast.ops[0].target).toBe(0);
        expect(ast.ops[0].classical).toBeUndefined();
      }
    });

    it("accepts inline comments after gates", () => {
      const ast = parseCircuitDsl([
        "qubits 1",
        "H 0         # phase 0: independent operations"
      ].join("\n"));

      expect(ast.ops.length).toBe(1);
      expect(ast.ops[0].type).toBe("gate");
    });

    it("accepts inline comments on measure declaration and conditional usage", () => {
      const ast = parseCircuitDsl([
        "qubits 2",
        "H 0",
        "M 0 -> c0       # measure q0, store in c0",
        "X 1 [c0]        # apply X to q1 conditioned by c0"
      ].join("\n"));

      expect(ast.ops.length).toBe(3);
      expect(ast.ops[2].type).toBe("gate");
      if (ast.ops[2].type === "gate") {
        expect(ast.ops[2].conditional).toBe("c0");
      }
    });

    it("renders blackbox custom gates with width adjusted to label length", () => {
      const ast = parseCircuitDsl([
        "GATE ENTANGLE(a, b)",
        "qubits 2",
        "ENTANGLE 0 1"
      ].join("\n"));
      const svg = renderCircuitSvg(ast);
      const widthMatch = svg.match(/class="quantum-custom-gate"[^>]*width="([0-9.]+)"/);

      expect(widthMatch).not.toBeNull();
      const width = Number(widthMatch?.[1] ?? "0");
      expect(width).toBeGreaterThan(44);
    });

    it("renders alias labels with readable background", () => {
      const ast = parseCircuitDsl([
        "alias q0 = control",
        "alias q1 = target",
        "qubits 2",
        "H control",
        "CNOT control target"
      ].join("\n"));
      const svg = renderCircuitSvg(ast);

      expect(svg).toContain("quantum-wire-label-bg");
      expect(svg).toContain("control");
      expect(svg).toContain("target");
    });

    it("shows macro expansion container annotation", () => {
      const ast = parseCircuitDsl([
        "GATE BELL(a, b) = H a; CNOT a b",
        "qubits 2",
        "BELL 0 1"
      ].join("\n"));
      const svg = renderCircuitSvg(ast);

      expect(svg).toContain("quantum-macro-container");
      expect(svg).toContain("BELL");
    });

    it("keeps macro container span with parallel operations", () => {
      const ast = parseCircuitDsl([
        "alias q0 = control",
        "alias q1 = data",
        "alias q2 = ancilla",
        "GATE BELL(a, b) = H a; CNOT a b",
        "qubits 3",
        "BELL control data",
        "H ancilla"
      ].join("\n"));
      const svg = renderCircuitSvg(ast);
      const containerMatch = svg.match(/class="quantum-macro-container"[^>]*\swidth="([0-9.]+)"/);
      const yMatch = svg.match(/class="quantum-macro-container"[^>]*\sy="([0-9.]+)"[^>]*\sheight="([0-9.]+)"/);
      const labelYMatch = svg.match(/class="quantum-macro-container-label"[^>]*\sy="([0-9.]+)"/);
      const labelBgMatch = svg.match(/class="quantum-macro-container-label-bg"/);
      const hYs = Array.from(svg.matchAll(/<text[^>]*y="([0-9.]+)"[^>]*>H<\/text>/g)).map((m) => Number(m[1]));
      const wireYs = Array.from(svg.matchAll(/class="quantum-wire"[^>]*y1="([0-9.]+)"/g)).map((m) => Number(m[1]));

      expect(containerMatch).not.toBeNull();
      const width = Number(containerMatch?.[1] ?? "0");
      // Container must span more than one phase column when BELL expands to H + CNOT.
      expect(width).toBeGreaterThan(80);

      // Container should only cover BELL's touched qubits (control/data), not ancilla.
      expect(yMatch).not.toBeNull();
      const containerBottom = Number(yMatch?.[1] ?? "0") + Number(yMatch?.[2] ?? "0");
      expect(wireYs.length).toBeGreaterThanOrEqual(3);
      expect(containerBottom).toBeLessThan(wireYs[2] - 10);

      // Label should be placed above gates so it stays readable.
      expect(labelYMatch).not.toBeNull();
      expect(labelBgMatch).not.toBeNull();
      expect(hYs.length).toBeGreaterThan(0);
      const minHY = Math.min(...hYs);
      expect(Number(labelYMatch?.[1] ?? "0")).toBeLessThan(minHY - 8);
    });

    it("stacks overlapping macro containers into separate lanes", () => {
      const ast = parseCircuitDsl([
        "qubits 3",
        "H 0",
        "CNOT 0 1",
        "X 2"
      ].join("\n"));

      ast.macroExpansions = [
        { name: "OUTER", startOpIndex: 0, endOpIndex: 1 },
        { name: "INNER", startOpIndex: 0, endOpIndex: 2 }
      ];
      const svg = renderCircuitSvg(ast);
      const yMatches = Array.from(svg.matchAll(/class="quantum-macro-container"[^>]*y="([0-9.]+)"/g));

      expect(yMatches.length).toBeGreaterThanOrEqual(2);
    });

    it("renders controlled custom gate with control line and labeled target", () => {
      const ast = parseCircuitDsl([
        "CGATE DRIVE(control, target)",
        "qubits 2",
        "DRIVE 0 1"
      ].join("\n"));
      const svg = renderCircuitSvg(ast);

      expect(svg).toContain("quantum-custom-gate");
      expect(svg).toContain(">DRIVE<");
      expect(svg).toContain("<circle");
      expect(svg).toContain("<line");
    });

    it("keeps lower macro labels near their own qubit band", () => {
      const ast = parseCircuitDsl([
        "qubits 5",
        "alias q0 = control",
        "alias q1 = data",
        "alias q2 = ancilla",
        "alias q3 = boh",
        "alias q4 = app",
        "GATE BELL(a, b) = H a; CNOT a b",
        "BELL control data",
        "BELL ancilla boh",
        "H app",
        "MEASURE control -> mc",
        "MEASURE data -> md",
        "X ancilla [mc]",
        "Z ancilla [md]"
      ].join("\n"));
      const svg = renderCircuitSvg(ast);

      const labelYs = Array.from(svg.matchAll(/class="quantum-macro-container-label"[^>]*y="([0-9.]+)"/g)).map((m) => Number(m[1]));
      const wireYs = Array.from(svg.matchAll(/class="quantum-wire"[^>]*y1="([0-9.]+)"/g)).map((m) => Number(m[1]));

      expect(labelYs.length).toBeGreaterThanOrEqual(2);
      expect(wireYs.length).toBe(5);

      // The second BELL label should stay below the data wire area and near ancilla/boh.
      const sortedLabelYs = [...labelYs].sort((a, b) => a - b);
      expect(sortedLabelYs[1]).toBeGreaterThan(wireYs[1] + 8);
      expect(sortedLabelYs[1]).toBeLessThan(wireYs[2] + 24);
    });

    it("serializes visually crossing multi-line macro expansions", () => {
      const ast = parseCircuitDsl([
        "qubits 5",
        "alias q0 = control",
        "alias q1 = data",
        "alias q2 = ancilla",
        "alias q3 = boh",
        "alias q4 = app",
        "GATE BELL(a, b) = H a; CNOT a b",
        "BELL control ancilla",
        "BELL data boh",
        "H app",
        "MEASURE control -> mc",
        "MEASURE data -> md",
        "X ancilla [mc]",
        "Z ancilla [md]"
      ].join("\n"));

      const cnotPhases: number[] = [];
      for (let phaseIndex = 0; phaseIndex < ast.phases.length; phaseIndex += 1) {
        for (const op of ast.phases[phaseIndex]) {
          if (op.type === "gate" && (op.name === "CNOT" || op.name === "CX")) {
            cnotPhases.push(phaseIndex);
          }
        }
      }

      expect(cnotPhases.length).toBe(2);
      expect(cnotPhases[0]).not.toBe(cnotPhases[1]);

      const hPhases: number[] = [];
      for (let phaseIndex = 0; phaseIndex < ast.phases.length; phaseIndex += 1) {
        for (const op of ast.phases[phaseIndex]) {
          if (op.type === "gate" && op.name === "H" && (op.targets[0] === 0 || op.targets[0] === 1)) {
            hPhases.push(phaseIndex);
          }
        }
      }
      expect(hPhases.length).toBe(2);
      expect(hPhases[0]).not.toBe(hPhases[1]);
    });

    it("renders classical pipes for conditioned gates", () => {
      const ast = parseCircuitDsl([
        "qubits 2",
        "H 0",
        "MEASURE 0 -> c0",
        "X 1 [c0]"
      ].join("\n"));
      const svg = renderCircuitSvg(ast);

      const pipeMatch = svg.match(/class="quantum-classical-pipe"[^>]*d="([^"]+)"/);
      expect(pipeMatch).not.toBeNull();
      expect(pipeMatch?.[1]).toContain("H");
      expect(pipeMatch?.[1]).toContain("V");
      // Single split route: the command sequence ends with V (no second horizontal segment).
      expect(pipeMatch?.[1].trim()).toMatch(/H\s+[0-9.]+\s+V\s+[0-9.]+$/);
    });

    it("does not offset parallel operations horizontally", () => {
      const ast = parseCircuitDsl([
        "qubits 2",
        "H 0, X 1"
      ].join("\n"));
      const svg = renderCircuitSvg(ast);

      const hMatch = svg.match(/<text x="([0-9.]+)" y="[0-9.]+" text-anchor="middle" font-size="12" fill="var\(--text-normal\)">H<\/text>/);
      const xMatch = svg.match(/<text x="([0-9.]+)" y="[0-9.]+" text-anchor="middle" font-size="12" fill="var\(--text-normal\)">X<\/text>/);
      expect(hMatch).not.toBeNull();
      expect(xMatch).not.toBeNull();
      expect(Number(hMatch?.[1])).toBe(Number(xMatch?.[1]));
    });

    it("stops qubit wire after measurement", () => {
      const ast = parseCircuitDsl([
        "qubits 1",
        "H 0",
        "MEASURE 0 -> c0"
      ].join("\n"));
      const svg = renderCircuitSvg(ast);

      const viewBoxMatch = svg.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
      const wireMatch = svg.match(/class="quantum-wire"[^>]*x2="([0-9.]+)"/);
      expect(viewBoxMatch).not.toBeNull();
      expect(wireMatch).not.toBeNull();

      const width = Number(viewBoxMatch?.[1] ?? "0");
      const wireEndX = Number(wireMatch?.[1] ?? "0");
      expect(wireEndX).toBeLessThan(width - 20);
    });

    it("renders measure operation with analog meter icon", () => {
      const ast = parseCircuitDsl([
        "qubits 1",
        "MEASURE 0 -> c0"
      ].join("\n"));
      const svg = renderCircuitSvg(ast);
      const iconParts = (svg.match(/class="quantum-measure-icon"/g) || []).length;

      expect(iconParts).toBeGreaterThanOrEqual(3);
    });

    it("renders reset operation with RST label", () => {
      const ast = parseCircuitDsl([
        "qubits 1",
        "RESET 0"
      ].join("\n"));
      const svg = renderCircuitSvg(ast);

      expect(svg).toContain(">RST<");
    });
  });
});
