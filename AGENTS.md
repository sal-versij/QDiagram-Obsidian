# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Purpose

QDiagram is an Obsidian plugin that renders quantum circuits from markdown code blocks (`quantum` and `qcircuit`).

Primary flow:
1. Code block source is received in `src/main.ts`.
2. DSL is parsed by `parseCircuitDsl` in `src/parser/index.ts`.
3. AST is rendered to SVG by `renderCircuitSvg` in `src/renderer/index.ts`.
4. Plugin appends the parsed SVG element to the markdown container.

## Repository Layout

- `src/main.ts`: Obsidian plugin entrypoint and markdown code block processors.
- `src/parser/index.ts`: parser facade and orchestration.
- `src/parser/`: parser services (tokenizer, declaration resolver, macro expander, phase scheduler, parser error formatting).
- `src/renderer/index.ts`: renderer facade and SVG composition flow.
- `src/renderer/`: renderer services (layout, gate renderer, classical routing).
- `src/shared/`: shared gate metadata, op helpers, and AST/op types (`CircuitAst`, `CircuitOp`, `GateOp`, etc.).
- `src/main.test.ts`: Vitest coverage for parser and renderer behaviors.
- `esbuild.config.mjs`: build pipeline and artifact copy to `output/`.
- `manifest.json`, `styles.css`: copied to `output/` on successful build.

## Build, Test, Lint

Use pnpm scripts from `package.json`:

- `pnpm dev`: esbuild watch mode.
- `pnpm build`: one-shot build to `output/main.js` and copies plugin artifacts.
- `pnpm test`: runs Vitest (`vitest run`).
- `pnpm lint`: runs ESLint on TypeScript files.

## DSL and Parser Conventions

When changing parser behavior, preserve these existing rules unless the task explicitly changes them:

- Comments begin with `#` and are ignored inline.
- `qubits N` can include inline aliases, e.g. `qubits 3: q0=a, q1=b, q2=c`.
- Standalone aliases use `alias q0 = name` syntax.
- Built-ins include single-qubit (`H X Y Z S T RX RY RZ`), two-qubit (`CNOT CX CZ SWAP`), and three-qubit (`TOFFOLI CCX`) gates.
- Explicit grouping:
  - comma-separated ops force same phase: `H 0, X 1`
  - braced blocks force same phase: `{ H 0; CNOT 0 1; X 2 }`
- Unknown gate calls are resolved against custom definitions (`GATE`/`CGATE`) before failing.
- Classical conditions (`[c0]`) require prior measurement declaration (`MEASURE ... -> c0`) and cannot forward-reference.
- Alias names cannot collide with built-in/custom gate names.
- Macro definitions (`GATE NAME(...) = ...`) expand into concrete ops and track `macroExpansions` spans.
- Recursive macro expansion must throw.

## Custom Gate and Macro Behavior

- `GATE NAME(params)` without body is a blackbox custom gate (`isCustom: true`).
- `CGATE NAME(control, target)` is a controlled blackbox custom gate (`isCustom: true`, `isControlledCustom: true`).
- Macro calls expand inline and may propagate call-level conditionals to expanded ops.
- Macro expansion metadata (`macroExpansions`) is consumed by renderer for container overlays.

## Renderer Conventions

- Keep Obsidian CSS variables (`var(--text-normal)`, `var(--background-primary)`, etc.) for theme compatibility.
- Gate rendering distinctions in `src/renderer/gate-renderer.ts` are intentional:
  - built-in controlled gates (`CNOT/CX/CZ`) use control-dot + target glyph.
  - `SWAP` uses crossed X markers.
  - controlled custom gates use control-dot + labeled target box.
  - blackbox/multi-target custom gates render as labeled rounded rectangles.
- Classical condition routing uses `quantum-classical-pipe` paths from measurement outputs to conditioned gates.
- Wires terminate at first measurement on each qubit (do not extend full width past measured endpoint).
- Macro containers (`quantum-macro-container` and related label classes) use lane assignment to avoid overlap.

## Testing Targets

When touching parser/renderer behavior, update or add tests in `src/main.test.ts` for the exact changed behavior. Existing coverage includes:

- alias parsing and conflicts
- implicit vs explicit phase grouping
- conditional gate validation and scheduling
- custom gate/CGATE parsing
- macro expansion and recursion checks
- renderer output for custom gates, macro containers, classical pipes, and measurement wire cutoff

## Build Artifacts

- Do not hand-edit files under `output/`.
- Build output is generated from source via `pnpm build`.
