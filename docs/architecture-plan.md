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
├─ Orchestrator
│  └─ controls workflow, loop state, stop conditions, and artifacts
│
├─ Slide Builder
│  ├─ research
│  ├─ concept structuring
│  ├─ storyboarding
│  ├─ DeckSpec generation
│  ├─ slide rendering
│  └─ revision
│
└─ Professor Critic
   ├─ asks hard questions
   ├─ finds unclear reasoning
   ├─ finds missing prerequisites
   ├─ finds unsupported claims
   ├─ finds audience mismatch
   └─ requests concrete fixes
```

The system should be built around a **builder-critic loop**.

The Slide Builder creates and revises the deck. The Professor Critic acts like a strict professor who asks questions until the explanation becomes understandable.

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
│  ├─ research_notes.md
│  ├─ concept_graph.json
│  ├─ outline.json
│  ├─ deck_spec.json
│  ├─ professor_memory.md
│  ├─ critique_rounds.jsonl
│  ├─ unresolved_questions.md
│  ├─ edit_plan.json
│  └─ answer_to_professor.json
│
├─ render/
│  ├─ slides.md
│  ├─ slides.pdf
│  ├─ slides.pptx
│  └─ screenshots/
│
└─ reports/
   ├─ quality_report.md
   ├─ source_fidelity_report.md
   └─ final_summary.md
```

This makes the agent behavior auditable and makes it easier for Claude Code to continue work across long runs.

---

## 4. Core loop

The initial idea was a loop between:

- research / composition / slide creation and revision
- professor-like evaluator / feedback giver

This should be implemented as a bounded loop with explicit stop conditions, not as an unbounded 100-round loop.

Recommended defaults:

```text
max_rounds = 8
minimum_rounds = 1
```

Stop when all of these are true:

- no critical issues remain
- no unresolved professor questions remain
- source fidelity check passes
- readability check passes
- slide density check passes

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

---

## 5. Agent responsibilities

### 5.1 Orchestrator

The Orchestrator manages the whole run.

Responsibilities:

- create output directories
- decide `deck_id`
- track loop count
- call or simulate the builder and critic stages
- enforce stop conditions
- ensure all required artifacts exist
- prevent uncontrolled loops
- summarize final status

It should not directly write the deck content unless necessary.

---

### 5.2 Slide Builder

The Slide Builder is responsible for creating and revising the deck.

Responsibilities:

- read source material
- extract important claims, terms, figures, and relationships
- create `research_notes.md`
- create `concept_graph.json`
- create `outline.json`
- create `deck_spec.json`
- create `slides.md`
- render slides
- answer Professor Critic questions
- revise the deck based on verified feedback

Rules:

- never render final slides directly from raw PDF text
- always go through `deck_spec.json`
- one slide must have one central message
- each slide should be optimized for learner understanding
- prefer diagrams, comparisons, examples, and step-by-step explanation
- do not blindly follow the paper order
- use source references whenever possible

---

### 5.3 Professor Critic

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

---

## 6. Professor feedback schema

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

## 7. Builder response schema

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

## 8. DeckSpec-first design

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

## 9. Slide rendering strategy

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

## 10. Planned Claude Code structure

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

## 11. Implementation phases

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

---

### Phase 2: Professor loop

Tasks:

- create `critique_rounds.jsonl`
- create `unresolved_questions.md`
- create `edit_plan.json`
- create `answer_to_professor.json`
- add structured critic schema validation
- add stop condition handling

---

### Phase 3: Source fidelity

Tasks:

- create `source_map.json`
- require `source_refs` for factual slides
- generate `source_fidelity_report.md`
- check unsupported claims
- check whether important source claims are omitted

---

### Phase 4: Visual review

Tasks:

- render slides to PDF
- convert pages to screenshots
- evaluate text density
- evaluate layout problems
- evaluate whether visual descriptions match slide messages
- feed visual review back into edit plan

---

### Phase 5: Editable PPTX

Tasks:

- add PptxGenJS renderer
- support title, bullets, diagrams, source footer, and speaker notes
- preserve DeckSpec as the canonical representation
- export `slides.pptx`

---

## 12. Non-goals for the first implementation

Do not implement these in the first PR:

- full web UI
- automatic image generation
- full PowerPoint template adaptation
- multi-user collaboration
- cloud API dependency
- long 100-round autonomous loops
- full academic citation manager
- visual design optimization beyond basic checks

---

## 13. First implementation PR target

The first implementation PR after this planning PR should add:

- `CLAUDE.md`
- `.claude/agents/slide-builder.md`
- `.claude/agents/professor-critic.md`
- `.claude/skills/make-slides/SKILL.md`
- basic `DeckSpec` schema
- minimal Markdown input pipeline
- Marp renderer
- simple critique loop with max 3 rounds

This planning document should be treated as the baseline for that work.
