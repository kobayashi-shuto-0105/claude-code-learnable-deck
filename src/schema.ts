import { z } from "zod";

export const SourceRefSchema = z.object({
  file: z.string().optional(),
  page: z.number().int().positive().optional(),
  section: z.string().optional(),
  locator: z.string().optional(),
  quote: z.string().optional()
});

export const VisualSchema = z.object({
  type: z.string().default("text"),
  description: z.string().default("")
});

export const SlideSchema = z.object({
  id: z.string().min(1),
  role: z.string().default("content"),
  title: z.string().min(1),
  message: z.string().min(1),
  bullets: z.array(z.string()).default([]),
  visual: VisualSchema.default({ type: "text", description: "" }),
  speaker_notes: z.string().default(""),
  source_refs: z.array(SourceRefSchema).default([])
});

export const DeckSpecSchema = z.object({
  deck_id: z.string().min(1),
  title: z.string().min(1),
  audience: z.string().min(1),
  goal: z.string().min(1),
  language: z.string().default("ja"),
  duration_minutes: z.number().int().positive().default(15),
  target_slide_count: z.number().int().positive().optional(),
  slides: z.array(SlideSchema).min(1)
});

export const CritiqueTypeValues = [
  "missing_learning_goal",
  "missing_prerequisite",
  "undefined_term",
  "abstraction_jump",
  "missing_concrete_example",
  "missing_check_question",
  "causal_gap",
  "mechanism_gap",
  "unsupported_claim",
  "source_mismatch",
  "comparison_gap",
  "result_interpretation_missing",
  "limitation_missing",
  "one_message_violation",
  "too_dense",
  "split_attention",
  "weak_visual_hierarchy",
  "visual_text_mismatch",
  "chart_encoding_mismatch",
  "readability_accessibility_issue",
  "naive_student_confusion",
  "misconception_probe",
  "socratic_why_how",
  "cognitive_mirror_reflection",
  "audience_mismatch"
] as const;

export const ReviewLensValues = [
  "naive_student",
  "strict_professor",
  "cognitive_load_reviewer",
  "source_fidelity_reviewer",
  "cognitive_mirror"
] as const;

export type CritiqueType = (typeof CritiqueTypeValues)[number];
export type ReviewLens = (typeof ReviewLensValues)[number];

const CritiqueTypeEnumValues = [...CritiqueTypeValues] as [CritiqueType, ...CritiqueType[]];
const ReviewLensEnumValues = [...ReviewLensValues] as [ReviewLens, ...ReviewLens[]];

export const ExpectedFixSchema = z.object({
  action: z.string().min(1),
  fix_type: z.string().optional(),
  acceptance_criteria: z.array(z.string()).default([])
});

export const CritiqueEvidenceSchema = z.object({
  observed_issue: z.string().optional(),
  source_refs_needed: z.boolean().optional(),
  cognitive_load_reason: z.string().optional()
});

export const CritiqueQuestionSchema = z.object({
  id: z.string().min(1),
  round: z.number().int().nonnegative(),
  severity: z.enum(["critical", "major", "minor"]),
  slide_id: z.string().optional(),
  target_element: z.string().optional(),
  type: z.enum(CritiqueTypeEnumValues),
  review_lens: z.enum(ReviewLensEnumValues).default("strict_professor"),
  question: z.string().min(1),
  learner_confusion: z.string().optional(),
  evidence: CritiqueEvidenceSchema.default({}),
  expected_fix: ExpectedFixSchema.optional()
});

export const RoundScoreSchema = z.object({
  round: z.number().int().nonnegative(),
  scores: z.object({
    source_fidelity: z.number().min(0).max(1),
    readability: z.number().min(0).max(1),
    structure: z.number().min(0).max(1),
    render_pass: z.boolean()
  }),
  critical_issues: z.number().int().nonnegative(),
  warnings: z.number().int().nonnegative(),
  candidate_for_final: z.boolean()
});

export type DeckSpec = z.infer<typeof DeckSpecSchema>;
export type Slide = z.infer<typeof SlideSchema>;
export type CritiqueQuestion = z.infer<typeof CritiqueQuestionSchema>;
export type RoundScore = z.infer<typeof RoundScoreSchema>;
