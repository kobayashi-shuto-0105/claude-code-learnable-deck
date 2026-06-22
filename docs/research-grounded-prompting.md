# Research-grounded prompting guide

This document records the prompt-design rules used by Claude Code Learnable Deck.

The goal is to keep the Builder/Critic loop aligned with research on slide comprehension, teachable agents, and agentic slide generation.

## 1. Slide comprehension rules

Use these rules in Builder prompts, Critic prompts, and verifier warnings.

- One slide should communicate one central message.
- Keep visible slide elements sparse.
- Keep visible bullets short and limited.
- Prefer assertion-evidence structure: the slide message states the claim, the body supports it.
- Place related labels and annotations close to the figure, chart, or visual element they explain.
- Prefer diagrams, annotated charts, process flows, comparison tables, and toy examples over dense paragraphs.
- Use high contrast, large readable text, and a small accent-color set.
- For Japanese slides, prefer short readable wording and avoid dense kanji-heavy sentences.
- Use speaker notes for details that do not need to be visible on the slide.

## 2. Learning path rules

Do not merely summarize the source in its original order.

Prefer this order for educational and technical decks:

```text
learning goal
problem / motivation
prerequisite or definition
core idea
small concrete example
mechanism or process
result / evidence
interpretation
limitation / scope
check question / recap
```

This order is a default, not a rigid template. The Builder may change it when the source or audience requires another structure.

## 3. Teachable-agent critic rules

The Professor Critic should behave partly like a naive student and partly like a strict professor.

Use these patterns:

- Ask why/how questions when the deck states a fact without explaining the mechanism.
- Ask naive-student questions when terms, prerequisites, or examples are missing.
- Use cognitive mirror feedback: summarize how a learner may read a slide, then ask whether that interpretation is intended.
- Probe likely misconceptions directly.
- Do not only say a slide is unclear. Explain how the learner may get stuck.

## 4. Source fidelity rules

The system must not make source material sound stronger than it is.

- Every factual claim should have a source reference when possible.
- If a claim is an interpretation, mark it as interpretation.
- If no support is available, weaken or remove the claim.
- Results need interpretation, not only reproduction.
- Limitations and scope should be explicit.

## 5. Builder prompt requirements

Builder prompts should always include:

- DeckSpec schema shape
- current round policy
- source excerpt
- current DeckSpec
- recent critique
- verifier reports
- builder memory
- visible slide quality rules
- learning path preference

The Builder should satisfy critique by improving structure, examples, visuals, notes, or source grounding rather than adding more visible text.

## 6. Critic prompt requirements

Critic prompts should always include:

- current DeckSpec
- professor memory
- verifier reports
- the full critique schema
- review lenses
- max question count
- instruction to avoid repeated resolved questions

Each CritiqueQuestion should include:

- `type`
- `review_lens`
- `severity`
- `question`
- `learner_confusion`
- `evidence.observed_issue`
- `expected_fix.action`
- `expected_fix.acceptance_criteria`

## 7. Verifier requirements

Verifier scripts should warn about:

- missing source references
- missing speaker notes
- too many bullets
- overlong titles or messages
- missing visual descriptions
- no concrete example or check question
- no why/how/mechanism cue
- no limitation/scope cue

Warnings should not always fail the run. They should help round scoring and best-round selection.
