import { existsSync } from "node:fs";
import { extname } from "node:path";
import { spawnSync } from "node:child_process";
import { readText, writeText } from "./io.js";

function toText(value: string | Buffer | null | undefined): string {
  if (!value) return "";
  return typeof value === "string" ? value : value.toString("utf8");
}

function extractPdfWithPdftotext(input: string): string | null {
  const result = spawnSync("pdftotext", [input, "-"], {
    encoding: "utf8",
    maxBuffer: Number(process.env.LLD_PDF_MAX_BUFFER || 50_000_000)
  });
  if (result.status !== 0) return null;
  const text = toText(result.stdout).trim();
  return text.length > 0 ? text : null;
}

export function extractSourceToMarkdown(input: string, output: string): void {
  if (!existsSync(input)) {
    writeText(output, `# Missing input\n\nInput path was not found: ${input}\n`);
    return;
  }

  const ext = extname(input).toLowerCase();
  if (ext === ".pdf") {
    const pdfText = extractPdfWithPdftotext(input);
    if (pdfText) {
      writeText(output, `# Extracted PDF\n\nSource: ${input}\n\n${pdfText}\n`);
      return;
    }
    writeText(
      output,
      `# PDF input detected\n\nSource: ${input}\n\nPDF text extraction requires the optional \`pdftotext\` command. Install poppler utilities or provide a Markdown/text file for now.\n`
    );
    return;
  }

  writeText(output, readText(input));
}
