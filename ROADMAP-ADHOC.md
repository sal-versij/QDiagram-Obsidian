# QDiagram Ad Hoc Cleanup Roadmap

Status markers:
- [ ] not started
- [~] in progress
- [x] completed

## Phase A: Baseline and Documentation

- [x] Establish clean baseline (test, lint, build).
- [x] Add ARCHITECTURE.md.
- [x] Add DSL-REFERENCE.md.
- [x] Add WORKFLOW.md.
- [x] Add TECH-DEBT.md.
- [x] Create this staged roadmap.

## Phase B: Syntax Coherence

- [x] Align README.md examples with full parser-supported syntax.
- [x] Align MANUAL.md with parser behavior for M, RESET, CGATE, and conditional constraints.
- [ ] Normalize parser error style for equivalent validation cases.
- [x] Add coherence-focused tests in src/main.test.ts.

## Phase C: Parser Refactor (Moderate OOP)

- [x] Extract tokenizer service from parser monolith.
- [x] Extract declaration/alias resolver service.
- [x] Extract macro expansion service.
- [x] Extract phase scheduler service.
- [x] Add circuit builder orchestrator with stable parse facade.

## Phase D: Renderer Refactor (Moderate OOP)

- [x] Extract layout/geometry service.
- [x] Extract classical route builder service.
- [x] Extract gate rendering components under one dispatcher.
- [x] Keep render facade and CSS class output stable.

## Phase E: Generalization and Extendability

- [x] Introduce centralized gate metadata registry.
- [x] Unify target-span/occupied-qubit helpers across parser and renderer.
- [ ] Define low-friction extension points for new gate types.
- [ ] Remove abstractions that do not reduce coupling or duplication.

## Deferred for Later

- [ ] New DSL feature families (barriers, subcircuits).
- [ ] Simulator/runtime execution model.
- [ ] Large-circuit performance redesign.
