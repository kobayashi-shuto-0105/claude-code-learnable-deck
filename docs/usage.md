# Usage Guide

This guide explains how to run Claude Code Learnable Deck locally.

By default, generated slides are Japanese and the slide count is automatic.

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
npm run make-slides -- --input examples/sample.md --deck sample --rounds 3 --language ja
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
LLD_OUTPUT_LANGUAGE=ja
LLD_TARGET_SLIDE_COUNT=auto
LLD_MODEL_PROFILE=qwen3_coder_next
```

Then run a small test. Do not pass `--slides` unless you want to force a target count.

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

## 5. Language and slide count

Default output language:

```env
LLD_OUTPUT_LANGUAGE=ja
```

Default slide count mode:

```env
LLD_TARGET_SLIDE_COUNT=auto
```

With auto mode, the Builder chooses the number of slides from source complexity and duration.

Force a specific slide count only when needed:

```bash
npm run make-slides -- --input examples/sample.md --deck sample-8 --rounds 3 --slides 8
```

Use English output only when needed:

```bash
npm run make-slides -- --input examples/sample.md --deck sample-en --rounds 3 --language en --audience "beginner engineers"
```

## 6. Use role-specific models

You can use different local models for Builder and Critic.

```env
LLD_MODEL_PROFILE=qwen3_coder_next
LLD_BUILDER_MODEL_PROFILE=qwen3_coder_next
LLD_CRITIC_MODEL_PROFILE=gpt_oss_120b
```

Leave the role-specific values empty to use `LLD_MODEL_PROFILE` for both roles.

## 7. Markdown input

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

## 8. PDF input

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

## 9. Output layout

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

`run_config.json` should show:

```json
{
  "language": "ja",
  "slide_count_mode": "auto",
  "target_slide_count": null
}
```

## 10. Optional PDF/PPTX export through Marp

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

## 11. Common commands

```bash
# deterministic fallback smoke test
npm run smoke

# 3-round Japanese auto-slide test
npm run make-slides -- --input examples/sample.md --deck sample --rounds 3

# 50-round configured run
npm run make-slides -- --input examples/sample.md --deck sample50 --rounds 50

# force 8 slides only when needed
npm run make-slides -- --input examples/sample.md --deck sample8 --rounds 3 --slides 8

# check an existing deck output
npx tsx scripts/check_deck.ts --deck sample
npx tsx scripts/check_render.ts --deck sample

# render current deck_spec.json to slides.md
npm run render -- --deck sample

# select best round again
npm run select-best -- --deck sample
```
