import "dotenv/config";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { getArg, getNumberArg } from "../src/args.js";
import { scoreDeck } from "../src/deck-utils.js";
import { copyIfExists, deckPath, ensureDir, readJson, readText, writeJson, writeText, appendJsonl, nowIso } from "../src/io.js";
import { extractSourceToMarkdown } from "../src/input.js";
import { resolveRoleModel } from "../src/model-config.js";
import { getRoundPolicy } from "../src/round-policy.js";
import { DeckSpecSchema } from "../src/schema.js";

function runScript(script: string, args: string[] = [], allowFailure = false): boolean {
  const result = spawnSync("npx", ["tsx", script, ...args], { stdio: "inherit" });
  const ok = result.status === 0;
  if (!ok && !allowFailure) process.exit(result.status ?? 1);
  return ok;
}

function initDirs(deckId: string): void {
  for (const dir of ["source", "working", "render", "snapshots", "final", "reports"]) {
    ensureDir(deckPath(deckId, dir));
  }
}

function initSource(deckId: string, input: string): string {
  const extracted = deckPath(deckId, "source", "extracted.md");
  extractSourceToMarkdown(input, extracted);
  return extracted;
}

function saveSnapshot(deckId: string, round: number): void {
  const dir = deckPath(deckId, "snapshots", `round-${String(round).padStart(3, "0")}`);
  ensureDir(dir);
  copyIfExists(deckPath(deckId, "working", "deck_spec.json"), join(dir, "deck_spec.json"));
  copyIfExists(deckPath(deckId, "render", "slides.md"), join(dir, "slides.md"));
  copyIfExists(deckPath(deckId, "render", "slides.pdf"), join(dir, "slides.pdf"));
  copyIfExists(deckPath(deckId, "render", "slides.pptx"), join(dir, "slides.pptx"));
}

function main() {
  const deckId = getArg("deck", "sample")!;
  const input = getArg("input", "examples/sample.md")!;
  const maxRounds = getNumberArg("rounds", Number(process.env.LLD_DEFAULT_MAX_ROUNDS || 50));
  const audience = getArg("audience", process.env.LLD_AUDIENCE || "information science undergraduate")!;
  const duration = getNumberArg("duration", Number(process.env.LLD_DURATION_MINUTES || 15));
  const slides = getNumberArg("slides", Number(process.env.LLD_TARGET_SLIDE_COUNT || 12));

  initDirs(deckId);
  const extracted = initSource(deckId, input);

  writeJson(deckPath(deckId, "working", "run_config.json"), {
    deck_id: deckId,
    input,
    extracted,
    audience,
    duration_minutes: duration,
    target_slide_count: slides,
    stop_mode: "fixed_rounds",
    max_rounds: maxRounds,
    builder_model: resolveRoleModel("builder"),
    critic_model: resolveRoleModel("critic")
  });

  for (let round = 0; round < maxRounds; round++) {
    const policy = getRoundPolicy(round, maxRounds);
    writeJson(deckPath(deckId, "working", "run_state.json"), {
      deck_id: deckId,
      round,
      max_rounds: maxRounds,
      policy,
      phase: "builder",
      updated_at: nowIso(),
      completed: false
    });

    runScript("scripts/run_builder.ts", [
      "--deck", deckId,
      "--input", extracted,
      "--round", String(round),
      "--max-rounds", String(maxRounds),
      "--audience", audience,
      "--duration", String(duration),
      "--slides", String(slides)
    ]);

    writeJson(deckPath(deckId, "working", "run_state.json"), {
      deck_id: deckId,
      round,
      max_rounds: maxRounds,
      policy,
      phase: "render",
      updated_at: nowIso(),
      completed: false
    });
    runScript("scripts/render_marp.ts", ["--deck", deckId]);

    writeJson(deckPath(deckId, "working", "run_state.json"), {
      deck_id: deckId,
      round,
      max_rounds: maxRounds,
      policy,
      phase: "critic",
      updated_at: nowIso(),
      completed: false
    });
    runScript("scripts/run_critic.ts", ["--deck", deckId, "--round", String(round)]);

    writeJson(deckPath(deckId, "working", "run_state.json"), {
      deck_id: deckId,
      round,
      max_rounds: maxRounds,
      policy,
      phase: "verify",
      updated_at: nowIso(),
      completed: false
    });
    const deckOk = runScript("scripts/check_deck.ts", ["--deck", deckId, "--round", String(round)], true);
    const renderOk = runScript("scripts/check_render.ts", ["--deck", deckId, "--round", String(round)], true);

    const deck = DeckSpecSchema.parse(readJson(deckPath(deckId, "working", "deck_spec.json")));
    const scores = scoreDeck(deck, deckOk && renderOk);
    const warnings = readText(deckPath(deckId, "working", "verifier_reports.jsonl"))
      .split("\n")
      .filter((line) => line.includes(`"round":${round}`) && line.includes("warnings"))
      .length;

    appendJsonl(deckPath(deckId, "working", "round_scores.jsonl"), {
      round,
      scores,
      critical_issues: deckOk && renderOk ? 0 : 1,
      warnings,
      candidate_for_final: deckOk && renderOk
    });

    saveSnapshot(deckId, round);
  }

  writeJson(deckPath(deckId, "working", "run_state.json"), {
    deck_id: deckId,
    round: maxRounds,
    max_rounds: maxRounds,
    phase: "select_best_round",
    updated_at: nowIso(),
    completed: false
  });
  runScript("scripts/select_best_round.ts", ["--deck", deckId]);

  writeJson(deckPath(deckId, "working", "run_state.json"), {
    deck_id: deckId,
    round: maxRounds,
    max_rounds: maxRounds,
    phase: "done",
    updated_at: nowIso(),
    completed: true
  });

  writeText(deckPath(deckId, "reports", "loop_report.md"), `# Loop Report\n\nDeck: ${deckId}\n\nConfigured rounds: ${maxRounds}\n\nCompleted at: ${nowIso()}\n`);
}

main();
