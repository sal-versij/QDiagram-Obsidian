import { CircuitAst, CircuitOp } from "./types";

const SINGLE_QUBIT_GATES = new Set([
  "H",
  "X",
  "Y",
  "Z",
  "S",
  "T",
  "RX",
  "RY",
  "RZ"
]);

function parseIntStrict(value: string, lineNumber: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Line ${lineNumber}: invalid qubit index '${value}'.`);
  }
  return parsed;
}

function parseGateToken(token: string): { gate: string; params: string[] } {
  const withParams = token.match(/^([A-Za-z]+)\((.*)\)$/);
  if (!withParams) {
    return { gate: token.toUpperCase(), params: [] };
  }

  const [, gate, rawParams] = withParams;
  const params = rawParams
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  return { gate: gate.toUpperCase(), params };
}

export function parseCircuitDsl(source: string): CircuitAst {
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter(Boolean);

  let qubits = 0;
  const ops: CircuitOp[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const lineNumber = i + 1;
    const line = lines[i];
    const parts = line.split(/\s+/);
    const head = parts[0].toUpperCase();

    if (head === "QUBITS") {
      if (parts.length !== 2) {
        throw new Error(`Line ${lineNumber}: expected 'qubits <N>'.`);
      }
      const count = parseIntStrict(parts[1], lineNumber);
      if (count <= 0) {
        throw new Error(`Line ${lineNumber}: qubits must be > 0.`);
      }
      qubits = count;
      continue;
    }

    if (head === "MEASURE" || head === "M") {
      if (parts.length < 2) {
        throw new Error(`Line ${lineNumber}: expected 'MEASURE <q> [-> c0]'.`);
      }
      const target = parseIntStrict(parts[1], lineNumber);
      let classical: string | undefined;

      const arrowIndex = parts.indexOf("->");
      if (arrowIndex !== -1) {
        classical = parts[arrowIndex + 1];
      }

      ops.push({ type: "measure", target, classical });
      continue;
    }

    if (head === "RESET") {
      if (parts.length !== 2) {
        throw new Error(`Line ${lineNumber}: expected 'RESET <q>'.`);
      }
      const target = parseIntStrict(parts[1], lineNumber);
      ops.push({ type: "reset", target });
      continue;
    }

    const { gate, params } = parseGateToken(parts[0]);
    const args = parts.slice(1);

    if (gate === "CNOT" || gate === "CX" || gate === "CZ" || gate === "SWAP") {
      if (args.length < 2) {
        throw new Error(`Line ${lineNumber}: gate ${gate} expects two qubit indices.`);
      }
      const a = parseIntStrict(args[0], lineNumber);
      const b = parseIntStrict(args[1], lineNumber);
      ops.push({ type: "gate", name: gate, targets: [a, b], params });
      continue;
    }

    if (gate === "TOFFOLI" || gate === "CCX") {
      if (args.length < 3) {
        throw new Error(`Line ${lineNumber}: gate ${gate} expects three qubit indices.`);
      }
      const a = parseIntStrict(args[0], lineNumber);
      const b = parseIntStrict(args[1], lineNumber);
      const c = parseIntStrict(args[2], lineNumber);
      ops.push({ type: "gate", name: gate, targets: [a, b, c], params });
      continue;
    }

    if (SINGLE_QUBIT_GATES.has(gate)) {
      if (args.length < 1) {
        throw new Error(`Line ${lineNumber}: gate ${gate} expects one qubit index.`);
      }
      const target = parseIntStrict(args[0], lineNumber);
      ops.push({ type: "gate", name: gate, targets: [target], params });
      continue;
    }

    throw new Error(`Line ${lineNumber}: unknown operation '${parts[0]}'.`);
  }

  if (qubits === 0) {
    const maxTarget = ops.reduce((max, op) => {
      if (op.type === "gate") {
        return Math.max(max, ...op.targets);
      }
      return Math.max(max, op.target);
    }, -1);
    qubits = Math.max(maxTarget + 1, 1);
  }

  for (const op of ops) {
    if (op.type === "gate") {
      for (const target of op.targets) {
        if (target >= qubits) {
          throw new Error(`Gate target q${target} is out of range for ${qubits} qubits.`);
        }
      }
    } else if (op.target >= qubits) {
      throw new Error(`Operation target q${op.target} is out of range for ${qubits} qubits.`);
    }
  }

  return { qubits, ops };
}
