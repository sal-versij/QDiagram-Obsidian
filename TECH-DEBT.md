# QDiagram Technical Debt

This file tracks concrete ad hoc areas discovered in the current code and why they are debt.

## Parser Debt

1. Grouping state machine in one loop
- File: src/parser.ts
- Symptom: inBraces, braceGroupId, commaGroupId, nextGroupId are managed inline in parseCircuitDsl.
- Why debt: grouping and statement parsing are tightly coupled, making changes risky.

2. Nested macro expander closure
- File: src/parser.ts
- Symptom: expandMacro is defined inside parseCircuitDsl and captures many outer mutable structures.
- Why debt: hard to unit test independently and easy to introduce hidden coupling.

3. Phase scheduling complexity
- File: src/parser.ts
- Symptom: buildPhases tracks multiple maps/sets and conflict logic in one function.
- Why debt: difficult to reason about invariants and extend scheduling rules safely.

4. Gate metadata spread across sets and branches
- File: src/parser.ts
- Symptom: arity/type checks are spread across multiple gate sets and parse paths.
- Why debt: adding gates requires touching multiple places.

## Renderer Debt

1. Single large dispatch function
- File: src/renderer.ts
- Symptom: renderOp uses long branching for many gate types.
- Why debt: behavior additions increase branch complexity and duplicate geometry logic.

2. Duplicated geometry and box/label logic
- File: src/renderer.ts
- Symptom: repeated calculations for x/y/width/height and repeated rect+text output patterns.
- Why debt: increases maintenance overhead and inconsistency risk.

3. Classical routing mixed with global render flow
- File: src/renderer.ts
- Symptom: pipe routing and anchor calculations are embedded in full render pass.
- Why debt: routing changes can unintentionally affect unrelated render behavior.

## Documentation Debt

1. Feature coverage mismatch across docs
- Files: README.md, MANUAL.md
- Symptom: some parser-supported syntax is incompletely represented in top-level docs.
- Why debt: user expectations can diverge from implemented behavior.

2. Missing architecture/workflow debt docs (now added)
- Files: ARCHITECTURE.md, DSL-REFERENCE.md, WORKFLOW.md, ROADMAP-ADHOC.md
- Status: created to reduce future ad hoc drift.

## Priority Tags

- High:
  - parser grouping state machine
  - nested macro expander closure
  - renderer dispatch branching
- Medium:
  - phase scheduler extraction
  - geometry deduplication
  - classical route extraction
- Low:
  - wording and consistency updates in user docs
