import "dotenv/config";
import { getNumberArg, getArg } from "../src/args.js";
import { runClaude, parseClaudeJson, shouldFallbackOnClaudeError } from "../src/claude.js";
import { deckPath, appendJsonl, readJson, readText, writeText } from "../src/io.js";
import { CritiqueQuestionSchema, DeckSpecSchema, type CritiqueQuestion } from "../src/schema.js";

function normalizeQuestions(value: unknown, round: number): CritiqueQuestion[] | null {
  const raw = Array.isArray(value) ? value : (value as { questions?: unknown[] })?.questions;
  if (!Array.isArray(raw)) return null;

  const questions: CritiqueQuestion[] = [];
  for (const item of raw.slice(0, 5)) {
    const parsed = CritiqueQuestionSchema.safeParse({ ...(item as object), round });
    if (parsed.success) questions.push(parsed.data);
  }
  return questions.length > 0 ? questions : null;
}

function makeFallbackQuestions(deckId: string, round: number): CritiqueQuestion[] {
  const deck = DeckSpecSchema.parse(readJson(deckPath(deckId, "working", "deck_spec.json")));
  const questions: CritiqueQuestion[] = [];

  for (const slide of deck.slides) {
    if (questions.length >= 5) break;

    if (slide.bullets.length > 3) {
      questions.push({
        id: `q-${String(round).padStart(3, "0")}-${String(questions.length + 1).padStart(2, "0")}`,
        round,
        severity: "major",
        slide_id: slide.id,
        type: "too_dense",
        question: "This slide has too many bullets. Can the explanation be split or compressed?",
        expected_fix: "Keep at most three short bullets and one central message."
      });
    }

    if (!slide.speaker_notes.trim()) {
      questions.push({
        id: `q-${String(round).padStart(3, "0")}-${String(questions.length + 1).padStart(2, "0")}`,
        round,
        severity: "major",
        slide_id: slide.id,
        type: "missing_prerequisite",
        question: "The speaker notes do not explain how to teach this slide. What should the presenter say?",
        expected_fix: "Add speaker notes with a concrete explanation path."
      });
    }

    if (slide.source_refs.length === 0) {
      questions.push({
        id: `q-${String(round).padStart(3, "0")}-${String(questions.length + 1).padStart(2, "0")}`,
        round,
        severity: "critical",
        slide_id: slide.id,
        type: "unsupported_claim",
        question: "This slide has no source reference. What source supports the central claim?",
        expected_fix: "Add source_refs or weaken the claim."
      });
    }

    if (!slide.visual.description.trim()) {
      questions.push({
        id: `q-${String(round).padStart(3, "0")}-${String(questions.length + 1).padStart(2, "0")}`,
        round,
        severity: "minor",
        slide_id: slide.id,
        type: "visual_confusion",
        question: "The slide does not describe what visual would help the learner. What should be shown?",
        expected_fix: "Add a visual description tied to the slide message."
      });
    }
  }

  if (questions.length === 0) {
    questions.push({
      id: `q-${String(round).padStart(3, "0")}-01`,
      round,
      severity: "minor",
      type: "weak_example",
      question: "Can one slide be made more concrete with a small example or analogy?",
      expected_fix: "Add one example where it improves learner understanding without increasing density."
    });
  }

  return questions.slice(0, 5);
}

function buildCriticPrompt(deckId: string, round: number): string {
  const deck = readText(deckPath(deckId, "working", "deck_spec.json")).slice(0, 30000);
  const professorMemory = readText(deckPath(deckId, "working", "professor_memory.md")).slice(-8000);
  const verifier = readText(deckPath(deckId, "working", "verifier_reports.jsonl")).slice(-8000);

  return `You are Professor Critic for a learnable slide deck.

Return only valid JSON in this form:
{
  "questions": [
    {
      "id": "q-${String(round).padStart(3, "0")}-01",
      "round": ${round},
      "severity": "critical" | "major" | "minor",
      "slide_id": "s01",
      "type": "missing_prerequisite" | "causal_gap" | "undefined_term" | "too_dense" | "weak_example" | "unsupported_claim" | "bad_order" | "visual_confusion" | "result_interpretation_missing" | "audience_mismatch",
      "question": string,
      "expected_fix": string
    }
  ]
}

Rules:
- Ask at most 5 questions.
- Do not rewrite the deck.
- Do not repeat resolved questions from professor memory.
- Prefer questions that reveal learner confusion.
- Use specific slide_id when possible.

DeckSpec:
${deck}

Professor memory:
${professorMemory || "none"}

Verifier reports:
${verifier || "none"}
`;
}

function tryClaudeQuestions(deckId: string, round: number): CritiqueQuestion[] | null {
  const result = runClaude("critic", buildCriticPrompt(deckId, round));
  if (!result) return null;

  appendJsonl(deckPath(deckId, "working", "claude_runs.jsonl"), {
    role: "critic",
    round,
    ok: result.ok,
    status: result.status,
    model: result.model,
    stderr: result.stderr.slice(0, 2000)
  });

  if (!result.ok) {
    if (shouldFallbackOnClaudeError()) return null;
    throw new Error(`Claude critic failed: ${result.stderr}`);
  }

  const parsed = parseClaudeJson<unknown>(result.stdout);
  const questions = normalizeQuestions(parsed, round);
  if (!questions) {
    if (shouldFallbackOnClaudeError()) return null;
    throw new Error("Claude critic returned invalid critique JSON");
  }
  return questions;
}

function main() {
  const deckId = getArg("deck", "sample")!;
  const round = getNumberArg("round", 0);
  const questions = tryClaudeQuestions(deckId, round) ?? makeFallbackQuestions(deckId, round);

  for (const question of questions) {
    appendJsonl(deckPath(deckId, "working", "critique_rounds.jsonl"), question);
  }

  const memoryPath = deckPath(deckId, "working", "professor_memory.md");
  const previous = readText(memoryPath, "# Professor Memory\n");
  const added = questions.map((q) => `- ${q.id}: ${q.question}`).join("\n");
  writeText(memoryPath, `${previous}\n\n## Round ${round}\n\n${added}\n`);
}

main();
