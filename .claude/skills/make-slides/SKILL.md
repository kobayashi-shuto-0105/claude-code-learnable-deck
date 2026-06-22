---
name: make-slides
description: Generate a learner-friendly slide deck using the configured fixed-round Builder/Critic loop.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

Use the repository runner instead of manually looping in chat.

Default command:

```bash
npm run make-slides -- --input examples/sample.md --deck sample --rounds 50
```

Smoke test:

```bash
npm run make-slides -- --input examples/sample.md --deck sample --rounds 3
```

Workflow:

1. Load `.env` model configuration.
2. Initialize output directories.
3. Create or update `run_config.json`.
4. Run fixed Builder → Render → Professor Critic → Verifier rounds.
5. Save snapshots under `outputs/<deck_id>/snapshots/`.
6. Write scores to `round_scores.jsonl`.
7. Select the best round.
8. Copy selected artifacts to `outputs/<deck_id>/final/`.

Do not rely on the current conversation as the only memory.
