# Claude Code Learnable Deck

Claude Code + local Ollama based agent project for generating learner-friendly slide decks from papers, PDFs, Markdown notes, and technical concepts.

The project goal is not to build a generic slide generator. The goal is to build a **learnable deck generation agent** that reconstructs source material into an understandable learning path and improves it through a professor-like critique loop.

## Current status

Planning only.

No implementation is included yet.

## Current architecture direction

The current direction is documented here:

- [Architecture Plan](docs/architecture-plan.md)

## Core idea

```text
Slide Builder
  ↓ creates / revises
DeckSpec + rendered slides
  ↑ feedback loop
Professor Critic
```

The Slide Builder performs research, concept structuring, storyboarding, DeckSpec creation, rendering, and revision.

The Professor Critic asks strict questions to reveal unclear reasoning, missing prerequisites, unsupported claims, and places where learners may get lost.

The workflow should use file-backed state instead of relying only on conversation context.

## Loop strategy

The normal MVP should use a short bounded critique loop.

The architecture also documents a later **fixed-round experiment mode** for deliberate 50/100 round runs. In that mode, an orchestration script should manage round count, snapshots, memory files, verifier reports, and best-round selection.

Fixed 50/100 rounds should mean controlled file-backed iterations, not one huge Claude Code conversation.

## Planned first implementation

The first implementation PR should add:

- `CLAUDE.md`
- `.claude/agents/slide-builder.md`
- `.claude/agents/professor-critic.md`
- `.claude/skills/make-slides/SKILL.md`
- basic DeckSpec schema
- minimal Markdown input pipeline
- Marp renderer
- simple critique loop with bounded rounds

Full fixed-round execution should be added after the basic file-backed loop and verifier scripts are stable.
