# Claude Code Learnable Deck

This repository builds learner-friendly slide decks through a fixed-round Builder/Critic loop.

## Core workflow

Always use file-backed state.

Do not keep all context only in the Claude Code conversation.

Default workflow:

```text
source
↓
DeckSpec
↓
fixed configured rounds
↓
best-round selection
↓
final deck
```

## Required command path

Use the configured iteration runner:

```bash
npm run make-slides -- --input examples/sample.md --deck sample --rounds 50
```

For a shorter smoke test:

```bash
npm run make-slides -- --input examples/sample.md --deck sample --rounds 3
```

## Model configuration

Models are selected through `.env`.

Supported profiles:

- `gemma4_31b_thinking`
- `gpt_oss_120b`
- `qwen3_coder_next`
- `direct`

The actual Ollama tag can differ by machine. Update `.env` based on `ollama list`.

## Quality rules

These are hard rules for generated decks:

- Use DeckSpec as the canonical representation.
- One slide has one central message.
- Keep bullets to at most 3 per slide.
- Keep visible slide elements sparse; avoid more than roughly 5 major elements on one slide.
- Prefer assertion-evidence structure: title/message states the claim, visual/body provides evidence.
- Prefer diagrams, examples, comparisons, and short labels over dense prose.
- Put related text near the related visual element; avoid split attention.
- Use high contrast, large readable text, and a small accent-color set.
- When generating Japanese slides, keep wording short and avoid kanji-heavy dense sentences.
- Add speaker notes that teach the idea, not just repeat visible text.
- Add source references when possible.
- Mark interpretation separately from source-backed facts.
- Save every round under `outputs/<deck_id>/snapshots/`.
- Do not make the final round automatically final; use best-round selection.

## Builder/Critic behavior

The Builder must answer critique questions before editing.

The Professor Critic must not only point out issues. It should state:

- how a learner may misunderstand the slide
- what slide/source evidence caused the concern
- what acceptance criteria would make the fix pass

The Critic should use multiple review lenses:

- naive student
- strict professor
- cognitive load reviewer
- source fidelity reviewer
- cognitive mirror

## Research-grounded deck pattern

For educational and technical decks, prefer this learning path unless the input asks otherwise:

```text
learning goal
↓
problem / motivation
↓
required prerequisite or definition
↓
core idea
↓
small concrete example
↓
mechanism or process
↓
result / evidence
↓
interpretation
↓
limitations / scope
↓
check question / recap
```

Do not blindly preserve the source order when a learner-friendly order is better.

## Implementation rule

The Orchestration Layer and Verification Layer are scripts first, not separate AI agents.
