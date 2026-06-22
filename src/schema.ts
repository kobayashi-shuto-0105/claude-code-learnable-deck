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
  duration_minutes: z.number().int().positive().default(15),
  target_slide_count: z.number().int().positive().default(12),
  slides: z.array(SlideSchema).min(1)
});

export const CritiqueQuestionSchema = z.object({
  id: z.string().min(1),
  round: z.number().int().nonnegative(),
  severity: z.enum(["critical", "major", "minor"]),
  slide_id: z.string().optional(),
  type: z.enum([
    "missing_prerequisite",
    "causal_gap",
    "undefined_term",
    "too_dense",
    "weak_example",
    "unsupported_claim",
    "bad_order",
    "visual_confusion",
    "result_interpretation_missing",
    "audience_mismatch"
  ]),
  question: z.string().min(1),
  expected_fix: z.string().optional()
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
