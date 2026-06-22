# Configured Iteration Plan

## Decision

The default workflow should use a configured iteration count.

The system should not be designed around a short non-fixed loop. The first implementation should prepare an iteration runner from the beginning.

Recommended defaults:

```json
{
  "stop_mode": "fixed_rounds",
  "max_rounds": 50
}
```

A longer experiment can use:

```json
{
  "stop_mode": "fixed_rounds",
  "max_rounds": 100
}
```

## Core flow

```text
input source
↓
initial DeckSpec
↓
repeat configured rounds:
  Builder
  Render
  Professor Critic
  Verifier scripts
  Snapshot
  Score
↓
select best round
↓
final deck
```

## Required files

```text
outputs/<deck_id>/
├─ working/
│  ├─ run_config.json
│  ├─ run_state.json
│  ├─ deck_spec.json
│  ├─ builder_memory.md
│  ├─ professor_memory.md
│  ├─ critique_rounds.jsonl
│  ├─ verifier_reports.jsonl
│  └─ round_scores.jsonl
├─ snapshots/
│  └─ round-xxx/
├─ render/
├─ final/
└─ reports/
```

## Round policy

The same prompt should not be reused for every round.

For 50 rounds:

```text
0: initial build
1-5: structure
6-15: professor questions
16-25: visual explanation
26-35: source fidelity
36-45: compression and cleanup
46-49: polish and final candidate selection
```

For 100 rounds:

```text
0: initial build
1-5: structure
6-15: professor questions
16-30: slide ordering and splitting
31-50: visual explanation
51-70: source fidelity
71-90: compression and cleanup
91-99: polish and final candidate selection
```

## Script plan

```text
scripts/
├─ orchestrate.ts
├─ run_builder.ts
├─ run_critic.ts
├─ check_deck.ts
├─ check_render.ts
├─ render_marp.ts
└─ select_best_round.ts
```

`orchestrate.ts` owns the configured iteration count, round policy, state updates, snapshots, verifier calls, and final selection.

## First implementation target

The first implementation PR should include the configured iteration runner.

It should add:

- DeckSpec schema
- Marp renderer
- Builder agent file
- Professor Critic agent file
- Make Slides skill
- `scripts/orchestrate.ts`
- `run_config.json`
- `run_state.json`
- snapshot output
- simple verifier scripts
- best-round selection
