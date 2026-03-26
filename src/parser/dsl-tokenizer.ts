export type ChunkToken = {
  type: "chunk" | "comma" | "semi" | "lbrace" | "rbrace" | "newline";
  text?: string;
  line: number;
};

export function tokenize(source: string): ChunkToken[] {
  const tokens: ChunkToken[] = [];
  let current = "";
  let currentLine = 1;
  let line = 1;

  const flush = (): void => {
    const text = current.trim();
    if (text.length > 0) {
      tokens.push({ type: "chunk", text, line: currentLine });
    }
    current = "";
  };

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];

    if (ch === "#") {
      while (i + 1 < source.length && source[i + 1] !== "\n") {
        i += 1;
      }
      continue;
    }

    if (ch === "\r") {
      continue;
    }

    if (ch === "\n") {
      flush();
      tokens.push({ type: "newline", line });
      line += 1;
      currentLine = line;
      continue;
    }

    if (ch === "," || ch === ";" || ch === "{" || ch === "}") {
      flush();
      if (ch === ",") {
        tokens.push({ type: "comma", line });
      } else if (ch === ";") {
        tokens.push({ type: "semi", line });
      } else if (ch === "{") {
        tokens.push({ type: "lbrace", line });
      } else {
        tokens.push({ type: "rbrace", line });
      }
      currentLine = line;
      continue;
    }

    if (current.length === 0) {
      currentLine = line;
    }
    current += ch;
  }

  flush();
  return tokens;
}
