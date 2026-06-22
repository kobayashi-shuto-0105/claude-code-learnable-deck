import "dotenv/config";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getArg } from "../src/args.js";
import { copyIfExists, deckPath, readText, writeText } from "../src/io.js";
import type { RoundScore } from "../src/schema.js";

function readScores(deckId: string): RoundScore[] {
  const path = deckPath(deckId, "working", "round_scores.jsonl");
  if (!existsSync(path)) return [];
  return readText(path)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RoundScore);
}

function total(score: RoundScore): number {
  return (
    (score.scores.render_pass ? 2 : 0) +
    score.scores.source_fidelity +
    score.scores.readability +
    score.scores.structure -
    score.critical_issues * 2 -
    score.warnings * 0.05
  );
}

function main() {
  const deckId = getArg("deck", "sample")!;
  const scores = readScores(deckId).filter((score) => score.scores.render_pass);
  let bestRound = scores.sort((a, b) => total(b) - total(a))[0]?.round ?? 0;

  const snapshotDir = deckPath(deckId, "snapshots", `round-${String(bestRound).padStart(3, "0")}`);
  if (!existsSync(snapshotDir)) {
    const snapshots = readdirSync(deckPath(deckId, "snapshots"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("round-"))
      .map((entry) => entry.name)
      .sort();
    const last = snapshots.at(-1);
    if (last) bestRound = Number(last.replace("round-", ""));
  }

  const source = deckPath(deckId, "snapshots", `round-${String(bestRound).padStart(3, "0")}`);
  copyIfExists(join(source, "deck_spec.json"), deckPath(deckId, "final", "deck_spec.json"));
  copyIfExists(deckPath(deckId, "render", "slides.md"), deckPath(deckId, "final", "slides.md"));
  copyIfExists(deckPath(deckId, "render", "slides.pdf"), deckPath(deckId, "final", "slides.pdf"));
  copyIfExists(deckPath(deckId, "render", "slides.pptx"), deckPath(deckId, "final", "slides.pptx"));

  writeText(deckPath(deckId, "reports", "final_summary.md"), `# Final Summary\n\nSelected round: ${bestRound}\n\nSelection used configured round scores and available snapshots.\n`);
}

main();
