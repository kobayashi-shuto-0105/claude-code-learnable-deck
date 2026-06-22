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
      const slidesWithConcreteCue = parsed.data.slides.filter((slide) =>
        /example|具体|例|case|input|output|toy|quiz|check|確認|問い/i.test(
          `${slide.title} ${slide.message} ${slide.bullets.join(" ")} ${slide.speaker_notes}`
        )
      ).length;
      const slidesWithWhyHowCue = parsed.data.slides.filter((slide) =>
        /why|how|なぜ|どう|仕組み|原因|結果|therefore|because/i.test(
          `${slide.title} ${slide.message} ${slide.bullets.join(" ")} ${slide.speaker_notes}`
        )
      ).length;

      for (const slide of parsed.data.slides) {
        if (ids.has(slide.id)) report.errors.push(`duplicate slide id: ${slide.id}`);
        ids.add(slide.id);

        if (slide.bullets.length > 3) report.warnings.push(`${slide.id}: more than 3 bullets`);
        if (slide.title.length > 80) report.warnings.push(`${slide.id}: title may be too long for quick scanning`);
        if (slide.message.length > 180) report.warnings.push(`${slide.id}: central message may be too dense`);
        if (!slide.speaker_notes.trim()) report.warnings.push(`${slide.id}: missing speaker notes`);
        if (slide.source_refs.length === 0) report.warnings.push(`${slide.id}: missing source refs`);
        if (!slide.visual.description.trim()) report.warnings.push(`${slide.id}: missing visual description`);
        if (slide.visual.description && !slide.visual.description.toLowerCase().includes(slide.message.slice(0, 24).toLowerCase())) {
          report.warnings.push(`${slide.id}: visual description may not be aligned with the central message`);
        }
      }

      if (slidesWithConcreteCue === 0) {
        report.warnings.push("deck: no concrete example, quiz, toy input/output, or understanding-check cue was detected");
      }
      if (slidesWithWhyHowCue === 0) {
        report.warnings.push("deck: no why/how/mechanism cue was detected");
      }

      if (report.errors.length > 0) report.passed = false;
    }
  }

  appendJsonl(deckPath(deckId, "working", "verifier_reports.jsonl"), report);
  if (!report.passed) process.exit(1);
}

main();
