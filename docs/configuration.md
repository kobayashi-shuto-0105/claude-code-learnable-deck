# Configuration Reference

Configuration is loaded from `.env`.

Copy the example first:

```bash
cp .env.example .env
```

## Claude Code / Ollama connection

| Variable | Default | Meaning |
|---|---:|---|
| `ANTHROPIC_AUTH_TOKEN` | `ollama` | Token value passed to Claude Code for the Anthropic-compatible endpoint. |
| `ANTHROPIC_BASE_URL` | `http://localhost:11434` | Ollama Anthropic-compatible endpoint. |
| `LLD_CLAUDE_BIN` | `claude` | Claude Code CLI binary/path. |
| `LLD_USE_CLAUDE` | `0` | `0` uses deterministic fallback. `1` calls Claude Code. |
| `LLD_CLAUDE_FALLBACK_ON_ERROR` | `1` | Fall back to local deterministic logic when Claude Code fails or returns invalid JSON. |
| `LLD_CLAUDE_MAX_BUFFER` | `50000000` | Max stdout/stderr buffer for Claude Code CLI calls. |
| `LLD_MAX_SOURCE_CHARS` | `20000` | Max source excerpt sent to Builder prompt. |

## Model profiles

| Profile | Env variable for actual Ollama tag |
|---|---|
| `gemma4_31b_thinking` | `LLD_MODEL_GEMMA4_31B_THINKING` |
| `gpt_oss_120b` | `LLD_MODEL_GPT_OSS_120B` |
| `qwen3_coder_next` | `LLD_MODEL_QWEN3_CODER_NEXT` |
| `direct` | `LLD_MODEL_DIRECT` |

Example:

```env
LLD_MODEL_PROFILE=qwen3_coder_next
LLD_MODEL_QWEN3_CODER_NEXT=qwen3-coder-next
```

Use `direct` when you want to pass a raw model tag without using one of the named profiles:

```env
LLD_MODEL_PROFILE=direct
LLD_MODEL_DIRECT=my-local-model-tag
```

## Role-specific model overrides

| Variable | Meaning |
|---|---|
| `LLD_BUILDER_MODEL_PROFILE` | Optional profile for Builder. Empty means use `LLD_MODEL_PROFILE`. |
| `LLD_CRITIC_MODEL_PROFILE` | Optional profile for Professor Critic. Empty means use `LLD_MODEL_PROFILE`. |

Example:

```env
LLD_MODEL_PROFILE=qwen3_coder_next
LLD_BUILDER_MODEL_PROFILE=qwen3_coder_next
LLD_CRITIC_MODEL_PROFILE=gpt_oss_120b
```

## Loop defaults

| Variable | Default | Meaning |
|---|---:|---|
| `LLD_DEFAULT_MAX_ROUNDS` | `50` | Default configured loop count when `--rounds` is omitted. |
| `LLD_TARGET_SLIDE_COUNT` | `12` | Target slide count. |
| `LLD_AUDIENCE` | `information science undergraduate` | Default target audience. |
| `LLD_DURATION_MINUTES` | `15` | Default deck duration. |

CLI flags override these defaults:

```bash
npm run make-slides -- --input examples/sample.md --deck sample --rounds 10 --slides 8 --duration 7 --audience "beginner engineer"
```

## Input / rendering

| Variable | Default | Meaning |
|---|---:|---|
| `LLD_PDF_MAX_BUFFER` | `50000000` | Max buffer for optional `pdftotext` extraction. |
| `LLD_RUN_MARP_EXPORT` | `0` | `0` writes Marp Markdown only. `1` also asks Marp CLI for PDF/PPTX export. |

## Recommended local profiles

### Fallback-only mode

```env
LLD_USE_CLAUDE=0
LLD_RUN_MARP_EXPORT=0
```

### Claude Code + Qwen3-Coder-Next

```env
ANTHROPIC_AUTH_TOKEN=ollama
ANTHROPIC_BASE_URL=http://localhost:11434
LLD_USE_CLAUDE=1
LLD_MODEL_PROFILE=qwen3_coder_next
LLD_MODEL_QWEN3_CODER_NEXT=qwen3-coder-next
```

### Claude Code + gpt-oss:120b

```env
ANTHROPIC_AUTH_TOKEN=ollama
ANTHROPIC_BASE_URL=http://localhost:11434
LLD_USE_CLAUDE=1
LLD_MODEL_PROFILE=gpt_oss_120b
LLD_MODEL_GPT_OSS_120B=gpt-oss:120b
```

### Claude Code + Gemma profile

```env
ANTHROPIC_AUTH_TOKEN=ollama
ANTHROPIC_BASE_URL=http://localhost:11434
LLD_USE_CLAUDE=1
LLD_MODEL_PROFILE=gemma4_31b_thinking
LLD_MODEL_GEMMA4_31B_THINKING=gemma4:31b-thinking
```
