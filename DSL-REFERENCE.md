# QDiagram DSL Reference

This reference reflects behavior implemented in src/parser/index.ts (plus parser services under src/parser/) and covered by src/main.test.ts.

## Comments

- Inline comments start with # and continue to end of line.
- Comments are ignored by the parser.

Example:

H 0 # put q0 in superposition

## Qubit Declaration

- Declare qubit count:
  - qubits N
- Inline aliases are supported on the same line:
  - qubits 3: q0=a, q1=b, q2=c
- If qubits is omitted, parser infers a minimum count from numeric/qN references.

## Classical Bit Declaration

- Declare classical bit count:
  - cbits N
- Inline aliases are supported on the same line:
  - cbits 2: c0=flag, c1=done
- If cbits is omitted, parser infers a minimum count from classical references (`cN`) used by measurement targets and conditions.

## Alias Declaration

- Standalone alias syntax:
  - alias q0 = control
  - alias c0 = flag
- Alias constraints:
  - index must be in range of declared/inferred qubits or classical bits.
  - alias name must be unique within its namespace.
  - a classical alias name cannot be reused as a qubit alias name.
  - alias name must not collide with built-in or custom gate names.

## Built-in Gates

Single-qubit:
- H X Y Z S T RX RY RZ

Two-qubit:
- CNOT CX CZ SWAP

Three-qubit:
- TOFFOLI CCX

Examples:
- H 0
- RZ(90) 1
- CNOT 0 1
- TOFFOLI 0 1 2

## Measurement and Reset

- Measurement:
  - MEASURE target -> c0
  - M target -> c0
- Classical target after -> is required.
- Reset:
  - RESET target

## Classical Conditions

- Gate conditions use a trailing classical selector:
  - X 1 [c0]
  - X 1 [flag]
- Rules:
  - selector must resolve to a declared/inferred classical bit.
  - one classical bit can condition multiple gates.

## Explicit Grouping

- Comma-separated operations are forced into one phase:
  - H 0, X 1, Y 2
- Braced blocks are forced into one phase:
  - { H 0; CNOT 0 1; X 2 }
- Declarations are not allowed inside explicit groups.

## Custom Gate Definitions

Blackbox gate definition:
- GATE ENTANGLE(a, b)

Macro gate definition:
- GATE BELL(a, b) = H a; CNOT a b

Controlled custom blackbox definition:
- CGATE DRIVE(control, target)

Rules:
- Built-in gate names cannot be redefined.
- CGATE must declare exactly two parameters.
- Macro recursion is rejected.

## Custom Gate Invocation

- Unknown operation names are resolved against custom definitions.
- Arity must match declared parameter count.
- Macro invocations expand inline into concrete operations.
- Call-level conditions propagate to expanded macro ops when body op does not define its own condition.

## Reference Examples

### Bell Pair

qubits 2
cbits 2
H 0
CNOT 0 1
MEASURE 0 -> c0
MEASURE 1 -> c1

### Alias + Conditionals

alias q0 = control
alias q1 = target
alias c0 = flag
qubits 2
cbits 1
H control
M control -> flag
X target [flag]

### Custom Controlled Gate

CGATE DRIVE(control, target)
qubits 2
cbits 1
DRIVE 0 1
