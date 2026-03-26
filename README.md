# QDiagram

QDiagram is an Obsidian plugin that renders quantum circuits from markdown code blocks.

## Quick Start

1. Install dependencies:
  - `pnpm install`
2. Build:
  - `pnpm build`
3. In Obsidian, use a `quantum` or `qcircuit` code block.

Example:

```quantum
qubits 2
H 0
CNOT 0 1
MEASURE 0 -> c0
```

## Commands

- `pnpm dev`
- `pnpm build`
- `pnpm test`

## DSL Highlights

- Measurement supports both `MEASURE q -> c0` and shorthand `M q -> c0`.
- Reset is supported via `RESET q`.
- Controlled custom gates are supported via `CGATE NAME(control, target)`.
- Conditional gates use `[c0]` and require a prior measurement declaration of `c0`.

## Documentation

For full usage and examples, see [MANUAL.md](MANUAL.md).
