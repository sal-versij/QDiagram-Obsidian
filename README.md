# QDiagram (MVP)

QDiagram is an Obsidian plugin that renders quantum circuits from markdown code blocks.

## Tech

- TypeScript
- Obsidian Plugin API
- esbuild
- pnpm scripts

## Commands

- `pnpm install`
- `pnpm dev`
- `pnpm build`
- `pnpm test`

## Usage

Use either `quantum` or `qcircuit` fenced blocks:

```quantum
qubits 3
H 0
CNOT 0 1
RZ(90) 2
MEASURE 1 -> c0
RESET 2
```

## Example Circuits

### Example 1: Bell pair

```quantum
qubits 2
H 0
CNOT 0 1
MEASURE 0 -> c0
MEASURE 1 -> c1
```

Expected render:

- Hadamard on q0
- One controlled gate from q0 to q1
- Two measurement boxes on q0 and q1

### Example 2: Simple rotation chain

```quantum
qubits 1
RX(45) 0
RY(90) 0
RZ(180) 0
MEASURE 0 -> c0
```

Expected render:

- Three single-qubit labeled gate boxes in order
- One measurement at the end

### Example 3: Three-qubit control example

```quantum
qubits 3
H 0
H 1
TOFFOLI 0 1 2
MEASURE 2 -> c0
```

Expected render:

- Two control dots on q0 and q1
- One target symbol on q2
- Measurement on q2

### Example 4: Mixed operations with reset and swap

```quantum
qubits 3
X 0
SWAP 0 2
CZ 1 2
RESET 0
MEASURE 2 -> c0
```

Expected render:

- Swap symbol connecting q0 and q2
- Controlled-Z symbol between q1 and q2
- Reset box on q0

## How To Test

### Automated tests

1. Install dependencies with `pnpm install`.
2. Run unit tests with `pnpm test`.
3. Run build validation with `pnpm build`.

### Manual tests in Obsidian

1. Build plugin output with `pnpm build`.
2. Copy all files from `output/` into your vault plugin folder `.obsidian/plugins/qdiagram/`.
3. Confirm the destination contains at least `main.js`, `manifest.json`, and `styles.css`.
4. In Obsidian, enable community plugins and enable QDiagram.
5. Create a markdown note and paste each example circuit block.
6. Confirm each rendered output matches the expected render notes above.

### Error-path tests

Try these invalid blocks and verify an error box appears:

If you see red error messages for these blocks, that means the parser error handling is working as expected.

```quantum
qubits 2
FOO 0
```

```quantum
qubits 2
CNOT 0
```

```quantum
qubits 1
H 5
```

### Quick smoke test (known-good)

Paste this valid block in a note and switch to reading view (or live preview):

```quantum
qubits 2
H 0
CNOT 0 1
MEASURE 0 -> c0
MEASURE 1 -> c1
```

Expected result: diagram renders with one H gate, one controlled gate, and two measurement boxes.

## Current Coverage

- Parser supports:
  - `qubits N`
  - Single-qubit gates: `H X Y Z S T RX RY RZ`
  - Two-qubit gates: `CNOT/CX CZ SWAP`
  - Three-qubit gates: `TOFFOLI/CCX`
  - `MEASURE`, `RESET`
  - Comments with `#`
- SVG renderer draws qubit wires and common gate symbols.
- Plugin registers markdown code-block processors for `quantum` and `qcircuit`.

## Next Steps

- Add syntax highlighting/editor autocomplete integration.
- Improve gate layout and collision handling.
- Add unit tests for parser and renderer.
- Add PNG export command.
