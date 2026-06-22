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

type QuestionInput = {
  round: number;
  severity: Severity;
  slide?: Slide;
  target_element?: string;
  type: CritiqueType;
  review_lens: ReviewLens;
  question: string;
  learner_confusion: string;
  observed_issue: string;
  source_refs_needed?: boolean;
  cognitive_load_reason?: string;
  action: string;
  fix_type: string;
  acceptance_criteria: string[];
};

const MAX_QUESTIONS_PER_ROUND = 6;

function normalizeQuestions(value: unknown, round: number): CritiqueQuestion[] | null {
  const raw = Array.isArray(value) ? value : (value as { questions?: unknown[] })?.questions;
  if (!Array.isArray(raw)) return null;

  const questions: CritiqueQuestion[] = [];
  for (const item of raw.slice(0, MAX_QUESTIONS_PER_ROUND)) {
    const normalized = { ...(item as Record<string, unknown>), round };
    if (typeof normalized.expected_fix === "string") {
      normalized.expected_fix = {
        action: normalized.expected_fix,
        acceptance_criteria: []
      };
    }
    const parsed = CritiqueQuestionSchema.safeParse(normalized);
    if (parsed.success) questions.push(parsed.data);
  }
  return questions.length > 0 ? questions : null;
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function hasCausalCue(value: string): boolean {
  return /because|therefore|so that|as a result|leads to|causes|why|how|なぜ|ため|結果|原因|仕組み/i.test(value);
}

function hasConcreteCue(value: string): boolean {
  return /example|for example|具体|例|case|toy|input|output|scenario/i.test(value);
}

function hasComparisonCue(value: string): boolean {
  return /vs\.?|versus|compared|baseline|previous|既存|比較|before|after/i.test(value);
}

function hasChartCue(slide: Slide): boolean {
  const value = `${slide.title} ${slide.message} ${slide.visual.type} ${slide.visual.description}`;
  return /chart|graph|table|plot|axis|legend|bar|line|result|accuracy|score|グラフ|表|結果|精度|凡例|軸/i.test(value);
}

function makeId(round: number, index: number): string {
  return `q-${String(round).padStart(3, "0")}-${String(index).padStart(2, "0")}`;
}

function pushQuestion(questions: CritiqueQuestion[], input: QuestionInput): void {
  if (questions.length >= MAX_QUESTIONS_PER_ROUND) return;

  questions.push({
    id: makeId(input.round, questions.length + 1),
    round: input.round,
    severity: input.severity,
    slide_id: input.slide?.id,
    target_element: input.target_element,
    type: input.type,
    review_lens: input.review_lens,
    question: input.question,
    learner_confusion: input.learner_confusion,
    evidence: {
      observed_issue: input.observed_issue,
      source_refs_needed: input.source_refs_needed,
      cognitive_load_reason: input.cognitive_load_reason
    },
    expected_fix: {
      action: input.action,
      fix_type: input.fix_type,
      acceptance_criteria: input.acceptance_criteria
    }
  });
}

function checkSlide(slide: Slide, round: number, questions: CritiqueQuestion[]): void {
  if (!slide.message.trim()) {
    pushQuestion(questions, {
      round,
      severity: "critical",
      slide,
      target_element: "message",
      type: "missing_learning_goal",
      review_lens: "naive_student",
      question: "After this slide, what exactly should the learner be able to explain?",
      learner_confusion: "The learner can see a topic, but cannot tell what understanding outcome is expected.",
      observed_issue: "Slide has no clear central message.",
      action: "rewrite_slide_message",
      fix_type: "learning_goal_message",
      acceptance_criteria: [
        "The slide has one central message in a single sentence.",
        "The message describes what the learner should understand, not just a topic name."
      ]
    });
  }

  if (slide.title.length > 80 || slide.message.length > 180) {
    pushQuestion(questions, {
      round,
      severity: "major",
      slide,
      target_element: slide.title.length > 80 ? "title" : "message",
      type: "one_message_violation",
      review_lens: "cognitive_load_reviewer",
      question: "Can this slide's central claim be read in five seconds, or is it trying to say too much at once?",
      learner_confusion: "The learner may not know which idea to remember from this slide.",
      observed_issue: "Title or central message is long enough to hide the assertion.",
      cognitive_load_reason: "A learnable deck should keep one slide to one central message and avoid overloading working memory.",
      action: "split_or_rewrite_slide",
      fix_type: "one_slide_one_message",
      acceptance_criteria: [
        "Title is short enough to scan quickly.",
        "The slide has exactly one central claim.",
        "Any secondary details move to bullets, notes, or another slide."
      ]
    });
  }

  if (slide.bullets.length > 3 || slide.bullets.some((bullet) => bullet.length > 100)) {
    pushQuestion(questions, {
      round,
      severity: "major",
      slide,
      target_element: "bullets",
      type: "too_dense",
      review_lens: "cognitive_load_reviewer",
      question: "Which details can be removed, moved to speaker notes, or split into another slide?",
      learner_confusion: "The learner has to read too many items while also listening to the presenter.",
      observed_issue: "Bullets are too many or too long for a quick explanatory slide.",
      cognitive_load_reason: "Dense bullet lists increase extraneous cognitive load.",
      action: "compress_or_split_bullets",
      fix_type: "density_reduction",
      acceptance_criteria: [
        "At most three bullets remain.",
        "Each bullet is short and supports the central message.",
        "Explanatory details are moved to speaker notes when possible."
      ]
    });
  }

  if (!slide.speaker_notes.trim() || wordCount(slide.speaker_notes) < 8) {
    pushQuestion(questions, {
      round,
      severity: "major",
      slide,
      target_element: "speaker_notes",
      type: "missing_prerequisite",
      review_lens: "naive_student",
      question: "What should the presenter say before this slide so the learner has the needed prerequisite context?",
      learner_confusion: "A learner may see the slide content but miss the oral explanation path that connects it to prior knowledge.",
      observed_issue: "Speaker notes are missing or too short to teach the slide.",
      action: "add_teaching_notes",
      fix_type: "prerequisite_and_explanation_path",
      acceptance_criteria: [
        "Speaker notes explain the prerequisite idea if needed.",
        "Speaker notes tell the presenter how to introduce the slide.",
        "Speaker notes include at least one concrete teaching cue."
      ]
    });
  }

  if (slide.source_refs.length === 0) {
    pushQuestion(questions, {
      round,
      severity: "critical",
      slide,
      target_element: "source_refs",
      type: "unsupported_claim",
      review_lens: "source_fidelity_reviewer",
      question: "What source supports this slide's central claim, and is the claim stated no stronger than the source allows?",
      learner_confusion: "The learner cannot distinguish source-backed content from generated interpretation.",
      observed_issue: "Slide has no source reference.",
      source_refs_needed: true,
      action: "add_source_refs_or_weaken_claim",
      fix_type: "source_grounding",
      acceptance_criteria: [
        "Each factual slide has at least one source reference.",
        "Speculative interpretation is marked as interpretation.",
        "Unsupported claims are removed or weakened."
      ]
    });
  }

  if (!slide.visual.description.trim()) {
    pushQuestion(questions, {
      round,
      severity: "major",
      slide,
      target_element: "visual.description",
      type: "visual_text_mismatch",
      review_lens: "cognitive_load_reviewer",
      question: "What visual would directly support the slide message, and how should it be read?",
      learner_confusion: "The learner cannot tell whether the slide should show a process, comparison, result, or example.",
      observed_issue: "Visual description is missing.",
      action: "add_message_aligned_visual",
      fix_type: "visual_alignment",
      acceptance_criteria: [
        "The visual type matches the slide message.",
        "The visual description says what the learner should look at first.",
        "The visual is not decorative only."
      ]
    });
  }

  if (!hasCausalCue(`${slide.message} ${slide.speaker_notes}`) && /method|approach|solve|improve|提案|手法|改善|解決/i.test(`${slide.title} ${slide.message}`)) {
    pushQuestion(questions, {
      round,
      severity: "critical",
      slide,
      target_element: "message",
      type: "causal_gap",
      review_lens: "strict_professor",
      question: "Why does this method solve the stated problem? What is the problem -> mechanism -> effect chain?",
      learner_confusion: "The learner may remember that the method is new, but cannot explain why it works.",
      observed_issue: "Slide mentions a method, solution, or improvement without an explicit causal mechanism.",
      action: "add_problem_mechanism_effect_explanation",
      fix_type: "causal_chain",
      acceptance_criteria: [
        "The old problem or limitation is named.",
        "The mechanism of the proposed idea is named.",
        "The expected effect is connected to the mechanism."
      ]
    });
  }

  if (!hasConcreteCue(`${slide.message} ${slide.bullets.join(" ")} ${slide.speaker_notes}`)) {
    pushQuestion(questions, {
      round,
      severity: "major",
      slide,
      target_element: "speaker_notes",
      type: "missing_concrete_example",
      review_lens: "naive_student",
      question: "Can this idea be shown with a small concrete example, toy input/output, or analogy?",
      learner_confusion: "The explanation may stay abstract, so the learner cannot map it to a concrete situation.",
      observed_issue: "No concrete example cue was found in the slide content or notes.",
      action: "add_concrete_example",
      fix_type: "toy_example_or_analogy",
      acceptance_criteria: [
        "A small concrete example is added where it improves understanding.",
        "The example is simpler than the source material.",
        "The example does not increase the visible text density too much."
      ]
    });
  }

  if (hasChartCue(slide)) {
    pushQuestion(questions, {
      round,
      severity: "major",
      slide,
      target_element: "visual",
      type: "result_interpretation_missing",
      review_lens: "strict_professor",
      question: "What should the audience read from this result or chart, and which number or pattern matters most?",
      learner_confusion: "The learner can see that there is a result, but may not know what conclusion it supports.",
      observed_issue: "Slide appears to describe a result, table, or chart without forcing a takeaway interpretation.",
      action: "add_result_takeaway_annotation",
      fix_type: "result_interpretation",
      acceptance_criteria: [
        "The result slide names the key takeaway.",
        "The most important number or pattern is identified.",
        "The implication is tied back to the deck goal."
      ]
    });
  }

  if (hasChartCue(slide) && !/axis|unit|label|legend|凡例|軸|単位|ラベル/i.test(`${slide.visual.description} ${slide.speaker_notes}`)) {
    pushQuestion(questions, {
      round,
      severity: "major",
      slide,
      target_element: "visual.description",
      type: "chart_encoding_mismatch",
      review_lens: "cognitive_load_reviewer",
      question: "Are the chart type, axis labels, units, legend, and direct annotations appropriate for what the learner should compare?",
      learner_confusion: "The learner may spend effort decoding the chart instead of understanding the result.",
      observed_issue: "A result/chart cue was found, but chart encoding details are not described.",
      cognitive_load_reason: "Charts should minimize avoidable decoding effort and keep labels close to the data they explain.",
      action: "clarify_chart_encoding",
      fix_type: "chart_readability",
      acceptance_criteria: [
        "Chart type matches the intended comparison.",
        "Axis labels and units are stated where relevant.",
        "Legend or labels are close to the corresponding data."
      ]
    });
  }

  if (hasComparisonCue(`${slide.title} ${slide.message}`) && !/axis|criteria|metric|評価|観点|精度|速度|cost|accuracy/i.test(`${slide.message} ${slide.bullets.join(" ")}`)) {
    pushQuestion(questions, {
      round,
      severity: "major",
      slide,
      target_element: "message",
      type: "comparison_gap",
      review_lens: "strict_professor",
      question: "What is being compared, and along which axis: accuracy, speed, cost, interpretability, or something else?",
      learner_confusion: "The learner may hear that something is better without knowing what better means.",
      observed_issue: "Comparison language appears without an explicit comparison axis.",
      action: "add_comparison_axis",
      fix_type: "comparison_table_or_axis",
      acceptance_criteria: [
        "The baseline or comparison target is named.",
        "The comparison metric is explicit.",
        "The slide avoids vague better/worse claims."
      ]
    });
  }
}

function addDeckLevelQuestions(deckId: string, round: number, questions: CritiqueQuestion[]): void {
  const deck = DeckSpecSchema.parse(readJson(deckPath(deckId, "working", "deck_spec.json")));
  const hasCheckQuestion = deck.slides.some((slide) => /quiz|question|check|確認|問い|理解/i.test(`${slide.title} ${slide.message} ${slide.speaker_notes}`));
  const hasLimitation = deck.slides.some((slide) => /limit|limitation|scope|caveat|assumption|限界|制約|前提|適用範囲/i.test(`${slide.title} ${slide.message} ${slide.speaker_notes}`));
  const hasWhyHow = deck.slides.some((slide) => /why|how|なぜ|どうやって|仕組み/i.test(`${slide.title} ${slide.message} ${slide.speaker_notes}`));

  if (!hasWhyHow) {
    pushQuestion(questions, {
      round,
      severity: "major",
      type: "socratic_why_how",
      review_lens: "strict_professor",
      question: "Where does this deck explicitly ask or answer a why/how question?",
      learner_confusion: "The deck may state facts without forcing deeper explanation.",
      observed_issue: "No why/how cue was found across the deck.",
      action: "add_socratic_prompt",
      fix_type: "why_how_question",
      acceptance_criteria: [
        "At least one section includes a why/how question.",
        "The answer to that question is supported by a slide or speaker note."
      ]
    });
  }

  if (!hasCheckQuestion) {
    pushQuestion(questions, {
      round,
      severity: "minor",
      type: "missing_check_question",
      review_lens: "naive_student",
      question: "How will the presenter check whether the learner actually understood the core idea?",
      learner_confusion: "The learner may feel familiar with the topic without being able to use or explain it.",
      observed_issue: "No quiz, reflection question, or understanding check was found.",
      action: "add_understanding_check",
      fix_type: "section_check_question",
      acceptance_criteria: [
        "Add one lightweight check question or reflection prompt.",
        "The check targets the central deck goal, not trivia."
      ]
    });
  }

  if (!hasLimitation) {
    pushQuestion(questions, {
      round,
      severity: "major",
      type: "limitation_missing",
      review_lens: "strict_professor",
      question: "What are the limits, assumptions, or conditions where this explanation should not be overgeneralized?",
      learner_confusion: "The learner may overstate the method, result, or concept beyond the source's actual scope.",
      observed_issue: "No limitation, assumption, or scope cue was found across the deck.",
      source_refs_needed: true,
      action: "add_limitations_or_scope",
      fix_type: "scope_control",
      acceptance_criteria: [
        "At least one limitation, assumption, or scope statement is added.",
        "The statement is source-backed when it is factual.",
        "Conclusion language avoids overclaiming."
      ]
    });
  }
}

function addCognitiveMirrorQuestion(deckId: string, round: number, questions: CritiqueQuestion[]): void {
  const deck = DeckSpecSchema.parse(readJson(deckPath(deckId, "working", "deck_spec.json")));
  const candidate = deck.slides.find((slide) => /method|approach|result|improve|提案|手法|結果|改善/i.test(`${slide.title} ${slide.message}`)) ?? deck.slides[0];
  if (!candidate) return;

  pushQuestion(questions, {
    round,
    severity: "major",
    slide: candidate,
    target_element: "message",
    type: "cognitive_mirror_reflection",
    review_lens: "cognitive_mirror",
    question: `I read this slide as: "${candidate.message}". Is that the intended understanding, or could a learner misread it?`,
    learner_confusion: "A learner's inferred summary may differ from the intended message, revealing hidden ambiguity.",
    observed_issue: "Cognitive mirror probe generated from the slide message.",
    action: "compare_intended_vs_received_understanding",
    fix_type: "cognitive_mirror_rewrite",
    acceptance_criteria: [
      "The intended takeaway is explicit.",
      "Likely misreadings are prevented by wording, labels, or notes.",
      "The slide title, message, and visual all point to the same interpretation."
    ]
  });
}

function makeFallbackQuestions(deckId: string, round: number): CritiqueQuestion[] {
  const deck = DeckSpecSchema.parse(readJson(deckPath(deckId, "working", "deck_spec.json")));
  const questions: CritiqueQuestion[] = [];

  for (const slide of deck.slides) {
    if (questions.length >= MAX_QUESTIONS_PER_ROUND) break;
    checkSlide(slide, round, questions);
  }

  addDeckLevelQuestions(deckId, round, questions);

  if (questions.length === 0) {
    addCognitiveMirrorQuestion(deckId, round, questions);
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
      "evidence": {
        "observed_issue": "specific issue observed in the deck",
        "source_refs_needed": true,
        "cognitive_load_reason": "optional reason"
      },
      "expected_fix": {
        "action": "specific edit action",
        "fix_type": "short fix category",
        "acceptance_criteria": ["clear pass/fail criterion"]
      }
    }
  ]
}

Rules:
- Ask at most ${MAX_QUESTIONS_PER_ROUND} questions.
- Do not rewrite the deck.
- Do not repeat resolved questions from professor memory.
- Prefer questions that reveal learner confusion, not generic style comments.
- Use specific slide_id when possible.
- Include learner_confusion and acceptance_criteria for every question.
- Use these lenses deliberately: naive_student, strict_professor, cognitive_load_reviewer, source_fidelity_reviewer, cognitive_mirror.

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
