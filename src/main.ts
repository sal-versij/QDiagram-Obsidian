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
      const svgMarkup = renderCircuitSvg(ast);
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgMarkup, "image/svg+xml");
      const svgEl = svgDoc.documentElement;

      if (svgEl.tagName.toLowerCase() !== "svg") {
        throw new Error("Failed to render SVG output.");
      }

      container.appendChild(document.importNode(svgEl, true));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown parse/render error";
      container.createDiv({
        cls: "quantum-circuit-error",
        text: `Quantum circuit error: ${message}`
      });
    }
  }
}
