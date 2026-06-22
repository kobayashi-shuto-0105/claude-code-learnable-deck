# Troubleshooting

## `npm run smoke` fails

Check dependencies:

```bash
npm install
npm run smoke
```

If the command fails after creating `outputs/smoke/`, remove the generated output and retry:

```bash
rm -rf outputs/smoke
npm run smoke
```

## Claude Code is not being used

Check `.env`:

```env
LLD_USE_CLAUDE=1
```

Then inspect:

```bash
cat outputs/<deck_id>/working/run_config.json
cat outputs/<deck_id>/working/claude_runs.jsonl
```

If `claude_runs.jsonl` is missing, the run probably used fallback mode.

## Claude Code fails and fallback is used

Default behavior:

```env
LLD_CLAUDE_FALLBACK_ON_ERROR=1
```

This keeps the run going when Claude Code fails or returns invalid JSON.

To fail fast instead:

```env
LLD_CLAUDE_FALLBACK_ON_ERROR=0
```

Then rerun a small test:

```bash
npm run make-slides -- --input examples/sample.md --deck debug --rounds 1
```

## Ollama model not found

Check local model tags:

```bash
ollama list
```

Then edit `.env` to match the actual tag.

Example:

```env
LLD_MODEL_PROFILE=direct
LLD_MODEL_DIRECT=your-actual-model-tag
```

or update the profile-specific value:

```env
LLD_MODEL_PROFILE=qwen3_coder_next
LLD_MODEL_QWEN3_CODER_NEXT=your-qwen-tag
```

## Claude Code cannot reach Ollama

Check that Ollama is running:

```bash
ollama list
```

Check endpoint settings:

```env
ANTHROPIC_AUTH_TOKEN=ollama
ANTHROPIC_BASE_URL=http://localhost:11434
```

Try a very short run:

```bash
npm run make-slides -- --input examples/sample.md --deck ollama-debug --rounds 1
```

## Claude returns invalid JSON

Builder and Critic expect strict JSON.

By default the pipeline falls back to deterministic local logic. Check:

```bash
cat outputs/<deck_id>/working/claude_runs.jsonl
```

If you want to stop on invalid JSON:

```env
LLD_CLAUDE_FALLBACK_ON_ERROR=0
```

Run only one round while debugging:

```bash
npm run make-slides -- --input examples/sample.md --deck json-debug --rounds 1
```

## PDF text is not extracted

PDF support uses the optional `pdftotext` command.

macOS:

```bash
brew install poppler
```

Ubuntu:

```bash
sudo apt-get update
sudo apt-get install -y poppler-utils
```

Then rerun:

```bash
npm run make-slides -- --input inputs/paper.pdf --deck paper --rounds 3
```

Check extracted text:

```bash
cat outputs/paper/source/extracted.md
```

## PDF/PPTX export does not appear

By default only `slides.md` is generated.

Enable Marp export:

```env
LLD_RUN_MARP_EXPORT=1
```

Then rerun:

```bash
npm run make-slides -- --input examples/sample.md --deck export-test --rounds 3
```

If export still fails, inspect whether `render/slides.md` exists first:

```bash
cat outputs/export-test/render/slides.md
```

PDF/PPTX export can depend on the local Marp and Chromium environment.

## Output looks weak or repetitive

Use more rounds and a better model profile:

```bash
npm run make-slides -- --input inputs/my-note.md --deck my-note --rounds 50
```

Check critic and verifier logs:

```bash
cat outputs/my-note/working/critique_rounds.jsonl
cat outputs/my-note/working/verifier_reports.jsonl
cat outputs/my-note/working/round_scores.jsonl
```

## Best round seems wrong

Run selection again:

```bash
npm run select-best -- --deck <deck_id>
```

Then inspect:

```bash
cat outputs/<deck_id>/reports/final_summary.md
ls outputs/<deck_id>/snapshots/
```

The current selector is simple and score-based. If needed, manually inspect snapshots and copy the preferred round into `final/`.
