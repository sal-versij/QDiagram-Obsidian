# Executive Summary  
We propose building an Obsidian plugin (named e.g. “QuantumCircuit”) that renders user-written quantum circuit diagrams from Markdown code blocks.  Development follows Obsidian’s TypeScript plugin model【12†L30-L39】【14†L325-L333】.  The plugin will parse a specialized code-block DSL into a circuit AST, then render it client-side (SVG/Canvas) using a JavaScript library or WebAssembly engine.  Renderers may include existing SVG-based libraries like *quantum-circuit-drawer*【19†L274-L282】 or a custom engine using SVG/Canvas.  Diagrams will use standard conventions: horizontal qubit wires, left-to-right time axis, gates (H, X, Y, Z, S, T, Rx, etc.) in boxes or symbols, controlled gates (●–○), multi-qubit gates (boxes spanning wires), measurement (meter symbol with double classical line), resets, classical bits (double lines)【21†L63-L72】【29†L468-L476】.  We will ensure live preview integration (via Obsidian’s Markdown post-processors) and editor support (syntax highlighting via CodeMirror/Prism), with caching/performance optimizations (lazy render, offline use).  We recommend building on the official Obsidian sample plugin (TypeScript, esbuild)【12†L30-L39】【14†L327-L335】, using GitHub Actions for linting/CI【41†L374-L377】.  Testing will include unit tests for parsing, rendering, and UI integration.  Distribution follows Obsidian’s community plugin guidelines (manifest, versions.json, repository + release)【14†L329-L338】【15†L47-L56】.  Below we survey relevant APIs, renderers, standards, and provide a development plan with milestones and acceptance criteria.

## 1. Obsidian Plugin Development  
Obsidian plugins are written in TypeScript/JavaScript and loaded from the vault’s `.obsidian/plugins` folder【12†L30-L39】. The [Obsidian Developer Docs](https://docs.obsidian.md/) describe setting up Node.js, cloning the [obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin) template, and building with `pnpm dev`【12†L30-L39】. The template uses **esbuild** for bundling and TypeScript definitions (obsidian.d.ts) for the API【14†L294-L302】.  Key files include `manifest.json` (ID, name, version, minAppVersion) and `main.ts`.  Plugins can register commands, settings, ribbon icons, and Markdown post-processors via the `Plugin` API【12†L52-L61】【14†L301-L309】. For code-block rendering, one uses `this.registerMarkdownCodeBlockProcessor(lang, callback)` to handle fenced blocks and produce rendered content in preview/read modes【15†L47-L56】.  

**Build Tools & Packaging:**  Standardize on pnpm: use `pnpm dev` (watch + rebuild) and `pnpm build`. Releases are packaged by updating `manifest.json` version, populating `versions.json`, and creating a GitHub release with `manifest.json`, `main.js`, and `styles.css` attached【14†L329-L338】. Plugins are licensed (often MIT or 0BSD) – the sample uses 0BSD【41†L420-L424】.  Follow [Obsidian plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines) for code style and security (avoid innerHTML, clean up event listeners on unload)【15†L47-L56】【15†L61-L70】.  

**Permissions & Security:** Obsidian plugins run with full user privileges on the local filesystem, so users must explicitly enable community plugins【12†L36-L44】. The guidelines urge caution: do not use `innerHTML` on untrusted input to prevent XSS【15†L47-L56】. Clean up resources (listeners, intervals) in `onunload()` to avoid leaks【15†L61-L70】. There is no granular permission model; inform users that the plugin runs local code.  

**Distribution:** After testing, publish on GitHub and submit a PR to `obsidianmd/obsidian-releases` with your plugin’s GitHub URL【14†L349-L353】. The manifest’s `minAppVersion` should match tested Obsidian versions. Maintain `versions.json` to support older Obsidian versions【14†L329-L338】.  

## 2. Rendering Options  
We must convert the circuit AST to graphics in Obsidian’s preview (SVG/Canvas/HTML). Options include:  
- **Existing JS Libraries:** *quantum-circuit-drawer* (TypeScript, MIT) renders SVG via [svg.js]【19†L274-L282】; it supports common gates (X,Y,Z,H, Rx,Ry,Rz, CNOT, measurement) and works in browser【19†L279-L288】. There’s also *Quirk* (Apache-2.0) which is a fully interactive simulator in JS【43†L299-L307】. We could use parts of Quirk (licensed Apache-2.0【43†L402-L406】) or borrow ideas from its rendering engine (it draws up to 16 qubits【43†L319-L327】).  
- **Canvas or WebGL:** For performance, a custom renderer could draw on `<canvas>` or WebGL, but this is complex. SVG is simpler for circuits and supports scaling.  
- **WebAssembly:** One could compile an existing toolkit (e.g. a C++ layout engine) via WASM, but likely unnecessary complexity.  

**Integration:** The plugin will register a markdown post-processor for the chosen code-block language (e.g. `quantum` or `qcircuit`). In preview mode, the callback generates an SVG element (or `<canvas>`) inserted into the DOM. In live-preview, similarly respond to AST updates. Use lazy rendering: only render on-demand or after a delay to avoid blocking the editor. Cache rendered diagrams (e.g. keyed by code content hash) to speed re-renders. Ensure offline support: include all assets in the plugin bundle; avoid CDN.  

**Performance:** For large circuits (dozens of qubits or gates), rendering must be efficient. SVG can handle moderately complex drawings; if slow, consider splitting work (e.g. asynchronous drawing). Barriers and complex operations can be optional.  

**Caching & Offline:** Cache parsed AST and last-rendered SVG (per code-block) to avoid re-rendering unchanged blocks【31†L118-L127】. Do not fetch external resources; bundle any needed fonts or images.  

## 3. Quantum Diagram Standards and Notation  
Quantum circuits typically use horizontal wires for qubits (top=qubit0) and time flows left-to-right【21†L63-L72】. Gates on single qubits are drawn as boxes or labels on the wire; common ones include:  
- **Single-Qubit Gates:** Pauli-X (NOT), Y, Z, Hadamard (H), Phase/S-gate (S), T-gate, Identity (no-op), rotations $R_x(\theta), R_y(\theta), R_z(\theta)$【21†L63-L72】【29†L483-L495】.  
- **Multi-Qubit Gates:** Controlled gates: e.g. CNOT (controlled-X), CZ (controlled-Z) drawn as ●–⊕ or ●–Z; Toffoli (CCNOT with two controls, drawn ●–●–⊕)【21†L69-L72】【29†L383-L392】. Controlled-Phase (CZ) and other ancilla gates may be drawn with control dots and labeled target gates.  Swap gates often drawn as X-shaped crosses on two wires (sometimes shown as ☒ or with a swap symbol).  
- **Parametrized Gates:** $R_k(\theta)$ rotations, parameter $\theta$ shown near gate.  
- **Measurement:** Shown as a meter (⊕ inside a circle, or a box labeled M) with output to a double (classical) wire【21†L69-L72】【29†L468-L476】.  
- **Reset:** A box labeled “Reset” or arrow to |0⟩, often omitted or drawn as R.  
- **Classical Bits:** Represented by double lines or lines ending in a box, for measurement outcomes【29†L468-L476】. Gates with classical control have a ⊕ on a double-line connecting to a controlled gate.  
- **Wires & Labels:** Qubit lines are solid single lines; classical lines are double【29†L468-L476】. Label left end as $|0⟩, |ψ⟩$ etc. Time increases to the right【21†L54-L62】.  
- **Annotations:** Groupings/boxes can enclose subcircuits (optional). Labels over gates can show math names (e.g. $H$, $X^\theta$). Subcircuits or comments might be indicated by brackets or colored backgrounds.  

These conventions align with IBM/Cirq/CNOT diagrams【21†L63-L72】【29†L468-L476】. For example, Microsoft Q# docs use solid lines for qubits, ● for controls, meter symbols for measurement, double-lines for classical bits【21†L69-L72】【29†L468-L476】. 

## 4. Existing Libraries & Tools  
| Tool / Library                  | Type        | Language | License    | Notable Features                            | JS Bindings/Integration        |
| ------------------------------ | ----------- | -------- | ----------- | ------------------------------------------- | ------------------------------ |
| **quantum-circuit-drawer**【19†L274-L282】 | Library     | TypeScript/JS | MIT        | Renders SVG circuits; supports H,X,Y,Z, Rx,Ry,Rz, CNOT, measurement【19†L279-L288】; HTML/CSS styling | Direct JS include or import (Node/browser)【19†L300-L309】 |
| **Quirk (Strilanc/Quirk)**【43†L299-L307】 | App/Sim    | JS        | Apache-2.0 | Interactive editor, drag-drop, simulate (up to 16 qubits)【43†L299-L307】 | Open-source, embeds in webpage; complex, might extract render code |
| **Qiskit (IBM)**【31†L45-L54】      | Framework   | Python    | Apache-2.0【34†L1-L4】 | Draws ASCII, Matplotlib, or LaTeX circuits【31†L91-L100】; extensive gate set (Clifford+T) | Not JS; can export SVG/PNG via Matplotlib or LaTeX【31†L91-L100】 |
| **Cirq (Google)**             | Framework   | Python    | Apache-2.0 | Draws circuits via Matplotlib; gate sets similar (Pauli, rotations, CZ, etc.) | Not JS; outputs images via Python |
| **PyQuil (Rigetti)**          | Framework   | Python    | Apache-2.0 | Supports Quil assembly, common gates; can export diagrams via matplotlib (Rigetti docs) | Not JS |
| **Quantikz (LaTeX)**          | LaTeX package | TeX      | GPLv3?    | Well-known TikZ macros for quantum circuits | No JS; diagrams via LaTeX compile |
| **qpic**                     | Tool/DSL    | C/Python? | MIT?      | DSL for TeX/TikZ diagrams; older tool | Not JS; has a text DSL |
| **Mermaid (proposed)**【46†L250-L258】 | Library   | JS (Mermaid) | MIT (Mermaid) | No built-in quantum; issue #1597 suggests grammar (`q[0]--H--[>]`)【46†L250-L258】 | Could extend Mermaid (e.g. via plug-in) |
| **Others:** PsiQuantum Circuit Designer (web tool), Mathematica, Azure/Q# notebooks (non-embeddable) | N/A        | Varies   | Proprietary/others | GUI tools, not directly usable in plugin | – |

**Notes:** Qiskit, Cirq, PyQuil are Python and not directly embeddable in JS/Obsidian. They output diagrams via Matplotlib/LaTeX【31†L91-L100】. For a JS plugin, we likely focus on JS/Web libraries. The *quantum-circuit-drawer* library covers many gates【19†L279-L288】; if gaps exist (e.g. CZ or Swap), code can be extended. Quirk shows a complete JS-based engine, but it’s heavy (simulation + UI). We may use it as inspiration, but it’s more simulator than static diagram renderer. 

When choosing libraries, consider license compatibility (Apache-2.0, MIT, GPL). All listed above are open-source; avoid GPL dependencies if plugin is MIT. 

## 5. Parsing Strategy (Code-Block Syntax)  
We must define a user-friendly DSL for circuits in Markdown fences, e.g.:

````markdown
```quantum
qubits 3  # defines 3 wires labeled |q0>,|q1>,|q2>
H 0       # Hadamard on qubit 0
CNOT 0 1  # CNOT from qubit 0 to 1
RZ(90) 2  # Rz(pi/2) on qubit 2
MEASURE 1 -> c0  # measure qubit 1 into classical bit c0
```
````

Key grammar proposals: 
- **Code-fence label:** use ```quantum or ```qcircuit (or similar).  
- **Declarations:** optional header like `qubits N` or explicit wire names.  
- **Gates:** one per line: `<GATE> <qubit(s)> [params]`.  E.g. `H 0`, `X 1`, `CZ 0 2`, `RX(45) 1`.  Controlled gates may be written `CNOT 0 1` or `CX 0 1`, `TOFFOLI 0 1 2`.  
- **Measurement:** `MEASURE <q> -> <c>` or just `M <q>` outputs to next classical line.  
- **Reset:** `RESET <q>` if supported.  
- **Comments:** allow `# comment`.  
- **Custom gates:** allow user-defined by name, e.g. `GATE Foo(params) q1, q2`.  The AST could record unknown gates for extensibility.  
- **Classes:** permit grouping, subcircuits perhaps with indentation or brackets if needed.  

Internally, the plugin should parse this DSL into an AST (e.g. list of operations with gate name, targets, params). Use a simple parsing approach (split tokens) or a parser library. Provide clear error messages if syntax is invalid (e.g. unknown gate, wrong arity).  Example: “Error: GATE SWAP expects 2 qubit indices, got 1.”

Potential reference: the Mermaid issue suggests a line-based syntax like `q[0] -- H[H] -- [>]`【46†L250-L258】, but we prefer named gates for clarity. Alternatively, one could allow an ASCII-art style matrix (like Qiskit’s `circuit.draw()` ASCII【31†L63-L72】), but a line-based DSL is more structured and easier to parse.  

The plugin AST might look like:
```
Circuit {
  numQubits: 3,
  ops: [
    {type: "gate", name: "H", targets: [0], params: []},
    {type: "gate", name: "CX", targets: [0,1], params: []},
    {type: "measure", targets: [1], label: "c0"},
    ...
  ]
}
```
This AST feeds the renderer.  Extensibility: allow plugins or future versions to add new gate definitions without rewriting parser (e.g. by listing allowed gate names).  

## 6. UX: Editor and Preview Integration  
- **Syntax Highlighting:** Register a custom Prism/CodeMirror language definition for `.quantum` fences. Highlight keywords (H, CNOT, RX, etc.) and numbers. In edit and preview modes, Obsidian uses CodeMirror for editor and Prism for read mode【38†L1-L4】. Provide a `.css` or Prism grammar if needed.  
- **Autocomplete:** Use Obsidian’s `registerEditorSuggest` or similar to suggest gate names and qubit indices as the user types, once the first character of a gate is entered.  
- **Live Preview:** In Obsidian’s reading and live-preview modes, use `registerMarkdownCodeBlockProcessor("quantum", ...)`. This callback receives the code text and a container element to fill. Draw an SVG (or HTML `<canvas>`) of the circuit into `container`. On changes, re-render.  
- **Export (SVG/PNG):** Offer a command to export the last-rendered diagram to SVG or PNG. For example, add a button or context menu on the rendered diagram: “Export as SVG/PNG”. Use the SVG source for SVG export, and canvas (or svg2png) for PNG. Also allow copying image to clipboard.  
- **Accessibility:** Ensure diagrams have alt text (e.g. summary of the circuit or gate count). Make colors and fonts theme-aware: detect Obsidian’s dark/light mode and adjust colors of gates/wires (or use CSS variables from `window.getComputedStyle` on `--interactive-normal`). Use high-contrast outlines.  
- **Theme Compatibility:** Obsidian themes can change background/foreground. Use CSS variables (like `color-text`, `color-bg`) when styling SVG text or elements. Test dark mode rendering.  
- **Responsiveness:** Diagrams should scale to container width, or scroll if too wide. Use SVG viewBox for scaling.  

## 7. Testing, CI, and Roadmap  
**Testing:** Unit tests are critical for parser correctness and rendering. Use Jest or Mocha to test:  
- **Parser tests:** for valid/invalid code-blocks (e.g. missing qubit index, unknown gate).  
- **Renderer tests:** given a simple AST, verify the SVG structure (e.g. count of gate elements) or compare screenshot (with Puppeteer) for known circuits.  
- **Integration tests:** Launch Obsidian in test harness (e.g. [@obsidianmd/plugin-e2e](https://github.com/obsidianmd/obsidian-e2e) framework) to load plugin, insert a code block, and verify output DOM.  
Include ESLint/Prettier (the sample plugin has ESLint CI integration【41†L374-L377】). Set up GitHub Actions: lint on push, run Jest tests, and build.  

**CI:** GitHub Actions workflow for Node: on push/pull: `pnpm test` and `pnpm build`. Lint as in sample plugin【41†L374-L377】.  

**Roadmap & Milestones:**  
1. **MVP – Core Functionality:**  
   - Define DSL grammar, implement parser.  
   - Integrate simple SVG renderer (e.g. use *quantum-circuit-drawer* or custom minimal).  
   - Support basic gates: H, X, Y, Z, S, T, RX, RY, RZ, CNOT, CZ, SWAP, MEASURE.  
   - Render code-blocks in preview (no X interactivity).  
   - Basic tests for parser and renderer.  
   - (Time: 2-4 weeks)  

2. **Advanced Features:**  
   - Add multi-qubit and controlled gates (Toffoli, Controlled-Phase).  
   - Group/subcircuit notation (brackets).  
   - Parameter labels on rotations.  
   - Improve layout (adjust spacing automatically).  
   - Lazy rendering & caching.  
   - Optimize performance for larger circuits.  
   - Add syntax highlighting and autocomplete in editor.  
   - (Time: 2-3 weeks)  

3. **UX & Polish:**  
   - Dark mode theming, SVG responsive design.  
   - Export to SVG/PNG, context menu.  
   - Accessibility: alt text generation.  
   - Comprehensive unit and integration tests.  
   - Prepare examples and documentation.  
   - (Time: 2 weeks)  

4. **Publishing:**  
   - Finalize version and manifest.  
   - CI: test passes, build artifact.  
   - Create GitHub release, submit to community plugin list.  
   - (Time: 1 week)  

**Acceptance Criteria (for final release):**  
- Plugin builds with `pnpm build` and loads in Obsidian without errors.  
- Triple-backtick code blocks labeled (e.g.) `quantum` render a circuit diagram in preview mode consistent with expected diagrams from our DSL.  
- All common gates (X,Y,Z,H,S,T, Rx/ry/rz, CNOT, CZ, SWAP, MEASURE, RESET) are supported and correctly drawn.  
- Controlled gates (single/multi control) render correctly with control dots and vertical connectors.  
- Classical bits (double-lines) appear for measurements and classical controls.  
- Syntax errors in code block produce a clear error notice (without crashing Obsidian).  
- Dark/light themes produce appropriate color adjustments.  
- The plugin includes tests with >80% coverage for parser/renderer.  
- CI (lint+test+build) passes on GitHub Actions.  

## Tables and Comparisons  

### Renderer Libraries Comparison  

| Renderer/Engine            | Language | Output    | Features                                 | Performance (est.) | License       |
| -------------------------- | -------- | --------- | ---------------------------------------- | ------------------ | ------------- |
| quantum-circuit-drawer【19†L274-L282】 | JS/TS    | SVG       | Common gates (H,X,Y,Z, Rx,Ry,Rz, CNOT, measure)【19†L279-L288】, styling | Moderate (SVG)     | MIT           |
| Custom SVG (hand-coded)    | JS       | SVG/HTML  | Fully customizable layout, minimal overhead | Fast for small circuits | N/A (ours)   |
| Canvas/WebGL custom        | JS/WebGL | Canvas    | Pixel-level control; efficient for many elements | Faster at large scale, but more complex | N/A        |
| Quirk (Strilanc)【43†L299-L307】         | JS       | HTML+Canvas  | Interactive simulation (state display), up to 16 qubits【43†L319-L327】 | Moderate (10-16 qubits) | Apache-2.0    |
| Mermaid (hypothetical)【46†L250-L258】   | JS       | SVG (via Cytoscape) | Would need plug-in; idea DSL `q[...] -- ...` | TBD (untested)     | MIT           |

*Table: Potential rendering backends. We plan to start with an SVG-based approach (e.g. adapting quantum-circuit-drawer or custom SVG) for ease of integration.*  

### Quantum Libraries / Frameworks Comparison  

| Library/Tool   | Language | License       | Gate Support | JS Binding or Export | Notes |
| -------------- | -------- | ------------- | ------------ | -------------------- | ----- |
| **Qiskit**【31†L45-L54】【33†L165-L173】   | Python   | Apache-2.0【34†L1-L4】 | Full universal set (Clifford+T, custom), draw via ASCII/Matplotlib/LaTeX【31†L45-L54】 | No JS; can export SVG via Matplotlib or LaTeX PDF【31†L91-L100】 | Heavy, not directly used in plugin. |
| **Cirq**       | Python   | Apache-2.0   | Similar (Pauli, rotations, CZ, SWAP, measurements) | No JS; outputs Matplotlib or ASCII | Google; not used in plugin but standards compatible. |
| **PyQuil**     | Python   | Apache-2.0   | Quil instruction set (Pauli, controlled, etc.) | No JS; export via Matplotlib | Rigetti’s library. |
| **Quirk (Strilanc)**【43†L299-L307】 | JS       | Apache-2.0   | Many single+multi gates; full simulator【43†L299-L307】 | JS web app; code visible in repo | Could inspire DSL/renderer, but GUI-focused. |
| **quantum-circuit-drawer**【19†L274-L282】 | JS/TS    | MIT          | Common gates (H,X,Y,Z,Rx,Ry,Rz,CNOT, measure)【19†L279-L288】 | JS library importable in plugin | Good starting point for renderer. |
| **Quantikz**   | TeX      | GPLv3 (LaTeX) | Very broad (TikZ), custom gates | No JS; outputs vector via LaTeX | Powerful but not for live plugin. |
| **qpic**       | DSL/TeX  | MIT?         | Basic gates via DSL | No JS; outputs TikZ | Legacy use. |

*Table: Comparison of popular quantum circuit frameworks. For plugin use, JavaScript libraries (quantum-circuit-drawer, Quirk) are relevant; Python frameworks inform notation but aren’t embeddable.*  

### Gate Coverage (Selected Libraries)  

| Gate Type         | quantum-circuit-drawer【19†L279-L288】 | Quirk【43†L299-L307】         | Qiskit/Cirq  | Notes                 |
| ----------------- | -------------------------------------- | ----------------------------- | ------------ | --------------------- |
| Single-qubit      | X, Y, Z, H, Rx, Ry, Rz (with θ)【19†L279-L288】 | X, Y, Z, H, S, T, √X, rotations (Quirk UI) | Yes         | All include basic gates. |
| Controlled (2q)   | CNOT (controlled-X)【19†L279-L288】       | CNOT, CZ, etc. (UI)           | Yes         | Controlled-Z often drawn instead. |
| Multi-control     | *Not built-in* (could simulate CCX by custom gate) | Toffoli (CCX)                 | Yes (CCX)   | CCX/Toffoli available in full frameworks. |
| SWAP              | *Unknown*                              | Yes (swap symbol)             | Yes         | SWAP often drawn separately. |
| Phase / S / T     | *Not listed*                           | Yes (S, T)                   | Yes         | Important gates for universality. |
| Measurement       | Yes (⊕ symbol)【19†L279-L288】            | Yes (M, Bloch display)        | Yes         | All support measuring to classical bits. |
| Reset             | *Not listed*                           | (Resets possible via spec)    | Yes         | Rare in static diagrams. |
| Parameterized     | Rx,Ry,Rz with angles【19†L279-L288】      | Parameter input for gates     | Yes         | Gate with numeric param. |
| Classical control | (Draw measurement only)                | Yes (classical control UI)    | Yes         | Post-measurement control. |

*Table: Gate support comparison. The quantum-circuit-drawer covers core gates (not SWAP/Toffoli by default). Quirk’s full UI has more. Plugin can extend missing gates if needed.*  

## Example Agentic Prompt for Implementation  

```
**Goal:** Develop an Obsidian plugin “QuantumCircuit” that renders quantum circuit diagrams from Markdown code blocks. 

**Requirements:** 
- Parse fenced code blocks labeled (e.g.) ```quantum into a circuit AST.
- Support gates: X, Y, Z, H, S, T, Rx(θ), Ry(θ), Rz(θ), CNOT, CZ, SWAP, Toffoli, Measurement (to classical bits), Reset.
- Render diagrams client-side as SVG: horizontal qubit wires, time → right, gates as boxes/dots, classical bits as double lines【21†L63-L72】【29†L468-L476】. 
- Live preview integration: diagrams show in Obsidian preview/editor views. 
- Offer theme-aware colors (dark/light) and alt text for accessibility. 
- Provide syntax highlighting and autocomplete for DSL in editor. 
- Include tests (parser, renderer) and CI (lint/test/build on GitHub Actions)【41†L374-L377】. 
- Follow Obsidian plugin guidelines for manifest and submission【14†L349-L353】【15†L47-L56】. 
- Export capability: allow user to save diagram as SVG/PNG.

**Deliverables:** 
1. Obsidian plugin code (TypeScript), with parser and renderer modules. 
2. Unit tests for parsing and rendering. 
3. Documentation: syntax summary, example circuits. 
4. GitHub repo with CI (Actions) running lint/tests. 
5. Release artifacts: compiled `main.js`, `manifest.json`, `styles.css`.

**Milestones:** 
- M1 (2 weeks): MVP parse+render basic gates.  
- M2 (3 weeks): Advanced gates, live preview support, caching.  
- M3 (2 weeks): UX polish (theme support, export, docs).  
- M4: Release & submit to community list.

**Acceptance Criteria:** Plugin builds and loads; ` ```quantum ... ``` ` blocks render accurate diagrams for test circuits; passes test suite; adheres to Obsidian’s API and security rules【12†L30-L39】【15†L47-L56】.```

**(Diagram) Plugin Architecture:** 

```mermaid
flowchart LR
  subgraph Obsidian
    A[Markdown Editor] -->|```quantum ...```| B[Plugin parser]
    B --> C[AST of circuit]
    C --> D[SVG Renderer (JS lib or custom)]
    D --> E[DOM SVG inserted]
  end
  style A fill:#f9f,stroke:#333,stroke-width:2px
  style B fill:#9cf,stroke:#333,stroke-width:2px
  style C fill:#ccf,stroke:#333,stroke-width:2px
  style D fill:#cfc,stroke:#333,stroke-width:2px
  style E fill:#fcf,stroke:#333,stroke-width:2px
``` 

*Fig: Plugin flow – Markdown block → Parser → AST → Renderer → SVG in preview.*  

## References

- [12] Obsidian Docs, "Build a plugin" and plugin basics: https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin
- [14] Obsidian sample plugin repository and release process: https://github.com/obsidianmd/obsidian-sample-plugin
- [15] Obsidian plugin release guidelines and security notes: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- [19] neuralsorcerer/quantum-circuit-drawer repository (features, usage, license): https://github.com/neuralsorcerer/quantum-circuit-drawer
- [21] Microsoft Azure Quantum concepts for circuits and notation context: https://learn.microsoft.com/azure/quantum/concepts-circuits
- [29] IBM Quantum bit-ordering and circuit representation conventions: https://quantum.cloud.ibm.com/docs/guides/bit-ordering
- [31] IBM Quantum / Qiskit circuit visualization docs: https://quantum.cloud.ibm.com/docs/guides/visualize-circuits
- [33] Qiskit API docs (QuantumCircuit and related references): https://quantum.cloud.ibm.com/docs/api/qiskit/qiskit.circuit.QuantumCircuit
- [34] Qiskit license text (Apache-2.0): https://github.com/Qiskit/qiskit/blob/main/LICENSE.txt
- [38] Obsidian editor extension docs (CodeMirror integration context): https://docs.obsidian.md/Plugins/Editor/Editor+extensions
- [41] Obsidian sample plugin CI workflow examples: https://github.com/obsidianmd/obsidian-sample-plugin/tree/master/.github/workflows
- [43] Strilanc/Quirk repository (capabilities and license): https://github.com/Strilanc/Quirk
- [46] Mermaid issue discussing quantum-circuit syntax proposal: https://github.com/mermaid-js/mermaid/issues/1597