# Usage Guide

This guide explains how to run Claude Code Learnable Deck locally.

## 1. Install

```bash
npm install
cp .env.example .env
```

Then edit `.env` for your local environment.

## 2. Quick smoke test

Run the deterministic fallback path first. This does not require Claude Code, Ollama, or a local LLM.

```bash
npm run smoke
```

Manual equivalent:

```bash
npm run make-slides -- --input examples/sample.md --deck sample --rounds 3
```

Check the result:

```bash
cat outputs/sample/final/slides.md
cat outputs/sample/reports/final_summary.md
```

## 3. Run with Claude Code + local Ollama

Make sure Ollama is running and the model you want is available:

```bash
ollama list
```

Edit `.env`:

```env
ANTHROPIC_AUTH_TOKEN=ollama
ANTHROPIC_BASE_URL=http://localhost:11434
LLD_USE_CLAUDE=1
LLD_MODEL_PROFILE=qwen3_coder_next
```

Then run a small test:

```bash
npm run make-slides -- --input examples/sample.md --deck sample-claude --rounds 3
```

When that works, run a longer configured loop:

```bash
npm run make-slides -- --input examples/sample.md --deck sample-50 --rounds 50
```

## 4. Select model profile

Available profiles:

```text
gemma4_31b_thinking
gpt_oss_120b
qwen3_coder_next
direct
```

Qwen3-Coder-Next example:

```env
LLD_MODEL_PROFILE=qwen3_coder_next
LLD_MODEL_QWEN3_CODER_NEXT=qwen3-coder-next
```

gpt-oss 120B example:

```env
LLD_MODEL_PROFILE=gpt_oss_120b
LLD_MODEL_GPT_OSS_120B=gpt-oss:120b
```

Gemma example:

```env
LLD_MODEL_PROFILE=gemma4_31b_thinking
LLD_MODEL_GEMMA4_31B_THINKING=gemma4:31b-thinking
```

If your `ollama list` output uses a different tag, change the corresponding `LLD_MODEL_*` value.

## 5. Use role-specific models

You can use different local models for Builder and Critic.

```env
LLD_MODEL_PROFILE=qwen3_coder_next
LLD_BUILDER_MODEL_PROFILE=qwen3_coder_next
LLD_CRITIC_MODEL_PROFILE=gpt_oss_120b
```

Leave the role-specific values empty to use `LLD_MODEL_PROFILE` for both roles.

## 6. Markdown input

Create an input file:

```bash
mkdir -p inputs
cat > inputs/my-note.md <<'EOF'
# Transformer overview

Transformer uses self-attention to model token relationships directly.

Unlike RNNs, it can process sequence positions more parallelly and can represent long-range dependencies more easily.
EOF
```

Run:

```bash
npm run make-slides -- --input inputs/my-note.md --deck transformer --rounds 10
```

## 7. PDF input

PDF text extraction uses the optional `pdftotext` command.

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

If `pdftotext` is not installed, the command still creates `outputs/<deck_id>/source/extracted.md` with a clear placeholder message.

## 8. Output layout

```text
outputs/<deck_id>/
├─ source/
│  └─ extracted.md
├─ working/
│  ├─ deck_spec.json
│  ├─ run_config.json
│  ├─ run_state.json
│  ├─ critique_rounds.jsonl
│  ├─ verifier_reports.jsonl
│  ├─ round_scores.jsonl
│  └─ claude_runs.jsonl
├─ render/
│  └─ slides.md
├─ snapshots/
│  └─ round-xxx/
├─ final/
│  ├─ deck_spec.json
│  └─ slides.md
└─ reports/
   ├─ loop_report.md
   └─ final_summary.md
```

Start by checking:

```bash
cat outputs/<deck_id>/final/slides.md
cat outputs/<deck_id>/working/run_config.json
cat outputs/<deck_id>/working/claude_runs.jsonl
```

## 9. Optional PDF/PPTX export through Marp

By default, the renderer writes `slides.md` only.

To ask Marp to export PDF/PPTX as well:

```env
LLD_RUN_MARP_EXPORT=1
```

Then rerun:

```bash
npm run make-slides -- --input examples/sample.md --deck sample-export --rounds 3
```

Generated export files depend on the local Marp/Chromium environment.

## 10. Common commands

```bash
# deterministic fallback smoke test
npm run smoke

# 3-round local test
npm run make-slides -- --input examples/sample.md --deck sample --rounds 3

# 50-round configured run
npm run make-slides -- --input examples/sample.md --deck sample50 --rounds 50

# check an existing deck output
npm run check -- --deck sample

# render current deck_spec.json to slides.md
npm run render -- --deck sample

# select best round again
npm run select-best -- --deck sample
```
