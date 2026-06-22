import "dotenv/config";
import { spawnSync } from "node:child_process";
import { getArg } from "../src/args.js";

function run(script: string, deckId: string): number {
  const result = spawnSync("npx", ["tsx", script, "--deck", deckId], { stdio: "inherit" });
  return result.status ?? 1;
}

function main() {
  const deckId = getArg("deck", "sample")!;
  const deckStatus = run("scripts/check_deck.ts", deckId);
  const renderStatus = run("scripts/check_render.ts", deckId);
  if (deckStatus !== 0 || renderStatus !== 0) process.exit(1);
}

main();
