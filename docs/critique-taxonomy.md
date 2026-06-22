# Critique Taxonomy

This document defines the Professor Critic taxonomy used by the Builder/Critic loop.

The goal is to make feedback useful for improving learner understanding, not just for generic slide review.

## Design principle

A good critique question should include:

1. what is unclear
2. how a learner may misunderstand it
3. what evidence or slide element caused the concern
4. what acceptance criteria must be satisfied after the fix

Generic feedback such as "make this clearer" is not enough.

## Review lenses

### `naive_student`

Read the slide as a learner with slightly less knowledge than the target audience.

Detect missing prerequisites, undefined terms, abstraction jumps, missing examples, and beginner confusion.

### `strict_professor`

Read the deck as a professor evaluating whether the explanation is logically defensible.

Detect causal gaps, mechanism gaps, unsupported claims, weak comparisons, missing result interpretation, and missing limitations.

### `cognitive_load_reviewer`

Read the deck as a reviewer focused on human cognitive load and slide readability.

Detect multiple messages on one slide, too much text, split attention, weak visual hierarchy, chart encoding problems, and accessibility problems.

### `source_fidelity_reviewer`

Read the deck as a source-grounding reviewer.

Detect missing source references, source mismatch, overclaiming, and unclear boundaries between source-backed claims and interpretation.

### `cognitive_mirror`

Reflect back how a learner might understand or misread the slide.

Detect unintended interpretation, misleading title-message-visual alignment, and ambiguity that appears after summarizing the slide as a learner.

## Question type groups

### Learning / Understanding

- `missing_learning_goal`
- `missing_prerequisite`
- `undefined_term`
- `abstraction_jump`
- `missing_concrete_example`
- `missing_check_question`

### Logic / Evidence

- `causal_gap`
- `mechanism_gap`
- `unsupported_claim`
- `source_mismatch`
- `comparison_gap`
- `result_interpretation_missing`
- `limitation_missing`

### Slide Design / Cognitive Load

- `one_message_violation`
- `too_dense`
- `split_attention`
- `weak_visual_hierarchy`
- `visual_text_mismatch`
- `chart_encoding_mismatch`
- `readability_accessibility_issue`

### Pedagogical Dialogue

- `naive_student_confusion`
- `misconception_probe`
- `socratic_why_how`
- `cognitive_mirror_reflection`
- `audience_mismatch`

## Required CritiqueQuestion shape

Each question should include:

- `id`
- `round`
- `severity`
- `slide_id` when possible
- `target_element` when possible
- `type`
- `review_lens`
- `question`
- `learner_confusion`
- `evidence.observed_issue`
- `expected_fix.action`
- `expected_fix.fix_type`
- `expected_fix.acceptance_criteria`

## MVP deterministic critic behavior

The deterministic fallback critic should use simple heuristics:

- long titles or messages -> `one_message_violation`
- too many or too-long bullets -> `too_dense`
- missing notes -> `missing_prerequisite`
- missing source refs -> `unsupported_claim`
- missing visual descriptions -> `visual_text_mismatch`
- method/improvement language without why/how cues -> `causal_gap`
- no examples or toy input/output cues -> `missing_concrete_example`
- result/chart cues without takeaway -> `result_interpretation_missing`
- comparison language without metric -> `comparison_gap`
- no deck-level why/how cue -> `socratic_why_how`
- no check question -> `missing_check_question`
- no limitation/scope cue -> `limitation_missing`

## Future LLM critic behavior

When the LLM-backed critic is enabled, it should:

1. read the current DeckSpec
2. read professor memory
3. read the latest verifier report
4. produce at most 6 high-value questions
5. avoid repeating resolved questions
6. include `learner_confusion` and `acceptance_criteria` for every question

The goal is to make the loop fill explanation gaps rather than endlessly polish wording.
