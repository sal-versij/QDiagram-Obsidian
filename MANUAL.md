# QDiagram User Guide

QDiagram lets you write quantum circuit instructions in a markdown code block and see a rendered circuit in Obsidian.

## 1) Getting Started

Use one of these code blocks:

    ```quantum
    ```

or

    ```qcircuit
    ```

Write one instruction per line.

## 2) Core Commands

- Set qubit count:
  - `qubits 2`
- Set classical bit count:
  - `cbits 2`
- Single-qubit gates:
  - `H 0`, `X 1`, `Y 0`, `Z 1`, `S 0`, `T 1`
  - Parametric gates: `RX(45) 0`, `RY(90) 1`, `RZ(180) 0`
- Two-qubit gates:
  - `CNOT 0 1`, `CX 0 1`, `CZ 0 1`, `SWAP 0 1`
- Three-qubit gates:
  - `TOFFOLI 0 1 2`, `CCX 0 1 2`
- Measurement:
  - `MEASURE 0 -> c0`
  - `M 0 -> c0`
- Reset:
  - `RESET 0`

Comments are supported. Anything after `#` on a line is ignored.

## 3) Qubit Aliases

Use aliases to make circuits easier to read.

```quantum
alias q0 = control
alias q1 = target
qubits 2
H control
CNOT control target
```

You can also define aliases inline:

```quantum
qubits 3: q0=ancilla, q1=data, q2=flag
H ancilla
CNOT data flag
```

Alias rules:

- Alias names must be unique.
- Alias names cannot collide with built-in gate names.
- Alias names cannot collide with custom gate names you define with `GATE` or `CGATE`.
- Alias indices must be in range for declared/inferred qubits.

## 4) Classical Bit Declarations and Aliases

Classical lines are explicit and independent from qubit lines.

```quantum
qubits 2
cbits 2
MEASURE 0 -> c0
X 1 [c0]
```

You can define classical aliases inline:

```quantum
qubits 2
cbits 2: c0=flag, c1=done
MEASURE 0 -> flag
X 1 [flag]
```

Or as standalone aliases:

```quantum
alias c0 = readout
qubits 1
cbits 1
MEASURE 0 -> readout
```

Classical alias rules:

- Alias names must be unique in the classical namespace.
- A classical alias name cannot be reused by a qubit alias name.
- Alias indices must be in range for declared/inferred classical bits.

## 5) Parallel Operations

Independent operations are grouped automatically.

```quantum
qubits 3
H 0
X 1
Y 2
```

You can force a group on one line:

```quantum
qubits 3
H 0, X 1, Y 2
```

Or with braces:

```quantum
qubits 3
{ H 0; X 1; Y 2 }
```

## 6) Custom Gates

### Blackbox gate

Use a named gate rendered as a single block:

```quantum
GATE ENTANGLE(a, b)
qubits 2
ENTANGLE 0 1
```

### Controlled blackbox gate

Use `CGATE` for a custom gate with CNOT-like control/target rendering:

```quantum
CGATE DRIVE(control, target)
qubits 2
DRIVE 0 1
```

### Macro gate

Use a named shortcut expanded into standard gates:

```quantum
GATE BELL(a, b) = H a; CNOT a b
qubits 2
BELL 0 1
```

Expanded macros are shown with a rounded container label above the affected phases.

## 7) Classical Conditions

Condition gates on a measurement result:

```quantum
qubits 2
cbits 1
H 0
M 0 -> c0
X 1 [c0]
```

You can reuse the same classical bit for multiple gates.

Condition references can use either `cN` form or a classical alias:

- `X 1 [c0]`
- `X 1 [flag]`

If `cbits` is declared, conditioned gates can reference any declared classical line; measurement later writes the value used by those controls.

## 8) Classical Rendering Semantics

The renderer now uses explicit classical lines (one per declared/inferred classical bit):

- Every `MEASURE q -> cX` draws a write connector from the measurement gate to classical line `cX`.
- Every conditioned gate `... [cX]` draws a classical control marker from line `cX` down/up to the gate, in CNOT-like control style.
- Legacy "pipe from measurement directly to gate" routing is replaced by this persistent classical-line model.

## 9) Complete Example

```quantum
alias q0 = control
alias q1 = data
alias q2 = ancilla

GATE BELL(a, b) = H a; CNOT a b

qubits 3
cbits 2: c0=mc, c1=md

BELL control data
H ancilla

MEASURE control -> mc
MEASURE data -> md

X ancilla [mc]
Z ancilla [md]
```

## 10) Tips

- Start with a small circuit and grow it step by step.
- Use aliases for readability.
- Use macros to avoid repetition.
- Add comments to explain intent.
