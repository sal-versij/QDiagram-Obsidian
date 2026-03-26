# QDiagram Manual (Compact)

Purpose: render quantum circuit diagrams from fenced markdown code blocks in Obsidian.

## 1) Block Types
Use either fence:

    ```quantum
    ```
or 

    ```qcircuit
    ```
    
## 2) DSL Grammar (Minimal)

```text
program      := (alias | qubitsDecl | gateDef)* line*
line         := gate1 | gate2 | gate3 | measure | reset | comment
alias        := "alias" "q" INT "=" IDENTIFIER
qubitsDecl   := "qubits" INT_POS [":" aliasDecl ("," aliasDecl)*]
aliasDecl    := "q" INT "=" IDENTIFIER
gateDef      := "GATE" IDENTIFIER "(" [IDENTIFIER ("," IDENTIFIER)*] ")" ["=" macroBody]
macroBody    := line (";" line)*

# 1-qubit gates
gate1        := ("H"|"X"|"Y"|"Z"|"S"|"T"|"RX"|"RY"|"RZ") ["(" params ")"] qubitRef ["[" classicalRef "]"]

# 2-qubit gates  
gate2        := ("CNOT"|"CX"|"CZ"|"SWAP") qubitRef qubitRef ["[" classicalRef "]"]

# 3-qubit gates
gate3        := ("TOFFOLI"|"CCX") qubitRef qubitRef qubitRef ["[" classicalRef "]"]

measure      := ("MEASURE"|"M") qubitRef ["->" CLASSICAL]
reset        := "RESET" qubitRef

qubitRef     := INT | IDENTIFIER   # numeric index or alias name
classicalRef := IDENTIFIER
comment      := "#" ...
```

Notes:
- Keywords are case-insensitive.
- `qubitRef` can be a numeric index (0, 1, 2, ...) or an alias name.
- Aliases can be declared standalone (`alias q0 = name`) or inline with qubits (`qubits 3: q0=a, q1=b`).
- Independent operations are automatically grouped into parallel phases.
- `classicalRef` references a classical bit name declared in a MEASURE operation.
- Gates with classical refs render with a classical bit pipe (double dashed lines).

## 3) Supported Ops (Exact)
- `alias q<N> = <name>` (define qubit semantic name)
- `qubits N` (declare N qubits, optionally with inline aliases)
- `GATE Name(a,b,...)` (declare blackbox custom gate)
- `GATE Name(a,b,...) = ...` (declare macro custom gate)
- Single: `H X Y Z S T RX RY RZ`
- Two-qubit: `CNOT CX CZ SWAP`
- Three-qubit: `TOFFOLI CCX`
- `MEASURE` / alias `M`
- `RESET`
- `#` comments

## 4) Aliases
- `CX == CNOT`
- `CCX == TOFFOLI`
- `M == MEASURE`

## 5) Validation Rules
- Qubit index must be integer `>= 0`.
- `qubits N` requires `N > 0`.
- Operand arity is enforced per op.
- Unknown op => error.
- Target out of range (`q >= N`) => error.
- If `qubits` is omitted: inferred as `maxReferencedQubit + 1` (minimum `1`).
- Classical bit refs must be declared via MEASURE operation.
- Classical bit refs must appear after the MEASURE that declares them.
- Alias names must not conflict with built-in gate names.
- Built-in gate names cannot be redefined as custom gates.

## 5a) Qubit Aliases
Define semantic names for qubits to improve circuit readability.

Standalone aliases:
```quantum
alias q0 = control
alias q1 = target
qubits 2
H control
CNOT control target
```

Inline aliases with qubits declaration:
```quantum
qubits 3: q0=ancilla, q1=data, q2=flag
H ancilla
CNOT data flag
```

Rules:
- Aliases can reference any qubit index `q<N>` where `N < qubit count`.
- Numeric qubit indices (0, 1, 2, ...) can be used directly or via aliases interchangeably.
- Aliases are local to the circuit block (no global scope).
- In rendered output, wire labels show the alias name instead of `q<N>`.

## 5b) Parallelism (Implicit Grouping)
Independent operations automatically execute in parallel phases.

Example:
```quantum
qubits 3
H 0         # phase 0: independent operations
X 1         # grouped automatically
Y 2         # (all use different qubits)
CNOT 0 1    # phase 1: depends on q0, q1 from phase 0, so separate
Z 2         # phase 2: depends on q2 from phase 0, so separate
```

Rules:
- Operations using different qubits can run in parallel.
- Operations sharing any qubit must run sequentially.
- Parser automatically detects and groups sequences of independent ops.
- In rendering, ops in the same phase are stacked vertically at the same column.
- Phase separation is shown visually with thin vertical spacing between phases.

Visualization:
```
q0: ┌─H─┐  ┌──CNOT──┐
    │   │  │        │
q1: ├─X─┤  ├──o─────┤
    │   │  │        │
q2: ├─Y─┤  └───┐    │
    └─┬─┘      ├─Z──┤
    phase 0  phase 1
```

## 5c) Custom Gates
Custom gates support two modes.

Blackbox gate (renders as a custom box, no inline expansion):
```quantum
GATE ENTANGLE(a, b)
qubits 2
ENTANGLE 0 1
```

Macro gate (expanded inline at parse time):
```quantum
GATE BELL(a, b) = H a; CNOT a b
qubits 2
BELL 0 1
```

Rules:
- Custom gate names are case-insensitive and normalized internally.
- Macro parameters are substituted positionally.
- Recursive macro expansion is rejected.
- Blackbox gate calls are preserved as custom operations in the AST.

## 6) Classical Bit Piping
Gates can condition on measurement results using bracket notation.

Syntax:
```text
GATE targets [classicalBitName]
```

Examples:
```quantum
qubits 2
H 0
M 0 -> c0       # measure q0, store in c0
X 1 [c0]        # apply X to q1 conditioned by c0
```

The renderer shows two parallel dashed lines (the "pipe") connecting from the measurement to the conditioned gate, indicating classical bit flow.

Rules:
- Classical bit name must match a previously declared measurement label.
- Multiple gates can reference the same classical bit.
- Single-qubit gates, two-qubit gates, and three-qubit gates all support classical refs.
- Gate parameters and classical refs can coexist: `RZ(90) 1 [c0]`.

## 7) Parallelism Rendering
Operations in the same phase render vertically stacked at the same column, showing parallel execution.

Example:
```quantum
qubits 3
H 0         # independent operations, same phase
X 1         # stacked vertically in render
Y 2
CNOT 0 1    # depends on q0, q1 -> separate phase
```

Rendered output:
```
       Phase 0  Phase 1
q0: ───H────────●──────
    ┌──┐        │      
q1: ├─X─┤───────X──────
    ├──┤        
q2: ├─Y─┤──────────────
    └──┘ 
```

Rules:
- Operations using distinct qubits are automatically grouped into the same phase.
- Rendering stacks these ops vertically with small spacing (±4px) to show they're independent.
- Operation order within a phase is preserved for display (top to bottom).
- Each phase maps to a single column in the circuit diagram.

## 8) Error Surface
On parse/render errors, plugin shows:

```text
Quantum circuit error: <message>
```

## 9) Minimal Examples

Valid:

```quantum
qubits 2
H 0
CNOT 0 1
MEASURE 0 -> c0
MEASURE 1 -> c1
```

With inferred qubits:

```qcircuit
RX(45) 0
CZ 0 1
M 1
```

Classical bit piping:

```quantum
qubits 2
H 0
MEASURE 0 -> c0
X 1 [c0]
```

Expected: two dashed parallel lines (pipe) connecting measurement on q0 to X gate on q1.

Invalid (unknown op):

```quantum
qubits 2
FOO 0
```

Invalid (undefined classical bit):

```quantum
qubits 2
X 0 [c_undefined]
```

Invalid (arity):

```quantum
qubits 2
CNOT 0
```

Invalid (range):

```quantum
qubits 1
H 5
```

## 10) Render Mapping (Fast Reference)
- 1-qubit gate -> labeled box
- `CNOT/CX` -> control dot + target plus-in-circle
- `CZ` -> control dot + Z target
- `SWAP` -> X/X targets connected
- `TOFFOLI/CCX` -> 2 controls + 1 target
- `MEASURE` -> `M` box
- `RESET` -> `RST` box
- Classical bit pipe -> two parallel dashed lines from measurement to conditioned gate
- Parallel ops -> vertically stacked gates in same column

## 11) Full Example with Aliases & Parallelism

```quantum
alias q0 = control
alias q1 = data
alias q2 = ancilla

qubits 3

# Initialization phase: all independent
H control
X data
RESET ancilla

# Entanglement phase: depends on prev, separate
CNOT control data
H ancilla

# Measurement phase: independent measurements, same phase
MEASURE control -> mc
MEASURE data -> md
MEASURE ancilla -> ma

# Conditional corrections
X data [mc]
Z ancilla [md]
```

Expected rendering:
- Phase 1: H, X, RST stacked vertically
- Phase 2: CNOT, H stacked vertically  
- Phase 3: M, M, M stacked vertically
- Phase 4: X (on data with pipe from mc), Z (on ancilla with pipe from md) stacked vertically
- Wire labels show "control", "data", "ancilla" instead of q0, q1, q2
