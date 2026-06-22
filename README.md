# Claude Code Learnable Deck

Claude Code + local Ollama based agent project for generating learner-friendly slide decks from papers, PDFs, Markdown notes, and technical concepts.

The project goal is not to build a generic slide generator. The goal is to build a **learnable deck generation agent** that reconstructs source material into an understandable learning path and improves it through a professor-like critique loop.

## Current status

Planning only.

No implementation is included yet.

## Current architecture direction

The current direction is documented here:

- [Architecture Plan](docs/architecture-plan.md)
- [Configured Iteration Plan](docs/configured-iteration-plan.md)

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

The default workflow should use a configured fixed iteration count.

Recommended initial setting:

```json
{
  "stop_mode": "fixed_rounds",
  "max_rounds": 50
}
```

A longer experiment can use `max_rounds: 100`.

The iteration runner should manage round count, snapshots, memory files, verifier reports, and best-round selection.

Fixed rounds should mean controlled file-backed iterations, not one huge Claude Code conversation.

## Planned first implementation

The first implementation PR should add:

- `CLAUDE.md`
- `.claude/agents/slide-builder.md`
- `.claude/agents/professor-critic.md`
- `.claude/skills/make-slides/SKILL.md`
- basic DeckSpec schema
- minimal Markdown input pipeline
- Marp renderer
- configured iteration runner
- simple verifier scripts
- snapshot output
- best-round selection
