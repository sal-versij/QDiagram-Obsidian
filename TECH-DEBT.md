# QDiagram Technical Debt

This file tracks remaining debt after the parser/renderer cleanup and folder-structure stabilization.

## Active Debt

1. Renderer extensibility is currently function-registry based
- Files: src/renderer/gate-renderer.ts, src/shared/gate-registry.ts
- Symptom: extension points exist, but there is no public plugin-facing registration API yet.
- Why debt: adding new external gate packs still requires source edits.

2. Parser declaration+operation loop is still a large unit
- File: src/parser/index.ts
- Symptom: orchestration is now cleaner, but declaration parsing and operation collection still run in one main build loop.
- Why debt: future grammar expansion will be easier if statement parsing is further decomposed.

## Resolved in This Cleanup

- Parser tokenizer extracted to src/parser/dsl-tokenizer.ts.
- Declaration and alias resolution extracted to src/parser/declaration-resolver.ts.
- Macro expansion extracted to src/parser/macro-expander.ts.
- Phase scheduling extracted to src/parser/phase-scheduler.ts.
- Parser facade preserved at src/parser/index.ts.
- Renderer layout extracted to src/renderer/layout.ts.
- Classical routing extracted to src/renderer/classical-router.ts.
- Gate rendering extracted to src/renderer/gate-renderer.ts.
- Shared gate metadata moved to src/shared/gate-registry.ts.
- Shared op helpers moved to src/shared/op-utils.ts.
- Shared AST/op types moved to src/shared/types.ts.

## Documentation Debt

1. Keep architecture docs aligned with future module moves
- Files: AGENTS.md, ARCHITECTURE.md, WORKFLOW.md, ROADMAP-ADHOC.md
- Symptom: structural docs are now aligned, but they can drift after future refactors.
- Why debt: stale structure docs cause onboarding and agent mistakes.

## Priority Tags

- Medium:
  - public extension API for custom gate-render handlers
  - optional further split of parser main orchestration loop
- Low:
  - continuous doc path synchronization
