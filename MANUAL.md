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

## 4) Parallel Operations

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

## 5) Custom Gates

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

## 6) Classical Conditions

Condition gates on a measurement result:

```quantum
qubits 2
H 0
M 0 -> c0
X 1 [c0]
```

You can reuse the same classical bit for multiple gates.

Important rule: conditioned gates cannot forward-reference classical bits. The bit in `[c0]` must be declared earlier by `MEASURE` or `M`.

## 7) Complete Example

```quantum
alias q0 = control
alias q1 = data
alias q2 = ancilla

GATE BELL(a, b) = H a; CNOT a b

qubits 3

BELL control data
H ancilla

MEASURE control -> mc
MEASURE data -> md

X ancilla [mc]
Z ancilla [md]
```

## 8) Tips

- Start with a small circuit and grow it step by step.
- Use aliases for readability.
- Use macros to avoid repetition.
- Add comments to explain intent.
