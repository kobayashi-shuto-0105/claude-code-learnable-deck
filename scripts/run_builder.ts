import "dotenv/config";
import { existsSync } from "node:fs";
import { basename } from "node:path";
import { getNumberArg, getArg, getOptionalNumberArg } from "../src/args.js";
import { runClaude, parseClaudeJson, shouldFallbackOnClaudeError } from "../src/claude.js";
import { createSlide, normalizeDeck } from "../src/deck-utils.js";
import { deckPath, readJson, readText, writeJson, writeText, appendJsonl } from "../src/io.js";
import { describeRoundPolicy, getRoundPolicy } from "../src/round-policy.js";
import { DeckSpecSchema, type DeckSpec } from "../src/schema.js";

function splitSentences(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/(?<=[.!?。！？])\s+|\n{2,}/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 20);
}

function estimateSlideCount(sourceText: string, duration: number): number {
  const words = sourceText.split(/\s+/).filter(Boolean).length;
  const byLength = Math.ceil(words / 180) + 3;
  const byDuration = Math.max(6, Math.min(18, duration));
  return Math.max(6, Math.min(18, Math.round((byLength + byDuration) / 2)));
}

function envOptionalNumber(name: string): number | undefined {
  const value = process.env[name];
  if (!value || value === "auto") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isJapanese(language: string): boolean {
  return language === "ja" || language === "jp" || language === "Japanese" || language === "日本語";
}

function initialDeck(deckId: string, inputPath: string, audience: string, duration: number, targetSlides: number | undefined, language: string): DeckSpec {
  const source = readText(inputPath, `# ${deckId}\n\nNo input text was found. Add source content to ${inputPath}.`);
  const sentences = splitSentences(source);
  const title = basename(inputPath).replace(/\.[^.]+$/, "") || deckId;
  const slideCount = targetSlides ?? estimateSlideCount(source, duration);
  const bodySlides = Math.max(3, slideCount - 2);
  const selected = sentences.slice(0, bodySlides);
  const ja = isJapanese(language);

  const slides = [
    createSlide(
      "s01",
      ja ? `${title} の概要` : title,
      ja ? `${title} を${audience}向けに理解しやすく説明する。` : `This deck explains ${title} for ${audience}.`,
      ja ? ["問題意識", "中核アイデア", "結果と限界"] : ["Problem and motivation", "Core idea", "Result and takeaway"],
      language
    ),
    ...selected.map((sentence, index) => {
      const id = `s${String(index + 2).padStart(2, "0")}`;
      const titleText = sentence.slice(0, ja ? 32 : 70).replace(/[。.!?]$/, "");
      return createSlide(id, titleText, sentence, [], language);
    }),
    createSlide(
      `s${String(selected.length + 2).padStart(2, "0")}`,
      ja ? "まとめ" : "Summary",
      ja ? `${title} は、問題、手法、根拠、限界の順に整理すると理解しやすい。` : `The key takeaway is that ${title} can be understood through problem, method, evidence, and limitation.`,
      ja ? ["問題から入る", "図解で仕組みを説明する", "根拠と限界で締める"] : ["Start from the problem", "Explain the method visually", "End with evidence and limits"],
      language
    )
  ];

  return normalizeDeck({
    deck_id: deckId,
    title,
    audience,
    language,
    goal: ja ? `${audience}が${duration}分で資料の要点を説明できるようにする。` : `Explain the source material to ${audience} in ${duration} minutes.`,
    duration_minutes: duration,
    target_slide_count: targetSlides,
    slides
  });
}

function reviseDeck(deck: DeckSpec, round: number, maxRounds: number, language: string): DeckSpec {
  const policy = getRoundPolicy(round, maxRounds);
  const revised = normalizeDeck({ ...deck, language });
  const ja = isJapanese(language);

  for (const slide of revised.slides) {
    if (policy === "structure") {
      slide.role = slide.id === "s01" ? "title" : slide.role;
      slide.message = slide.message.replace(/^This slide explains /, "");
    }
    if (policy === "professor_questions" && !slide.speaker_notes.includes(ja ? "教授チェック" : "Professor check")) {
      slide.speaker_notes += ja
        ? `\n\n教授チェック: このメッセージが学習者にとってなぜ重要かを説明する。`
        : `\n\nProfessor check: clarify why this message matters for the audience.`;
    }
    if (policy === "slide_ordering") {
      slide.title = slide.title.length > 72 ? `${slide.title.slice(0, 69)}...` : slide.title;
    }
    if (policy === "visual_explanation") {
      slide.visual = {
        type: slide.visual.type === "text" ? "concept_diagram" : slide.visual.type,
        description: slide.visual.description || (ja ? `次の中心メッセージを支える図解: ${slide.message}` : `Show a simple visual for: ${slide.message}`)
      };
    }
    if (policy === "source_fidelity") {
      if (slide.source_refs.length === 0) slide.source_refs.push({ section: "source", locator: "extracted.md" });
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

function buildClaudePrompt(args: {
  deckId: string;
  inputPath: string;
  round: number;
  maxRounds: number;
  audience: string;
  language: string;
  duration: number;
  targetSlides: number | undefined;
  currentDeck: DeckSpec | null;
}): string {
  const policy = getRoundPolicy(args.round, args.maxRounds);
  const source = readText(args.inputPath).slice(0, Number(process.env.LLD_MAX_SOURCE_CHARS || 20000));
  const critique = readText(deckPath(args.deckId, "working", "critique_rounds.jsonl")).slice(-12000);
  const verifier = readText(deckPath(args.deckId, "working", "verifier_reports.jsonl")).slice(-8000);
  const builderMemory = readText(deckPath(args.deckId, "working", "builder_memory.md")).slice(-8000);
  const slideCountInstruction = args.targetSlides
    ? `Target slide count: ${args.targetSlides}. Keep the final slide count near this number.`
    : "Slide count mode: auto. Decide the number of slides from the source complexity and duration. Do not force a fixed count. Prefer enough slides for clarity over dense slides.";

  return `You are the Slide Builder for Claude Code Learnable Deck.

Return only valid JSON matching this TypeScript-like shape:
{
  "deck_id": string,
  "title": string,
  "audience": string,
  "language": string,
  "goal": string,
  "duration_minutes": number,
  "target_slide_count"?: number,
  "slides": [
    {
      "id": string,
      "role": string,
      "title": string,
      "message": string,
      "bullets": string[],
      "visual": { "type": string, "description": string },
      "speaker_notes": string,
      "source_refs": [{ "file"?: string, "page"?: number, "section"?: string, "locator"?: string, "quote"?: string }]
    }
  ]
}

Language requirement:
- Output slide titles, central messages, bullets, visual descriptions, and speaker notes in ${args.language}.
- If ${args.language} is ja/Japanese/日本語, write natural Japanese slides.
- Keep technical terms such as ReAct, LLM, IP-to-Shell, PTT, Metasploit, and shell in English when that is clearer.
- Do not output English slides unless explicitly requested.

Role:
- You are not a generic summarizer.
- Reconstruct the source into a learner-friendly sequence.
- Do not blindly follow the source order when a clearer learning path is possible.

Deck rules:
- One slide has one central message.
- Use at most 3 visible bullets per slide.
- Keep each slide visually sparse.
- Prefer assertion-evidence structure: message states the claim, visual/body supports it.
- Prefer diagrams, comparisons, process flows, toy examples, and annotated charts over dense prose.
- Add speaker notes that teach the idea instead of repeating visible text.
- Add source_refs when possible.
- Do not invent unsupported facts.
- Mark interpretation separately from source-backed facts.
- ${slideCountInstruction}

Learning path preference:
1. learning goal
2. problem / motivation
3. prerequisite or definition
4. core idea
5. concrete example
6. mechanism or process
7. result / evidence
8. interpretation
9. limitation / scope
10. check question / recap

Cognitive-load rules:
- Put related labels near the visual element they explain.
- Avoid forcing the reader to jump between distant legends, notes, and charts.
- Use short wording and avoid slide paragraphs.
- For Japanese slides, prefer short readable wording and avoid kanji-heavy dense sentences.

Critique handling:
- Treat recent Professor Critic items as edit requirements.
- Satisfy acceptance criteria by improving structure, examples, visuals, notes, or source grounding.
- Do not simply add more visible text to satisfy a critique.

Current run:
Deck ID: ${args.deckId}
Audience: ${args.audience}
Language: ${args.language}
Duration minutes: ${args.duration}
${slideCountInstruction}
Round: ${args.round}/${args.maxRounds}
Round policy: ${policy}
Policy description: ${describeRoundPolicy(policy)}

Source excerpt:
${source}

Current DeckSpec JSON:
${args.currentDeck ? JSON.stringify(args.currentDeck, null, 2) : "null"}

Recent professor critique:
${critique || "none"}

Recent verifier reports:
${verifier || "none"}

Builder memory:
${builderMemory || "none"}
`;
}

function tryClaudeDeck(prompt: string, deckId: string, round: number): DeckSpec | null {
  const result = runClaude("builder", prompt);
  if (!result) return null;

  appendJsonl(deckPath(deckId, "working", "claude_runs.jsonl"), {
    role: "builder",
    round,
    ok: result.ok,
    status: result.status,
    model: result.model,
    stderr: result.stderr.slice(0, 2000)
  });

  if (!result.ok) {
    if (shouldFallbackOnClaudeError()) return null;
    throw new Error(`Claude builder failed: ${result.stderr}`);
  }

  const parsed = parseClaudeJson<unknown>(result.stdout);
  const deck = DeckSpecSchema.safeParse(parsed);
  if (!deck.success) {
    if (shouldFallbackOnClaudeError()) return null;
    throw new Error(`Claude builder returned invalid DeckSpec: ${deck.error.message}`);
  }

  return normalizeDeck(deck.data);
}

function main() {
  const deckId = getArg("deck", "sample")!;
  const input = getArg("input", deckPath(deckId, "source", "extracted.md"))!;
  const round = getNumberArg("round", 0);
  const maxRounds = getNumberArg("max-rounds", Number(process.env.LLD_DEFAULT_MAX_ROUNDS || 50));
  const audience = getArg("audience", process.env.LLD_AUDIENCE || "日本語で学ぶセキュリティエンジニア")!;
  const language = getArg("language", process.env.LLD_OUTPUT_LANGUAGE || "ja")!;
  const duration = getNumberArg("duration", Number(process.env.LLD_DURATION_MINUTES || 15));
  const targetSlides = getOptionalNumberArg("slides") ?? envOptionalNumber("LLD_TARGET_SLIDE_COUNT");

  const deckSpecPath = deckPath(deckId, "working", "deck_spec.json");
  const currentDeck = existsSync(deckSpecPath) ? DeckSpecSchema.parse(readJson(deckSpecPath)) : null;
  const prompt = buildClaudePrompt({ deckId, inputPath: input, round, maxRounds, audience, language, duration, targetSlides, currentDeck });
  let deck = tryClaudeDeck(prompt, deckId, round);

  if (!deck) {
    deck = round === 0 || !currentDeck ? initialDeck(deckId, input, audience, duration, targetSlides, language) : reviseDeck(currentDeck, round, maxRounds, language);
  }

  writeJson(deckSpecPath, DeckSpecSchema.parse(deck));
  writeText(
    deckPath(deckId, "working", "builder_memory.md"),
    `${readText(deckPath(deckId, "working", "builder_memory.md"))}\n\n## Round ${round}\n\nPolicy: ${getRoundPolicy(round, maxRounds)}\n\n${describeRoundPolicy(getRoundPolicy(round, maxRounds))}\n`
  );
}

main();
