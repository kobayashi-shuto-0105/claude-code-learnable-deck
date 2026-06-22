# Claude Code Learnable Deck

Claude Code + local Ollama based agent project for generating learner-friendly slide decks from papers, PDFs, Markdown notes, and technical concepts.

The project goal is not to build a generic slide generator. The goal is to build a **learnable deck generation agent** that reconstructs source material into an understandable learning path and improves it through a professor-like critique loop.

## Current status

Fixed-loop MVP scaffold is implemented.

It currently supports:

- file-backed DeckSpec workflow
- configured fixed iteration count
- deterministic fallback Builder/Critic pipeline
- Marp Markdown rendering
- simple verifier scripts
- round snapshots
- best-round selection
- local Ollama model profile configuration through `.env`

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

## Usage

Smoke test with a small number of rounds:

```bash
npm run make-slides -- --input examples/sample.md --deck sample --rounds 3
```

Default-style fixed run:

```bash
npm run make-slides -- --input examples/sample.md --deck sample --rounds 50
```

Longer experiment:

```bash
npm run make-slides -- --input examples/sample.md --deck sample --rounds 100
```

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

- `working/deck_spec.json`
- `working/run_config.json`
- `working/run_state.json`
- `working/critique_rounds.jsonl`
- `working/verifier_reports.jsonl`
- `working/round_scores.jsonl`
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

The current scripts default to a deterministic fallback path so the scaffold can run without requiring Claude Code non-interactive execution. `.env` already contains the model profile settings needed to route future Claude Code calls to local Ollama.

## Architecture docs

- [Architecture Plan](docs/architecture-plan.md)
- [Configured Iteration Plan](docs/configured-iteration-plan.md)
