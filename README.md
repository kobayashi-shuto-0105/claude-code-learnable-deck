# Claude Code Learnable Deck

Claude Code + local Ollama based agent project for generating learner-friendly slide decks from papers, PDFs, Markdown notes, and technical concepts.

The project goal is not to build a generic slide generator. The goal is to build a **learnable deck generation agent** that reconstructs source material into an understandable learning path and improves it through a professor-like critique loop.

## Current status

Fixed-loop MVP is implemented.

It currently supports:

- file-backed DeckSpec workflow
- configured fixed iteration count
- Claude Code backed Builder/Critic execution when `LLD_USE_CLAUDE=1`
- deterministic fallback Builder/Critic pipeline
- Marp Markdown rendering
- optional Marp PDF/PPTX export
- optional PDF text extraction through `pdftotext`
- simple verifier scripts
- round snapshots
- best-round selection
- local Ollama model profile configuration through `.env`
- CI smoke test

## Quick start

```bash
npm install
cp .env.example .env
npm run smoke
```

This runs the deterministic fallback path and writes outputs under `outputs/smoke/`.

Check the generated deck:

```bash
cat outputs/smoke/final/slides.md
cat outputs/smoke/reports/final_summary.md
```

## Run with Claude Code + local Ollama

1. Make sure Ollama is running.

```bash
ollama list
```

2. Edit `.env`.

```env
ANTHROPIC_AUTH_TOKEN=ollama
ANTHROPIC_BASE_URL=http://localhost:11434
LLD_USE_CLAUDE=1
LLD_MODEL_PROFILE=qwen3_coder_next
```

3. Run a small test.

```bash
npm run make-slides -- --input examples/sample.md --deck sample-claude --rounds 3
```

4. Run a longer configured loop.

```bash
npm run make-slides -- --input examples/sample.md --deck sample-50 --rounds 50
```

## Model profiles

Supported profiles:

```text
gemma4_31b_thinking
gpt_oss_120b
qwen3_coder_next
direct
```

Example `.env` values:

```env
LLD_MODEL_PROFILE=qwen3_coder_next
LLD_MODEL_QWEN3_CODER_NEXT=qwen3-coder-next
```

```env
LLD_MODEL_PROFILE=gpt_oss_120b
LLD_MODEL_GPT_OSS_120B=gpt-oss:120b
```

```env
LLD_MODEL_PROFILE=gemma4_31b_thinking
LLD_MODEL_GEMMA4_31B_THINKING=gemma4:31b-thinking
```

If your local Ollama tag is different, change the corresponding `LLD_MODEL_*` value in `.env`.

## Input files

Markdown and text files are read directly.

```bash
npm run make-slides -- --input inputs/my-note.md --deck my-note --rounds 10
```

PDF files are supported when `pdftotext` is installed.

macOS:

```bash
brew install poppler
```

Ubuntu:

```bash
sudo apt-get update
sudo apt-get install -y poppler-utils
```

Run:

```bash
npm run make-slides -- --input inputs/paper.pdf --deck paper --rounds 10
```

## Output layout

```text
outputs/<deck_id>/
├─ source/
├─ working/
├─ render/
├─ snapshots/
├─ final/
└─ reports/
```

Important files:

- `source/extracted.md`
- `working/deck_spec.json`
- `working/run_config.json`
- `working/run_state.json`
- `working/critique_rounds.jsonl`
- `working/verifier_reports.jsonl`
- `working/round_scores.jsonl`
- `working/claude_runs.jsonl`
- `render/slides.md`
- `snapshots/round-xxx/`
- `final/deck_spec.json`
- `final/slides.md`
- `reports/final_summary.md`

## Documentation

- [Usage Guide](docs/usage.md)
- [Configuration Reference](docs/configuration.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Architecture Plan](docs/architecture-plan.md)
- [Configured Iteration Plan](docs/configured-iteration-plan.md)

## Claude Code integration

Project instructions:

- `CLAUDE.md`

Agents:

- `.claude/agents/slide-builder.md`
- `.claude/agents/professor-critic.md`

Skill:

- `.claude/skills/make-slides/SKILL.md`

The script path supports both modes:

- `LLD_USE_CLAUDE=0`: deterministic fallback
- `LLD_USE_CLAUDE=1`: Claude Code backed Builder/Critic with fallback on error

## Professor Critic taxonomy

The Professor Critic uses multiple review lenses instead of generic feedback only:

- `naive_student`
- `strict_professor`
- `cognitive_load_reviewer`
- `source_fidelity_reviewer`
- `cognitive_mirror`

Critique questions include learner confusion, observed evidence, and acceptance criteria so the Builder can convert feedback into concrete edits.

See [Critique Taxonomy](docs/critique-taxonomy.md).

## Architecture docs

- [Architecture Plan](docs/architecture-plan.md)
- [Configured Iteration Plan](docs/configured-iteration-plan.md)
- [Critique Taxonomy](docs/critique-taxonomy.md)
