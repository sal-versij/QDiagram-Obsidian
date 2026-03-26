import { Plugin } from "obsidian";
import { parseCircuitDsl } from "./parser";
import { renderCircuitSvg } from "./renderer";

export default class QDiagramPlugin extends Plugin {
  async onload(): Promise<void> {
    this.registerMarkdownCodeBlockProcessor("quantum", (source, el) => {
      this.renderBlock(source, el);
    });

    this.registerMarkdownCodeBlockProcessor("qcircuit", (source, el) => {
      this.renderBlock(source, el);
    });
  }

  private renderBlock(source: string, el: HTMLElement): void {
    const container = el.createDiv({ cls: "quantum-circuit-container" });

    try {
      const ast = parseCircuitDsl(source);
      container.innerHTML = renderCircuitSvg(ast);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown parse/render error";
      container.createDiv({
        cls: "quantum-circuit-error",
        text: `Quantum circuit error: ${message}`
      });
    }
  }
}
