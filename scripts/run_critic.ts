import "dotenv/config";
import { getNumberArg, getArg } from "../src/args.js";
import { runClaude, parseClaudeJson, shouldFallbackOnClaudeError } from "../src/claude.js";
import { deckPath, appendJsonl, readJson, readText, writeText } from "../src/io.js";
import {
  CritiqueQuestionSchema,
  DeckSpecSchema,
  type CritiqueQuestion,
  type CritiqueType,
  type ReviewLens,
  type Slide
} from "../src/schema.js";

type Severity = CritiqueQuestion["severity"];

const MAX_QUESTIONS_PER_ROUND = 6;

function questionId(round: number, index: number): string {
  return `q-${String(round).padStart(3, "0")}-${String(index).padStart(2, "0")}`;
}

function normalizeQuestions(value: unknown, round: number): CritiqueQuestion[] | null {
  const raw = Array.isArray(value) ? value : (value as { questions?: unknown[] })?.questions;
  if (!Array.isArray(raw)) return null;

  const questions: CritiqueQuestion[] = [];
  for (const item of raw.slice(0, MAX_QUESTIONS_PER_ROUND)) {
    const normalized = { ...(item as Record<string, unknown>), round };
    if (typeof normalized.expected_fix === "string") {
      normalized.expected_fix = { action: normalized.expected_fix, acceptance_criteria: [] };
    }
    const parsed = CritiqueQuestionSchema.safeParse(normalized);
    if (parsed.success) questions.push(parsed.data);
  }
  return questions.length > 0 ? questions : null;
}

function hasCausalCue(value: string): boolean {
  return /because|therefore|why|how|mechanism|process|cause|effect|なぜ|どう|仕組み|原因|結果/i.test(value);
}

function hasConcreteCue(value: string): boolean {
  return /example|case|toy|input|output|具体|例|たとえば/i.test(value);
}

function hasChartCue(slide: Slide): boolean {
  return /chart|graph|table|plot|axis|legend|result|accuracy|score|グラフ|表|結果|精度|凡例|軸/i.test(
    `${slide.title} ${slide.message} ${slide.visual.type} ${slide.visual.description}`
  );
}

function hasComparisonCue(value: string): boolean {
  return /compare|comparison|baseline|previous|before|after|vs\.?|既存|比較/i.test(value);
}

function makeQuestion(args: {
  round: number;
  slide?: Slide;
  severity: Severity;
  type: CritiqueType;
  review_lens: ReviewLens;
  target_element?: string;
  question: string;
  learner_confusion: string;
  observed_issue: string;
  action: string;
  fix_type: string;
  acceptance_criteria: string[];
  source_refs_needed?: boolean;
  cognitive_load_reason?: string;
}): CritiqueQuestion {
  return {
    id: "",
    round: args.round,
    severity: args.severity,
    slide_id: args.slide?.id,
    target_element: args.target_element,
    type: args.type,
    review_lens: args.review_lens,
    question: args.question,
    learner_confusion: args.learner_confusion,
    evidence: {
      observed_issue: args.observed_issue,
      source_refs_needed: args.source_refs_needed,
      cognitive_load_reason: args.cognitive_load_reason
    },
    expected_fix: {
      action: args.action,
      fix_type: args.fix_type,
      acceptance_criteria: args.acceptance_criteria
    }
  };
}

function pushQuestion(questions: CritiqueQuestion[], question: CritiqueQuestion): void {
  if (questions.length >= MAX_QUESTIONS_PER_ROUND) return;
  questions.push({ ...question, id: questionId(question.round, questions.length + 1) });
}

function checkSlide(slide: Slide, round: number, questions: CritiqueQuestion[]): void {
  if (slide.title.length > 80 || slide.message.length > 180) {
    pushQuestion(
      questions,
      makeQuestion({
        round,
        slide,
        severity: "major",
        type: "one_message_violation",
        review_lens: "cognitive_load_reviewer",
        target_element: slide.title.length > 80 ? "title" : "message",
        question: "Can the learner understand the central claim of this slide within a few seconds?",
        learner_confusion: "The learner may not know which idea to remember from this slide.",
        observed_issue: "The title or message is long enough to hide the main assertion.",
        cognitive_load_reason: "Long visible text increases working-memory load.",
        action: "split_or_rewrite_slide",
        fix_type: "one_slide_one_message",
        acceptance_criteria: [
          "The slide has one central claim.",
          "Secondary details move to bullets, notes, or another slide."
        ]
      })
    );
  }

  if (slide.bullets.length > 3 || slide.bullets.some((bullet) => bullet.length > 100)) {
    pushQuestion(
      questions,
      makeQuestion({
        round,
        slide,
        severity: "major",
        type: "too_dense",
        review_lens: "cognitive_load_reviewer",
        target_element: "bullets",
        question: "Which visible details can be removed, shortened, or moved to speaker notes?",
        learner_confusion: "The learner must read too much while listening to the presenter.",
        observed_issue: "The slide has too many or too-long bullets.",
        cognitive_load_reason: "Dense bullet lists add avoidable cognitive load.",
        action: "compress_or_split_bullets",
        fix_type: "density_reduction",
        acceptance_criteria: ["At most three visible bullets remain.", "Each bullet supports the central message."]
      })
    );
  }

  if (!slide.speaker_notes.trim()) {
    pushQuestion(
      questions,
      makeQuestion({
        round,
        slide,
        severity: "major",
        type: "missing_prerequisite",
        review_lens: "naive_student",
        target_element: "speaker_notes",
        question: "What should the presenter explain before this slide so the learner has the needed context?",
        learner_confusion: "The learner may see the slide but miss the prerequisite idea needed to follow it.",
        observed_issue: "Speaker notes are missing.",
        action: "add_teaching_notes",
        fix_type: "prerequisite_and_explanation_path",
        acceptance_criteria: ["Speaker notes explain prerequisite context when needed.", "Speaker notes include a teaching path."]
      })
    );
  }

  if (slide.source_refs.length === 0) {
    pushQuestion(
      questions,
      makeQuestion({
        round,
        slide,
        severity: "critical",
        type: "unsupported_claim",
        review_lens: "source_fidelity_reviewer",
        target_element: "source_refs",
        question: "What source supports this slide's central claim, and is the claim stated no stronger than the source allows?",
        learner_confusion: "The learner cannot distinguish source-backed content from generated interpretation.",
        observed_issue: "The slide has no source reference.",
        source_refs_needed: true,
        action: "add_source_refs_or_weaken_claim",
        fix_type: "source_grounding",
        acceptance_criteria: ["Factual claims have source references.", "Unsupported claims are removed or weakened."]
      })
    );
  }

  if (!slide.visual.description.trim()) {
    pushQuestion(
      questions,
      makeQuestion({
        round,
        slide,
        severity: "major",
        type: "visual_text_mismatch",
        review_lens: "cognitive_load_reviewer",
        target_element: "visual.description",
        question: "What visual would directly support this slide message, and how should the learner read it?",
        learner_confusion: "The learner cannot tell whether the slide needs a process, comparison, result, or example visual.",
        observed_issue: "The visual description is missing.",
        action: "add_message_aligned_visual",
        fix_type: "visual_alignment",
        acceptance_criteria: ["The visual type matches the slide message.", "The visual description tells the learner what to inspect first."]
      })
    );
  }

  const slideText = `${slide.title} ${slide.message} ${slide.bullets.join(" ")} ${slide.speaker_notes}`;

  if (!hasCausalCue(slideText) && /method|approach|solve|improve|提案|手法|改善|解決/i.test(slideText)) {
    pushQuestion(
      questions,
      makeQuestion({
        round,
        slide,
        severity: "critical",
        type: "causal_gap",
        review_lens: "strict_professor",
        target_element: "message",
        question: "Why does this method solve the stated problem? What is the problem-to-mechanism-to-effect chain?",
        learner_confusion: "The learner may remember that the method is new, but cannot explain why it works.",
        observed_issue: "The slide mentions a method or improvement without an explicit mechanism.",
        action: "add_problem_mechanism_effect_explanation",
        fix_type: "causal_chain",
        acceptance_criteria: ["The limitation is named.", "The mechanism is named.", "The expected effect is connected to the mechanism."]
      })
    );
  }

  if (!hasConcreteCue(slideText)) {
    pushQuestion(
      questions,
      makeQuestion({
        round,
        slide,
        severity: "major",
        type: "missing_concrete_example",
        review_lens: "naive_student",
        target_element: "speaker_notes",
        question: "Can this idea be shown with a small concrete example, toy input/output, or analogy?",
        learner_confusion: "The explanation may remain too abstract to map to a concrete situation.",
        observed_issue: "No concrete example cue was found.",
        action: "add_concrete_example",
        fix_type: "toy_example_or_analogy",
        acceptance_criteria: ["A small example is added where useful.", "The example does not increase visible text density too much."]
      })
    );
  }

  if (hasChartCue(slide)) {
    pushQuestion(
      questions,
      makeQuestion({
        round,
        slide,
        severity: "major",
        type: "result_interpretation_missing",
        review_lens: "strict_professor",
        target_element: "visual",
        question: "What should the audience read from this result or chart, and which number or pattern matters most?",
        learner_confusion: "The learner can see a result, but may not know what conclusion it supports.",
        observed_issue: "The slide appears to describe a result or chart without forcing a takeaway interpretation.",
        action: "add_result_takeaway_annotation",
        fix_type: "result_interpretation",
        acceptance_criteria: ["The result slide names the key takeaway.", "The important number or pattern is identified."]
      })
    );
  }

  if (hasComparisonCue(slideText) && !/metric|axis|accuracy|cost|speed|評価|観点|精度|速度/i.test(slideText)) {
    pushQuestion(
      questions,
      makeQuestion({
        round,
        slide,
        severity: "major",
        type: "comparison_gap",
        review_lens: "strict_professor",
        target_element: "message",
        question: "What is being compared, and along which axis such as accuracy, speed, cost, or interpretability?",
        learner_confusion: "The learner may hear that something is better without knowing what better means.",
        observed_issue: "Comparison language appears without an explicit comparison axis.",
        action: "add_comparison_axis",
        fix_type: "comparison_axis",
        acceptance_criteria: ["The baseline or comparison target is named.", "The comparison metric is explicit."]
      })
    );
  }
}

function addDeckLevelQuestions(deckId: string, round: number, questions: CritiqueQuestion[]): void {
  const deck = DeckSpecSchema.parse(readJson(deckPath(deckId, "working", "deck_spec.json")));
  const fullText = deck.slides.map((slide) => `${slide.title} ${slide.message} ${slide.speaker_notes}`).join("\n");

  if (!/why|how|なぜ|どう|仕組み/i.test(fullText)) {
    pushQuestion(
      questions,
      makeQuestion({
        round,
        severity: "major",
        type: "socratic_why_how",
        review_lens: "strict_professor",
        question: "Where does this deck explicitly ask or answer a why/how question?",
        learner_confusion: "The deck may state facts without pushing deeper explanation.",
        observed_issue: "No deck-level why/how cue was found.",
        action: "add_socratic_prompt",
        fix_type: "why_how_question",
        acceptance_criteria: ["At least one section includes a why/how prompt.", "The answer is supported by slides or speaker notes."]
      })
    );
  }

  if (!/quiz|check|question|確認|問い|理解/i.test(fullText)) {
    pushQuestion(
      questions,
      makeQuestion({
        round,
        severity: "minor",
        type: "missing_check_question",
        review_lens: "naive_student",
        question: "How will the presenter check whether the learner actually understood the core idea?",
        learner_confusion: "The learner may feel familiar with the topic without being able to use or explain it.",
        observed_issue: "No check question or recap cue was found.",
        action: "add_understanding_check",
        fix_type: "section_check_question",
        acceptance_criteria: ["Add a lightweight check question or recap prompt.", "The check targets the deck goal."]
      })
    );
  }

  if (!/limit|limitation|scope|assumption|限界|制約|前提|適用範囲/i.test(fullText)) {
    pushQuestion(
      questions,
      makeQuestion({
        round,
        severity: "major",
        type: "limitation_missing",
        review_lens: "strict_professor",
        question: "What are the limits, assumptions, or conditions where this explanation should not be overgeneralized?",
        learner_confusion: "The learner may overstate the method, result, or concept beyond the source's scope.",
        observed_issue: "No limitation, assumption, or scope cue was found.",
        source_refs_needed: true,
        action: "add_limitations_or_scope",
        fix_type: "scope_control",
        acceptance_criteria: ["Add a limitation, assumption, or scope statement.", "Avoid overclaiming in the conclusion."]
      })
    );
  }
}

function makeFallbackQuestions(deckId: string, round: number): CritiqueQuestion[] {
  const deck = DeckSpecSchema.parse(readJson(deckPath(deckId, "working", "deck_spec.json")));
  const questions: CritiqueQuestion[] = [];

  for (const slide of deck.slides) {
    if (questions.length >= MAX_QUESTIONS_PER_ROUND) break;
    checkSlide(slide, round, questions);
  }

  addDeckLevelQuestions(deckId, round, questions);

  if (questions.length === 0 && deck.slides[0]) {
    pushQuestion(
      questions,
      makeQuestion({
        round,
        slide: deck.slides[0],
        severity: "minor",
        type: "cognitive_mirror_reflection",
        review_lens: "cognitive_mirror",
        target_element: "message",
        question: `I read this slide as: ${deck.slides[0].message}. Is that the intended understanding?`,
        learner_confusion: "The learner's received meaning may differ from the intended message.",
        observed_issue: "Cognitive mirror probe generated from the slide message.",
        action: "compare_intended_and_received_understanding",
        fix_type: "cognitive_mirror_rewrite",
        acceptance_criteria: ["The intended takeaway is explicit.", "Likely misreadings are reduced."]
      })
    );
  }

  return questions.slice(0, MAX_QUESTIONS_PER_ROUND);
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
      "target_element": "message",
      "type": "missing_learning_goal" | "missing_prerequisite" | "undefined_term" | "abstraction_jump" | "missing_concrete_example" | "missing_check_question" | "causal_gap" | "mechanism_gap" | "unsupported_claim" | "source_mismatch" | "comparison_gap" | "result_interpretation_missing" | "limitation_missing" | "one_message_violation" | "too_dense" | "split_attention" | "weak_visual_hierarchy" | "visual_text_mismatch" | "chart_encoding_mismatch" | "readability_accessibility_issue" | "naive_student_confusion" | "misconception_probe" | "socratic_why_how" | "cognitive_mirror_reflection" | "audience_mismatch",
      "review_lens": "naive_student" | "strict_professor" | "cognitive_load_reviewer" | "source_fidelity_reviewer" | "cognitive_mirror",
      "question": "specific question",
      "learner_confusion": "how a learner may misunderstand or get stuck",
      "evidence": { "observed_issue": "specific issue observed in the deck" },
      "expected_fix": { "action": "specific edit action", "fix_type": "short fix category", "acceptance_criteria": ["clear pass/fail criterion"] }
    }
  ]
}

Rules:
- Ask at most ${MAX_QUESTIONS_PER_ROUND} questions.
- Do not rewrite the deck.
- Do not repeat resolved questions from professor memory.
- Prefer questions that reveal learner confusion.
- Use specific slide_id when possible.
- Include learner_confusion and acceptance_criteria for every question.
- Use these lenses: naive_student, strict_professor, cognitive_load_reviewer, source_fidelity_reviewer, cognitive_mirror.
- Prefer why/how, misconception, and cognitive-mirror questions when they reveal understanding gaps.

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
  const added = questions
    .map((q) => `- ${q.id} [${q.review_lens}/${q.type}/${q.severity}]: ${q.question}`)
    .join("\n");
  writeText(memoryPath, `${previous}\n\n## Round ${round}\n\n${added}\n`);
}

main();
