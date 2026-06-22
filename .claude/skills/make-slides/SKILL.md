---
name: make-slides
description: Generate a learner-friendly slide deck using the configured fixed-round Builder/Critic loop.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

Use the repository runner instead of manually looping in chat.

Default command:

```bash
npm run make-slides -- --input examples/sample.md --deck sample --rounds 50
```

Smoke test:

```bash
npm run make-slides -- --input examples/sample.md --deck sample --rounds 3
```

Workflow:

1. Load `.env` model configuration.
2. Initialize output directories.
3. Create or update `run_config.json`.
4. Extract the source into `source/extracted.md`.
5. Build or revise `working/deck_spec.json`.
6. Render `render/slides.md`.
7. Run Professor Critic.
8. Run verifier scripts.
9. Save snapshots under `outputs/<deck_id>/snapshots/`.
10. Write scores to `round_scores.jsonl`.
11. Select the best round.
12. Copy selected artifacts to `outputs/<deck_id>/final/`.

Do not rely on the current conversation as the only memory.

## Deck quality checklist

Before treating a deck as good, verify that it has:

- a clear learning goal
- one central message per slide
- at most 3 visible bullets per slide
- source references for factual claims
- speaker notes that explain how to teach the slide
- at least one concrete example or toy input/output where useful
- why/how/mechanism explanation for methods
- result interpretation, not just result display
- limitations or scope control
- a check question or recap

## Slide design checklist

Prefer:

- assertion-evidence titles
- diagrams and annotated charts
- labels close to the relevant visual elements
- high contrast
- large readable text
- limited accent colors
- short Japanese wording when Japanese is requested

Avoid:

- copying the source order when it hurts understanding
- dense paragraphs on slides
- unsupported claims
- decorative visuals that do not support the message
- final-round-only selection without comparing snapshots
