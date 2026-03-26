# QDiagram Architecture

This document describes the current runtime sequence, module responsibilities, and extension seams.

## Runtime Sequence

1. Obsidian finds a markdown code block with language quantum or qcircuit.
2. Plugin entrypoint in src/main.ts calls renderBlock(source, el).
3. Parser in src/parser/index.ts converts DSL text into CircuitAst via parseCircuitDsl(source).
4. Renderer in src/renderer/index.ts converts CircuitAst into SVG markup via renderCircuitSvg(ast).
5. Plugin parses SVG markup with DOMParser and appends SVG node to the container.
6. If parse or render throws, the plugin writes a user-visible error div.

## Current Module Boundaries

- src/main.ts
  - Owns Obsidian lifecycle and markdown block registration.
  - Keeps all parser/renderer calls behind renderBlock.
- src/parser/index.ts
  - Parser facade and orchestration.
- src/parser/
  - Tokenization of DSL.
  - Declarations parsing: qubits/cbits, aliases, GATE, CGATE.
  - Macro expansion and recursion guard.
  - Phase scheduling and explicit group locking.
  - Parser error formatting helpers.
- src/renderer/index.ts
  - Renderer facade and SVG composition.
- src/renderer/
  - Layout geometry (wire/phase coordinates, sizing).
  - Per-op SVG rendering dispatcher and handlers.
  - Classical line routing for measurement writes and conditioned-gate control links.
  - Macro expansion container overlays and lane assignment.
- src/shared/types.ts
  - Shared contracts for CircuitAst, CircuitOp, GateOp, Phase, MacroExpansion.
- src/main.test.ts
  - Behavior lock for parser and renderer.

## Data Model Flow

1. Source string -> token stream in parser.
2. Token stream -> temporary parsed items (operations and declaration metadata).
3. Temporary items -> resolved operations with numeric targets.
4. Resolved operations -> phased schedule.
5. Final AST fields:
  - qubits
  - classicalBits
  - qubitAliases
  - classicalAliases
  - gateDefs
  - macroExpansions
  - phases
  - ops
6. AST -> SVG elements serialized as one SVG string.

## Key Invariants

- Conditional gate references resolve to declared/inferred classical bit indices.
- Measurement operations must write into an explicit classical bit target.
- Alias names cannot conflict with built-in or custom gate names.
- Explicit operation groups stay in one phase and lock that phase from later implicit merges.
- Wires end at the first measurement on each qubit.
- Macro containers reflect macroExpansions spans.

## Intentional Contracts to Preserve During Refactor

- Public parser entry: parseCircuitDsl(source) in src/parser/index.ts.
- Public renderer entry: renderCircuitSvg(ast) in src/renderer/index.ts.
- Existing SVG class names consumed by tests and styles:
  - quantum-custom-gate
  - quantum-classical-wire
  - quantum-classical-write
  - quantum-classical-write-head
  - quantum-classical-control-link
  - quantum-classical-control-dot
  - quantum-macro-container
  - quantum-macro-container-label
  - quantum-macro-container-label-bg
  - quantum-wire
  - quantum-wire-label
  - quantum-wire-label-bg

## Practical Extension Points

- New gate families: add parser gate metadata and renderer handling without changing plugin entry flow.
- New diagnostics: extend parser validation errors while preserving current semantics.
- New layout tuning: adjust layout constants and helper functions in renderer without AST changes.
