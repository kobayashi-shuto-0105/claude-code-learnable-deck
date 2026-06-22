import "dotenv/config";
import { getNumberArg, getArg } from "../src/args.js";
import { deckPath, appendJsonl, readJson, readText, writeText } from "../src/io.js";
import { DeckSpecSchema, type CritiqueQuestion } from "../src/schema.js";

function makeQuestions(deckId: string, round: number): CritiqueQuestion[] {
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

function main() {
  const deckId = getArg("deck", "sample")!;
  const round = getNumberArg("round", 0);
  const questions = makeQuestions(deckId, round);

  for (const question of questions) {
    appendJsonl(deckPath(deckId, "working", "critique_rounds.jsonl"), question);
  }

  const memoryPath = deckPath(deckId, "working", "professor_memory.md");
  const previous = readText(memoryPath, "# Professor Memory\n");
  const added = questions.map((q) => `- ${q.id}: ${q.question}`).join("\n");
  writeText(memoryPath, `${previous}\n\n## Round ${round}\n\n${added}\n`);
}

main();
