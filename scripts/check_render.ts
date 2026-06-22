import "dotenv/config";
import { existsSync, statSync } from "node:fs";
import { getArg } from "../src/args.js";
import { deckPath, appendJsonl } from "../src/io.js";

function main() {
  const deckId = getArg("deck", "sample")!;
  const round = Number(getArg("round", "0"));
  const slidesPath = deckPath(deckId, "render", "slides.md");
  const passed = existsSync(slidesPath) && statSync(slidesPath).size > 0;
  appendJsonl(deckPath(deckId, "working", "verifier_reports.jsonl"), {
    round,
    check: "render",
    passed,
    errors: passed ? [] : ["render/slides.md is missing or empty"],
    warnings: []
  });
  if (!passed) process.exit(1);
}

main();
