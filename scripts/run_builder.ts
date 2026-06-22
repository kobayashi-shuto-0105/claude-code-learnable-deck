import "dotenv/config";
import { existsSync } from "node:fs";
import { basename } from "node:path";
import { getNumberArg, getArg } from "../src/args.js";
import { createSlide, normalizeDeck } from "../src/deck-utils.js";
import { deckPath, readJson, readText, writeJson, writeText } from "../src/io.js";
import { describeRoundPolicy, getRoundPolicy } from "../src/round-policy.js";
import { DeckSpecSchema, type DeckSpec } from "../src/schema.js";

function splitSentences(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/(?<=[.!?。！？])\s+|\n{2,}/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 20);
}

function initialDeck(deckId: string, inputPath: string, audience: string, duration: number, targetSlides: number): DeckSpec {
  const source = readText(inputPath, `# ${deckId}\n\nNo input text was found. Add source content to ${inputPath}.`);
  const sentences = splitSentences(source);
  const title = basename(inputPath).replace(/\.[^.]+$/, "") || deckId;
  const bodySlides = Math.max(3, targetSlides - 2);
  const selected = sentences.slice(0, bodySlides);

  const slides = [
    createSlide("s01", title, `This deck explains ${title} for ${audience}.`, [
      "Problem and motivation",
      "Core idea",
      "Result and takeaway"
    ]),
    ...selected.map((sentence, index) => {
      const id = `s${String(index + 2).padStart(2, "0")}`;
      const titleText = sentence.slice(0, 70).replace(/[。.!?]$/, "");
      return createSlide(id, titleText, sentence, []);
    }),
    createSlide(`s${String(selected.length + 2).padStart(2, "0")}`, "Summary", `The key takeaway is that ${title} can be understood through problem, method, evidence, and limitation.`, [
      "Start from the problem",
      "Explain the method visually",
      "End with evidence and limits"
    ])
  ];

  return normalizeDeck({
    deck_id: deckId,
    title,
    audience,
    goal: `Explain the source material to ${audience} in ${duration} minutes.`,
    duration_minutes: duration,
    target_slide_count: targetSlides,
    slides
  });
}

function reviseDeck(deck: DeckSpec, round: number, maxRounds: number): DeckSpec {
  const policy = getRoundPolicy(round, maxRounds);
  const revised = normalizeDeck(deck);

  for (const slide of revised.slides) {
    if (policy === "structure") {
      slide.role = slide.id === "s01" ? "title" : slide.role;
      slide.message = slide.message.replace(/^This slide explains /, "");
    }

    if (policy === "professor_questions") {
      if (!slide.speaker_notes.includes("Professor check")) {
        slide.speaker_notes += `\n\nProfessor check: clarify why this message matters for the audience.`;
      }
    }

    if (policy === "slide_ordering") {
      slide.title = slide.title.length > 72 ? `${slide.title.slice(0, 69)}...` : slide.title;
    }

    if (policy === "visual_explanation") {
      slide.visual = {
        type: slide.visual.type === "text" ? "concept_diagram" : slide.visual.type,
        description: slide.visual.description || `Show a simple visual for: ${slide.message}`
      };
    }

    if (policy === "source_fidelity") {
      if (slide.source_refs.length === 0) {
        slide.source_refs.push({ section: "source", locator: "extracted.md" });
      }
      slide.message = slide.message.replace(/clearly proves/gi, "suggests");
    }

    if (policy === "compression") {
      slide.bullets = slide.bullets.slice(0, 3).map((bullet) => bullet.slice(0, 90));
      if (slide.message.length > 180) slide.message = `${slide.message.slice(0, 177)}...`;
    }

    if (policy === "polish") {
      slide.title = slide.title.trim();
      slide.message = slide.message.trim();
      slide.bullets = slide.bullets.map((bullet) => bullet.trim()).filter(Boolean);
    }
  }

  return revised;
}

function main() {
  const deckId = getArg("deck", "sample")!;
  const input = getArg("input", deckPath(deckId, "source", "extracted.md"))!;
  const round = getNumberArg("round", 0);
  const maxRounds = getNumberArg("max-rounds", Number(process.env.LLD_DEFAULT_MAX_ROUNDS || 50));
  const audience = getArg("audience", process.env.LLD_AUDIENCE || "information science undergraduate")!;
  const duration = getNumberArg("duration", Number(process.env.LLD_DURATION_MINUTES || 15));
  const targetSlides = getNumberArg("slides", Number(process.env.LLD_TARGET_SLIDE_COUNT || 12));

  const deckSpecPath = deckPath(deckId, "working", "deck_spec.json");
  let deck: DeckSpec;

  if (round === 0 || !existsSync(deckSpecPath)) {
    deck = initialDeck(deckId, input, audience, duration, targetSlides);
  } else {
    deck = reviseDeck(DeckSpecSchema.parse(readJson(deckSpecPath)), round, maxRounds);
  }

  writeJson(deckSpecPath, DeckSpecSchema.parse(deck));
  writeText(
    deckPath(deckId, "working", "builder_memory.md"),
    `${readText(deckPath(deckId, "working", "builder_memory.md"))}\n\n## Round ${round}\n\nPolicy: ${getRoundPolicy(round, maxRounds)}\n\n${describeRoundPolicy(getRoundPolicy(round, maxRounds))}\n`
  );
}

main();
