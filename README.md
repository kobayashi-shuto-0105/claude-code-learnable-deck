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
- CI typecheck and smoke test

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` based on your local `ollama list` output.

Supported model profiles:

```text
gemma4_31b_thinking
gpt_oss_120b
qwen3_coder_next
direct
```

Example:

```env
LLD_MODEL_PROFILE=qwen3_coder_next
LLD_MODEL_QWEN3_CODER_NEXT=qwen3-coder-next
```

For gpt-oss:

```env
LLD_MODEL_PROFILE=gpt_oss_120b
LLD_MODEL_GPT_OSS_120B=gpt-oss:120b
```

For Gemma:

```env
LLD_MODEL_PROFILE=gemma4_31b_thinking
LLD_MODEL_GEMMA4_31B_THINKING=gemma4:31b-thinking
```

If your local Ollama tag is different, change the value in `.env`.

## Run without Claude Code

This uses the deterministic fallback Builder/Critic. It is useful for CI and smoke testing.

```env
LLD_USE_CLAUDE=0
```

```bash
npm run smoke
```

Or manually:

```bash
npm run make-slides -- --input examples/sample.md --deck sample --rounds 3
```

## Run with Claude Code + local Ollama

Make sure Ollama is running and Claude Code can reach the Anthropic-compatible endpoint.

```env
ANTHROPIC_AUTH_TOKEN=ollama
ANTHROPIC_BASE_URL=http://localhost:11434
LLD_USE_CLAUDE=1
LLD_MODEL_PROFILE=qwen3_coder_next
```

Then run:

```bash
npm run make-slides -- --input examples/sample.md --deck sample --rounds 3
```

Use a longer configured run when the small run works:

```bash
npm run make-slides -- --input examples/sample.md --deck sample --rounds 50
```

If Claude Code fails or returns invalid JSON, the default behavior is to fall back to deterministic local logic:

```env
LLD_CLAUDE_FALLBACK_ON_ERROR=1
```

Set it to `0` to stop the run on Claude errors.

## Input files

Markdown and text files are read directly.

PDF files are supported when the optional `pdftotext` command is installed. On macOS this usually comes from poppler:

```bash
brew install poppler
```

Then run:

```bash
npm run make-slides -- --input inputs/paper.pdf --deck paper --rounds 10
```

If `pdftotext` is not available, the run still creates a clear placeholder extraction file under `outputs/<deck_id>/source/extracted.md`.

## Output

Outputs are written under:

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

## Claude Code integration

Project instructions:

- `CLAUDE.md`

Agents:

- `.claude/agents/slide-builder.md`
- `.claude/agents/professor-critic.md`

Skill:

- `.claude/skills/make-slides/SKILL.md`

The script path now supports both modes:

- `LLD_USE_CLAUDE=0`: deterministic fallback
- `LLD_USE_CLAUDE=1`: Claude Code backed Builder/Critic with fallback on error

## Architecture docs

- [Architecture Plan](docs/architecture-plan.md)
- [Configured Iteration Plan](docs/configured-iteration-plan.md)
