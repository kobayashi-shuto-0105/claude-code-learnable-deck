import "dotenv/config";
import { existsSync } from "node:fs";
import { getArg } from "../src/args.js";
import { deckPath, appendJsonl, readJson } from "../src/io.js";
import { DeckSpecSchema } from "../src/schema.js";

function main() {
  const deckId = getArg("deck", "sample")!;
  const round = Number(getArg("round", "0"));
  const report = {
    round,
    check: "deck_spec",
    passed: true,
    errors: [] as string[],
    warnings: [] as string[]
  };

  const specPath = deckPath(deckId, "working", "deck_spec.json");
  if (!existsSync(specPath)) {
    report.passed = false;
    report.errors.push("deck_spec.json is missing");
  } else {
    const parsed = DeckSpecSchema.safeParse(readJson(specPath));
    if (!parsed.success) {
      report.passed = false;
      report.errors.push("deck_spec.json does not match the schema");
    } else {
      const ids = new Set<string>();
      for (const slide of parsed.data.slides) {
        if (ids.has(slide.id)) report.errors.push(`duplicate slide id: ${slide.id}`);
        ids.add(slide.id);
        if (slide.bullets.length > 3) report.warnings.push(`${slide.id}: more than 3 bullets`);
        if (!slide.speaker_notes.trim()) report.warnings.push(`${slide.id}: missing speaker notes`);
        if (slide.source_refs.length === 0) report.warnings.push(`${slide.id}: missing source refs`);
      }
      if (report.errors.length > 0) report.passed = false;
    }
  }

  appendJsonl(deckPath(deckId, "working", "verifier_reports.jsonl"), report);
  if (!report.passed) process.exit(1);
}

main();
