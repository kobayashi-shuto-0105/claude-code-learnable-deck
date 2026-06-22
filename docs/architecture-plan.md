# Claude Code Learnable Deck: Architecture Plan

## 0. Status

This document records the current design direction only. It intentionally does not define a finished implementation.

The immediate goal is to decide the architecture for a Claude Code based agent that creates human-friendly, learnable slide decks from papers, PDFs, Markdown notes, and technical concepts.

Implementation work should be done in later pull requests.

---

## 1. Product concept

The project is not just a generic slide generator.

It should become a **learnable deck generation agent** that converts difficult source material into slides that humans can understand.

Target inputs:

- research papers
- PDFs
- Markdown notes
- technical documents
- abstract concepts
- eventually URLs or arXiv papers

Target outputs:

- learner-friendly slide deck
- speaker notes
- source references
- quality reports
- eventually editable PPTX

Core value:

> Reconstruct the source material into an understandable learning path, then repeatedly improve it through a professor-like critique loop.

---

## 2. High-level architecture

```text
Claude Code + local Ollama model
│
├─ Orchestration Layer
│  └─ controls workflow, loop state, artifacts, resume, and final selection
│
├─ Slide Builder
│  ├─ research
│  ├─ concept structuring
│  ├─ storyboarding
│  ├─ DeckSpec generation
│  ├─ slide rendering
│  └─ revision
│
├─ Professor Critic
│  ├─ asks hard questions
│  ├─ finds unclear reasoning
│  ├─ finds missing prerequisites
│  ├─ finds unsupported claims
│  ├─ finds audience mismatch
│  └─ requests concrete fixes
│
└─ Verification Layer
   ├─ schema checks
   ├─ render checks
   ├─ source reference checks
   └─ later visual checks
```

The system should be built around a **builder-critic loop**.

The Slide Builder creates and revises the deck. The Professor Critic acts like a strict professor who asks questions until the explanation becomes understandable.

The Orchestration Layer is required as a role, but it does not need to be an AI agent in the MVP. It should first be implemented as a command, skill workflow, or script that controls the run.

The Verification Layer is required as a role, but it does not need to be an AI agent in the MVP. It should first be implemented as deterministic scripts and schema checks.

---

## 3. Important design principle: file-backed state

Do not rely only on Claude Code conversation context.

All important state should be stored as files so that the workflow can be resumed, inspected, and debugged.

Recommended output structure:

```text
outputs/<deck_id>/
├─ source/
│  ├─ original.pdf
│  ├─ extracted.md
│  ├─ figures/
│  └─ source_map.json
│
├─ working/
│  ├─ run_config.json
│  ├─ run_state.json
│  ├─ research_notes.md
│  ├─ concept_graph.json
│  ├─ outline.json
│  ├─ deck_spec.json
│  ├─ builder_memory.md
│  ├─ professor_memory.md
│  ├─ critique_rounds.jsonl
│  ├─ unresolved_questions.md
│  ├─ edit_plans.jsonl
│  ├─ verifier_reports.jsonl
│  ├─ round_scores.jsonl
│  └─ answer_to_professor.json
│
├─ render/
│  ├─ slides.md
│  ├─ slides.pdf
│  ├─ slides.pptx
│  └─ screenshots/
│
├─ snapshots/
│  ├─ round-000/
│  │  └─ deck_spec.json
│  ├─ round-001/
│  │  └─ deck_spec.json
│  └─ ...
│
├─ final/
│  ├─ deck_spec.json
│  ├─ slides.md
│  ├─ slides.pdf
│  └─ slides.pptx
│
└─ reports/
   ├─ quality_report.md
   ├─ source_fidelity_report.md
   ├─ loop_report.md
   └─ final_summary.md
```

This makes the agent behavior auditable and makes it easier for Claude Code to continue work across long runs.

For fixed 50/100 round runs, file-backed state is mandatory. A 100-round run should mean 100 controlled file-based iterations, not 100 chat messages kept in one large conversation context.

---

## 4. Core loop

The initial idea was a loop between:

- research / composition / slide creation and revision
- professor-like evaluator / feedback giver

This should support two loop modes:

1. **bounded quality loop** for normal MVP usage
2. **fixed-round experiment loop** for research-style 50/100 round runs

### 4.1 Normal MVP mode: bounded quality loop

Recommended defaults:

```text
max_rounds = 8
minimum_rounds = 1
stop_mode = "until_pass"
```

Stop when all of these are true:

- no critical issues remain
- no unresolved professor questions remain
- source fidelity check passes
- readability check passes
- slide density check passes
- render check passes

Workflow:

```text
Round 0:
  extract source material
  build research notes
  build concept graph
  build outline
  build initial deck_spec.json
  render initial slides

Round 1..N:
  professor critic reviews current deck
  critic produces structured questions and issues
  builder answers each question using source evidence
  builder creates edit_plan.json
  builder revises deck_spec.json
  renderer regenerates slides
  checks run again
  orchestrator decides continue or stop
```

### 4.2 Fixed-round experiment mode

Fixed-round mode is for deliberate long-run experiments, such as 50 or 100 rounds.

It should be controlled by explicit run configuration, not by asking Claude Code to keep chatting until the loop count is reached.

Example configuration:

```json
{
  "deck_id": "sample-paper",
  "input": "inputs/paper.pdf",
  "audience": "information science undergraduate",
  "duration_minutes": 15,
  "target_slide_count": 12,
  "max_rounds": 100,
  "stop_mode": "fixed_rounds",
  "builder_model": "qwen3-coder",
  "critic_model": "qwen3-coder"
}
```

In this mode, the system should run exactly `max_rounds` unless a hard failure occurs.

Important rule:

```text
fixed 100 rounds
= 100 controlled file-based iterations
≠ one large Claude Code conversation containing all history
```

The loop should be managed by an orchestration script or workflow command:

```text
for round in 0..max_rounds-1:
  determine round policy
  run builder
  render slides
  run professor critic
  run verifier scripts
  update memories
  compute round score
  save snapshot

select best round
copy selected artifacts to final/
generate loop_report.md
```

Fixed-round mode should still keep snapshots and scores because the final round may not be the best round.

---

## 5. Round policy for 50/100 round runs

Do not run the exact same instruction for every round.

Fixed long loops should change behavior over time. Otherwise, the agents may repeat the same critique, over-edit the deck, or degrade a previously good result.

Recommended 100-round schedule:

```text
Round 0:
  initial build

Round 1-5:
  global structure and learning path

Round 6-15:
  professor questions and missing prerequisites

Round 16-30:
  slide ordering, slide splitting, and introduction quality

Round 31-50:
  visual explanations, examples, analogies, comparisons, and diagrams

Round 51-70:
  source fidelity, unsupported claims, numbers, figures, and citations

Round 71-90:
  compression, duplication removal, wording, and slide density

Round 91-99:
  final polish, stability, and best-round candidate selection
```

For 50-round runs, the same structure can be compressed:

```text
Round 0:
  initial build

Round 1-5:
  global structure

Round 6-15:
  professor questions

Round 16-25:
  visual explanations and examples

Round 26-35:
  source fidelity

Round 36-45:
  compression and duplication removal

Round 46-49:
  final polish and best-round candidate selection
```

A future `round_policy` helper should map each round to a phase:

```text
initial_build
structure
professor_questions
visual_explanation
source_fidelity
polish
```

The Slide Builder prompt should receive the current round policy and should only perform edits appropriate for that phase.

---

## 6. Long-loop memory design

Long loops need explicit memory files to avoid repeated questions and context bloat.

### 6.1 Professor memory

`professor_memory.md` should record what was already asked, resolved, and should not be repeated.

Example:

```md
# Professor Memory

## Already asked
- q-001: The intuition behind the proposed method is weak.
- q-002: The interpretation of the experiment result is missing.
- q-003: Figure 2 is not explained enough.

## Resolved
- q-001 resolved in round 4.
- q-002 resolved in round 8.

## Do not repeat
- Do not ask for the definition of Transformer again unless it becomes unclear again.
```

The Professor Critic should read this memory before generating new feedback.

Rules:

- do not repeat resolved questions
- produce at most 5 questions per round
- classify each question as `critical`, `major`, or `minor`
- include `slide_id` when possible
- output JSON only

### 6.2 Builder memory

`builder_memory.md` should record major design decisions and why they were made.

Example:

```md
# Builder Memory

## Stable decisions
- The deck starts with problem motivation before method details.
- The proposed method is explained using a before/after diagram before introducing equations.

## Avoid changing unless necessary
- Keep the slide count near 12.
- Keep the experiment section short and interpretation-focused.
```

The Slide Builder should use this to avoid undoing previously good decisions.

### 6.3 Critique log

`critique_rounds.jsonl` should store all professor feedback.

Example:

```jsonl
{"round":1,"question_id":"q-001","severity":"critical","slide_id":"s03","type":"causal_gap","question":"Why does the proposed method solve the previous method's limitation?"}
{"round":1,"question_id":"q-002","severity":"major","slide_id":"s05","type":"undefined_term","question":"The term attention score is not explained."}
{"round":2,"question_id":"q-003","severity":"major","slide_id":"s07","type":"result_interpretation_missing","question":"What should the audience read from this graph?"}
```

Long logs should not be fully injected into every prompt. Each round should normally use:

- latest critique
- unresolved questions
- professor memory summary
- builder memory summary
- current DeckSpec

---

## 7. Best-round selection

For fixed 50/100 round runs, the last round should not automatically become the final deck.

Each round should produce a score record in `round_scores.jsonl`.

Example:

```json
{
  "round": 42,
  "scores": {
    "source_fidelity": 0.92,
    "readability": 0.86,
    "structure": 0.81,
    "render_pass": true
  },
  "critical_issues": 0,
  "warnings": 3,
  "candidate_for_final": true
}
```

At the end of fixed-round mode, the orchestration layer should choose the best round based on score, not only recency.

Suggested priority:

1. render must pass
2. no critical verifier issues
3. high source fidelity
4. high readability
5. low slide density
6. stable slide count
7. fewer unresolved professor questions

Final artifacts should be copied from the selected snapshot into `outputs/<deck_id>/final/`.

---

## 8. Agent responsibilities

### 8.1 Orchestration Layer

The Orchestration Layer manages the whole run.

Responsibilities:

- create output directories
- decide `deck_id`
- read and write `run_config.json`
- read and write `run_state.json`
- track loop count
- select loop mode: `until_pass` or `fixed_rounds`
- calculate round policy
- call or simulate the builder and critic stages
- run verifier scripts
- save snapshots
- compute or collect round scores
- select the best final round for fixed-round mode
- ensure all required artifacts exist
- prevent uncontrolled loops
- summarize final status

It should not directly write the deck content unless necessary.

MVP implementation should be a script or Skill workflow, not a dedicated AI agent.

### 8.2 Slide Builder

The Slide Builder is responsible for creating and revising the deck.

Responsibilities:

- read source material
- extract important claims, terms, figures, and relationships
- create `research_notes.md`
- create `concept_graph.json`
- create `outline.json`
- create `deck_spec.json`
- create `slides.md`
- render slides when needed
- answer Professor Critic questions
- revise the deck based on verified feedback
- follow the current round policy during long loops

Rules:

- never render final slides directly from raw PDF text
- always go through `deck_spec.json`
- one slide must have one central message
- each slide should be optimized for learner understanding
- prefer diagrams, comparisons, examples, and step-by-step explanation
- do not blindly follow the paper order
- use source references whenever possible
- do not rewrite the entire deck every round unless the round policy explicitly allows it

### 8.3 Professor Critic

The Professor Critic is not a general reviewer.

It should behave like a strict professor who tries to reveal where the explanation is unclear.

Responsibilities:

- ask hard questions
- identify missing prerequisites
- identify unexplained causal links
- identify unsupported claims
- identify undefined terms
- identify slides that are too dense
- identify weak examples
- identify bad slide ordering
- identify confusing visuals
- identify cases where a beginner would get lost

It should not rewrite the deck itself.

It should return structured feedback only.

During long fixed-round runs, it should read `professor_memory.md` and avoid repeating already resolved questions.

### 8.4 Verification Layer

The Verification Layer checks whether the current artifacts are valid.

MVP implementation should be scripts, not a dedicated verifier agent.

Initial checks:

- `deck_spec.json` schema is valid
- slide IDs are unique
- each slide has a central message
- bullet count is within limits
- required speaker notes exist
- source references are present where expected
- Marp rendering succeeds
- output files exist

Later checks:

- source references support slide claims
- figures and tables exist
- numeric values match source material
- rendered screenshots are readable
- layout has no obvious overlap

---

## 9. Professor feedback schema

Professor feedback should be machine-readable.

Example:

```json
{
  "round": 3,
  "overall_judgement": "revise",
  "questions": [
    {
      "id": "q-003-01",
      "severity": "critical",
      "target_slide": 4,
      "question": "Why does this method solve the limitation of the previous method? The causal link is not explained.",
      "expected_fix": "Add a comparison diagram that maps previous-method failure points to proposed-method mechanisms.",
      "question_type": "causal_gap"
    }
  ],
  "positive_points": [
    "The problem introduction is understandable."
  ],
  "must_fix_before_next_round": [
    "slide 4 causal explanation is missing",
    "slide 7 result interpretation is missing"
  ]
}
```

Recommended `question_type` values:

- `missing_prerequisite`
- `causal_gap`
- `undefined_term`
- `too_dense`
- `weak_example`
- `unsupported_claim`
- `bad_order`
- `visual_confusion`
- `result_interpretation_missing`
- `audience_mismatch`

---

## 10. Builder response schema

The builder should first answer professor questions before editing the deck.

Example:

```json
{
  "question_id": "q-003-01",
  "answer": "The previous method mainly relies on local features, so it struggles to capture long-range dependencies. The proposed method explicitly models global relationships, which addresses this limitation.",
  "source_refs": [
    {"page": 3, "section": "Method"},
    {"page": 5, "section": "Experiments"}
  ],
  "planned_edit": {
    "action": "insert_slide",
    "after_slide": 3,
    "new_slide_message": "The proposed method handles long-range relationships that the previous method misses."
  }
}
```

This prevents feedback from becoming vague. The loop becomes a process of filling explanation gaps.

---

## 11. DeckSpec-first design

The deck should be represented by `deck_spec.json` before rendering.

This keeps the system renderer-independent.

Example:

```json
{
  "deck_id": "sample-paper",
  "audience": "information science undergraduate",
  "goal": "Explain the paper's problem, proposed method, and results in 15 minutes.",
  "slides": [
    {
      "id": "s04",
      "role": "core_concept",
      "title": "Core idea of the proposed method",
      "message": "The method reasons over global relationships instead of only local features.",
      "bullets": [
        "Previous methods tend to depend on nearby features.",
        "The proposed method can handle distant relationships.",
        "This makes it easier to capture complex structure."
      ],
      "visual": {
        "type": "before_after_diagram",
        "description": "Compare the visible range of the previous method and proposed method."
      },
      "speaker_notes": "Start with the difference in what each method can observe, before introducing formulas.",
      "source_refs": [
        {
          "page": 4,
          "section": "Method"
        }
      ]
    }
  ]
}
```

Core DeckSpec rules:

- `deck_id` is required
- `audience` is required
- `goal` is required
- each slide must have `id`, `role`, `title`, `message`, and `speaker_notes`
- each slide should have at most 3 bullets
- each slide should have one central message
- source-backed factual claims should include `source_refs`
- visuals should be represented abstractly first, then rendered later

---

## 12. Slide rendering strategy

Initial renderer:

```text
DeckSpec
↓
Marp Markdown
↓
PDF / PPTX
```

Later renderer:

```text
DeckSpec
↓
PptxGenJS
↓
Editable PPTX
```

Reasoning:

- Marp is good for a fast MVP.
- PptxGenJS is better for editable PowerPoint output.
- Keeping DeckSpec as the source of truth allows renderer changes later.

Do not start by directly editing PPTX files. That would make early iteration slower and harder to debug.

---

## 13. Planned Claude Code structure

Possible future structure:

```text
.claude/
├─ agents/
│  ├─ slide-builder.md
│  └─ professor-critic.md
└─ skills/
   └─ make-slides/
      └─ SKILL.md
```

### slide-builder.md draft role

```text
Build and revise learner-friendly slide decks from papers, PDFs, Markdown, and technical concepts.
```

### professor-critic.md draft role

```text
Review generated slide decks like a strict professor and ask questions that reveal unclear reasoning, missing prerequisites, and unsupported claims.
```

### make-slides skill draft role

```text
Generate a learner-friendly slide deck from a PDF, paper, Markdown file, or concept using a builder-critic loop.
```

These files should be added in a later implementation PR.

---

## 14. Planned script structure

The first implementation should keep scripts simple.

Possible structure:

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

Responsibilities:

- `orchestrate.ts`: run loop, update state, call stages, save snapshots
- `run_builder.ts`: invoke or guide Slide Builder behavior for the current round
- `run_critic.ts`: invoke or guide Professor Critic behavior for the current round
- `check_deck.ts`: validate DeckSpec and slide constraints
- `check_render.ts`: validate rendered artifacts exist and build successfully
- `render_marp.ts`: convert DeckSpec to Marp output
- `select_best_round.ts`: choose final artifacts for fixed-round mode

Pseudocode:

```text
for round in 0..max_rounds-1:
  update run_state.json
  policy = get_round_policy(round, max_rounds)
  run builder with policy
  render slides
  run professor critic
  run verifier scripts
  update memory files
  compute round score
  save snapshot

if stop_mode == "fixed_rounds":
  select best round
else:
  stop when checks pass
```

---

## 15. Implementation phases

### Phase 1: Minimal MVP

Goal:

```text
input Markdown or PDF
↓
DeckSpec
↓
slides.md
↓
slides.pdf
```

Tasks:

- create repository scaffold
- define DeckSpec schema
- implement simple Markdown input path
- generate `research_notes.md`
- generate `outline.json`
- generate `deck_spec.json`
- generate Marp `slides.md`
- run 1 to 3 critique rounds
- generate `quality_report.md`

### Phase 2: Professor loop

Tasks:

- create `critique_rounds.jsonl`
- create `unresolved_questions.md`
- create `edit_plan.json`
- create `answer_to_professor.json`
- add structured critic schema validation
- add stop condition handling

### Phase 3: Orchestration script and fixed-round mode

Tasks:

- create `scripts/orchestrate.ts`
- create `run_config.json`
- create `run_state.json`
- support `stop_mode: "until_pass"`
- support `stop_mode: "fixed_rounds"`
- support `max_rounds: 50` and `max_rounds: 100`
- add round policy selection
- add snapshot creation under `snapshots/round-xxx/`
- add `round_scores.jsonl`
- add `select_best_round.ts`
- generate `loop_report.md`

This phase should still avoid treating the Orchestrator as a separate AI agent. It should be a control layer.

### Phase 4: Source fidelity

Tasks:

- create `source_map.json`
- require `source_refs` for factual slides
- generate `source_fidelity_report.md`
- check unsupported claims
- check whether important source claims are omitted

### Phase 5: Visual review

Tasks:

- render slides to PDF
- convert pages to screenshots
- evaluate text density
- evaluate layout problems
- evaluate whether visual descriptions match slide messages
- feed visual review back into edit plan

### Phase 6: Editable PPTX

Tasks:

- add PptxGenJS renderer
- support title, bullets, diagrams, source footer, and speaker notes
- preserve DeckSpec as the canonical representation
- export `slides.pptx`

---

## 16. Non-goals for the first implementation

Do not implement these in the first PR:

- full web UI
- automatic image generation
- full PowerPoint template adaptation
- multi-user collaboration
- cloud API dependency
- autonomous long-loop execution without file-backed state, snapshots, and resume support
- full academic citation manager
- visual design optimization beyond basic checks

Long fixed-round loops are not forbidden as a concept. They should be implemented only after the MVP loop, state files, snapshots, and verifier scripts exist.

---

## 17. First implementation PR target

The first implementation PR after this planning PR should add:

- `CLAUDE.md`
- `.claude/agents/slide-builder.md`
- `.claude/agents/professor-critic.md`
- `.claude/skills/make-slides/SKILL.md`
- basic `DeckSpec` schema
- minimal Markdown input pipeline
- Marp renderer
- simple critique loop with max 3 rounds

This first implementation should not yet include full fixed 50/100 round execution. It should prepare the file-backed state layout so that fixed-round mode can be added safely in a later PR.

This planning document should be treated as the baseline for that work.
