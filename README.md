# Claude Code Learnable Deck

Claude Code とローカル Ollama を使って、論文・PDF・Markdown・技術メモから **人間が理解しやすいスライド** を作るための実験リポジトリです。

普通の「文章をスライドに要約するツール」ではなく、元資料をいったん学習しやすい順番に組み直し、教授役の Critic に質問させながら、説明の穴を埋めていく構成を目指しています。🧠

```text
source / PDF / Markdown
↓
DeckSpec(JSON)
↓
Slide Builder がスライド案を作る
↓
Professor Critic が質問・指摘する
↓
Verifier が品質を確認する
↓
複数ラウンドの中から best round を選ぶ
↓
final deck
```

## 何ができるか

現時点では、固定ラウンドで回す MVP が実装されています。

対応していること:

- `DeckSpec` を中心にしたファイルベースの状態管理
- 設定した回数だけ Builder / Critic / Verifier を回す固定ループ
- `LLD_USE_CLAUDE=1` のとき Claude Code 経由で Builder / Critic を実行
- Claude Code が使えない場合の deterministic fallback
- Marp Markdown の生成
- 任意で Marp から PDF / PPTX を出力
- `pdftotext` がある場合の PDF テキスト抽出
- ラウンドごとの snapshot 保存
- 最終ラウンドではなく、スコアの良い round を選ぶ best-round selection
- `.env` による Ollama モデルプロファイル切り替え
- CI smoke test

## まず動かす

最初は Claude Code を使わず、fallback 経路で smoke test するのが安全です。

```bash
npm install
cp .env.example .env
npm run smoke
```

生成物は `outputs/smoke/` 以下に出ます。

```bash
cat outputs/smoke/final/slides.md
cat outputs/smoke/reports/final_summary.md
```

## Claude Code + ローカル Ollama で動かす

### 1. Ollama が動いているか確認

```bash
ollama list
```

### 2. `.env` を編集

例:

```env
ANTHROPIC_AUTH_TOKEN=ollama
ANTHROPIC_BASE_URL=http://localhost:11434
LLD_USE_CLAUDE=1
LLD_MODEL_PROFILE=qwen3_coder_next
```

### 3. 小さく試す

```bash
npm run make-slides -- --input examples/sample.md --deck sample-claude --rounds 3
```

### 4. 問題なければ長めに回す

```bash
npm run make-slides -- --input examples/sample.md --deck sample-50 --rounds 50
```

## モデルプロファイル

`.env` の `LLD_MODEL_PROFILE` で使うモデルを切り替えます。

```text
gemma4_31b_thinking
gpt_oss_120b
qwen3_coder_next
direct
```

例:

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

ローカルの Ollama のタグ名が違う場合は、`ollama list` に出てくる名前に合わせて `LLD_MODEL_*` を変更してください。

## 入力ファイル

Markdown / text はそのまま読めます。

```bash
npm run make-slides -- --input inputs/my-note.md --deck my-note --rounds 10
```

PDF は `pdftotext` が入っている場合にテキスト抽出できます。

macOS:

```bash
brew install poppler
```

Ubuntu:

```bash
sudo apt-get update
sudo apt-get install -y poppler-utils
```

PDF を入力する例:

```bash
npm run make-slides -- --input inputs/paper.pdf --deck paper --rounds 10
```

## 出力先

出力は `outputs/<deck_id>/` 以下に保存されます。

```text
outputs/<deck_id>/
├─ source/      # 抽出した元資料
├─ working/     # DeckSpec、批評ログ、検証ログなど
├─ render/      # Marp Markdown などのレンダリング前後ファイル
├─ snapshots/   # 各roundの保存結果
├─ final/       # best roundとして選ばれた最終成果物
└─ reports/     # 最終サマリーなど
```

よく見るファイル:

- `source/extracted.md`
- `working/deck_spec.json`
- `working/critique_rounds.jsonl`
- `working/verifier_reports.jsonl`
- `working/round_scores.jsonl`
- `working/claude_runs.jsonl`
- `render/slides.md`
- `snapshots/round-xxx/`
- `final/deck_spec.json`
- `final/slides.md`
- `reports/final_summary.md`

## 仕組み

### 1. DeckSpec を中心にする

このリポジトリでは、スライドをいきなり PPTX にしません。

まず `deck_spec.json` という中間表現を作ります。

```text
source
↓
DeckSpec(JSON)
↓
Marp Markdown / PDF / PPTX
```

これにより、Claude Code が途中から再開しやすくなり、各ラウンドの差分も追いやすくなります。

### 2. Slide Builder

`.claude/agents/slide-builder.md` に定義されています。

役割:

- 元資料を読む
- 学習しやすい順番に組み替える
- `deck_spec.json` を作る / 修正する
- 1スライド1メッセージにする
- 具体例・図解・比較・speaker notes を入れる
- source refs をできるだけ付ける

### 3. Professor Critic

`.claude/agents/professor-critic.md` に定義されています。

単なるレビュー係ではなく、教授・初心者・認知負荷レビュアーを混ぜたような役割です。

主な視点:

- `naive_student`: 初心者として詰まるところを聞く
- `strict_professor`: 因果・根拠・比較・限界を詰める
- `cognitive_load_reviewer`: 文字量・視線移動・図表の読みやすさを見る
- `source_fidelity_reviewer`: 元資料とズレていないか確認する
- `cognitive_mirror`: 「このスライドはこう読めるけど合ってる？」と誤読を返す

### 4. Verifier

`scripts/check_deck.ts` などで、最低限の機械的チェックを行います。

例:

- bullets が多すぎないか
- speaker notes があるか
- source refs があるか
- 具体例や check question があるか
- why/how/mechanism が説明されているか
- limitation / scope があるか

## スライド品質の考え方

このリポジトリでは、次のようなスライドを目指します。

- 1枚につき中心メッセージは1つ
- 箇条書きは最大3つ程度
- 見える要素を詰め込みすぎない
- タイトルやメッセージは短くする
- 図・表・比較・具体例を使う
- グラフには読み取るべきポイントを添える
- 事実と解釈を分ける
- 元資料の根拠を `source_refs` に残す
- 結果だけでなく「その結果が何を意味するか」を説明する
- 限界・前提・適用範囲も書く

## 推奨する説明順

技術資料や論文をスライド化するときは、元資料の順番をそのままコピーするより、次のような順番に並べ替えることを優先します。

```text
学習目標
↓
問題・動機
↓
前提知識・用語定義
↓
コアアイデア
↓
小さな具体例
↓
仕組み・処理手順
↓
結果・根拠
↓
結果の解釈
↓
限界・適用範囲
↓
確認問題・まとめ
```

## ドキュメント

- [Usage Guide](docs/usage.md)
- [Configuration Reference](docs/configuration.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Architecture Plan](docs/architecture-plan.md)
- [Configured Iteration Plan](docs/configured-iteration-plan.md)
- [Critique Taxonomy](docs/critique-taxonomy.md)
- [Research-grounded Prompting Guide](docs/research-grounded-prompting.md)

## Claude Code 関連ファイル

- `CLAUDE.md`
- `.claude/agents/slide-builder.md`
- `.claude/agents/professor-critic.md`
- `.claude/skills/make-slides/SKILL.md`

## 実行モード

```text
LLD_USE_CLAUDE=0
```

Claude Code を使わず、deterministic fallback で動かします。CIやsmoke test向きです。

```text
LLD_USE_CLAUDE=1
```

Claude Code backed Builder / Critic を使います。Claude Code が失敗した場合は、設定により fallback できます。

```env
LLD_CLAUDE_FALLBACK_ON_ERROR=1
```

## 今後やると良さそうなこと

- PPTX出力の品質向上
- スクリーンショットによる視覚レビュー
- 図表・チャート生成の強化
- DeckSpec schema の拡張
- 評価指標と best-round selection の改善
- 日本語スライド向けの改行・フォント・文字量チェック
