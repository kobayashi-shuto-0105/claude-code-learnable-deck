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

- One slide has one central message.
- Use DeckSpec as the canonical representation.
- Keep bullets to at most 3 per slide.
- Add speaker notes.
- Add source references when possible.
- Save every round under `outputs/<deck_id>/snapshots/`.
- Do not make the final round automatically final; use best-round selection.

## Implementation rule

The Orchestration Layer and Verification Layer are scripts first, not separate AI agents.
