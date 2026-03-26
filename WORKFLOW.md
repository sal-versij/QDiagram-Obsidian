# QDiagram Workflow

This file documents the day-to-day implementation workflow for this repository.

## Setup

1. Install dependencies:
   - pnpm install
2. Main source lives under src.
3. Build output is generated under output.

## Commands

- Development watch build:
  - pnpm dev
- One-shot build:
  - pnpm build
- Tests:
  - pnpm test
- Lint:
  - pnpm lint

## Build Pipeline Notes

- Build entrypoint is esbuild.config.mjs.
- Source entry is src/main.ts.
- Build emits output/main.js.
- Build copies manifest.json and styles.css into output after successful build.
- Obsidian package is externalized in bundle config.

## Recommended Change Loop

1. Make the smallest isolated change.
2. Run targeted tests or full pnpm test.
3. Run pnpm lint.
4. Run pnpm build.
5. If parser/renderer behavior changed, update src/main.test.ts in the same change.

## Refactor Safety Checklist

- Preserve parseCircuitDsl(source) public behavior.
- Preserve renderCircuitSvg(ast) public behavior.
- Preserve SVG class names used by styles/tests.
- Do not hand-edit files in output.
- Keep README and MANUAL examples aligned with parser behavior.

## Typical Touchpoints by Task

- DSL syntax and validation:
  - src/parser/index.ts
  - src/parser/
  - src/shared/types.ts
  - src/main.test.ts
- Visual rendering/layout:
  - src/renderer/index.ts
  - src/renderer/
  - styles.css
  - src/main.test.ts
- Plugin lifecycle and block processing:
  - src/main.ts

## Pre-PR Validation

Run all:
- pnpm test
- pnpm lint
- pnpm build

Then manually verify at least one circuit with:
- alias labels
- macro expansion container
- classical bit lines and write/control links
- measurement wire cutoff
