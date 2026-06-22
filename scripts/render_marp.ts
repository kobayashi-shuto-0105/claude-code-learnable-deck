import "dotenv/config";
import { spawnSync } from "node:child_process";
import { getArg } from "../src/args.js";
import { deckPath, ensureDir, readJson, writeText } from "../src/io.js";
import { DeckSpecSchema } from "../src/schema.js";

function escapeMd(value: string): string {
  return value.replace(/\|/g, "\\|").trim();
}

function renderSlides(deckId: string): string {
  const deck = DeckSpecSchema.parse(readJson(deckPath(deckId, "working", "deck_spec.json")));
  const slides = deck.slides.map((slide) => {
    const bullets = slide.bullets.length
      ? `\n${slide.bullets.map((bullet) => `- ${escapeMd(bullet)}`).join("\n")}`
      : "";
    const visual = slide.visual.description
      ? `\n\n> Visual: ${escapeMd(slide.visual.description)}`
      : "";
    const refs = slide.source_refs.length
      ? `\n\n<footer>Source: ${slide.source_refs
          .map((ref) => ref.section || ref.locator || ref.file || "source")
          .join(", ")}</footer>`
      : "";
    const notes = slide.speaker_notes ? `\n\n<!--\nSpeaker notes:\n${slide.speaker_notes}\n-->` : "";
    return `---\n\n# ${escapeMd(slide.title)}\n\n**${escapeMd(slide.message)}**${bullets}${visual}${refs}${notes}`;
  });

  return `---\nmarp: true\ntheme: default\npaginate: true\n---\n\n# ${escapeMd(deck.title)}\n\n${escapeMd(deck.goal)}\n\n<footer>${escapeMd(deck.audience)} / ${deck.duration_minutes} min</footer>\n\n${slides.join("\n\n")}`;
}

function main() {
  const deckId = getArg("deck", "sample")!;
  ensureDir(deckPath(deckId, "render"));
  const markdown = renderSlides(deckId);
  const slidesPath = deckPath(deckId, "render", "slides.md");
  writeText(slidesPath, markdown);

  if (process.env.LLD_RUN_MARP_EXPORT === "1") {
    spawnSync("npx", ["marp", slidesPath, "--pdf", "--pptx", "--allow-local-files"], {
      stdio: "inherit"
    });
  }
}

main();
