# Codex と Claude Code でスマホウォーズを開発する

## 初回の起動

1. ローカルに用意した **Claude Code 専用の作業フォルダー** を、Claude デスクトップの「Code」で選ぶ。選ぶ階層は `CLAUDE.md` と `dev-server.mjs` があるリポジトリのルート。CLIを使う場合は同じフォルダーで `claude` を起動する。
2. [初回プロンプト](CLAUDE-FIRST-PROMPT.md) のコード枠を貼り付ける。`CLAUDE.md` は `@AGENTS.md` を読み込むので、Codex と Claude Code の作業指示は同じファイルで更新できる。
3. Node.js 24 で `node --test` を実行する。通常の開発・テストには依存パッケージのインストールやAPIキーは不要。バージョン管理ツールを使う場合はルートの `.nvmrc` を使う。
4. デスクトップのプレビューで「スマホウォーズ」を起動する。`.claude/launch.json` はポート8081を使い、使用中なら空きポートに切り替える。実際のURLは起動ログで確認できる。

CLIやCodexで起動するときは `node dev-server.mjs` を使う。既定のURLは `http://127.0.0.1:8080/`。同時作業には別のポートを使う。次のPowerShell例は子プロセスだけにポートを指定する。

```powershell
cmd /c "set PORT=8081&& node dev-server.mjs"
```

ブラウザーの保存先はオリジン（ホストとポートを含む）ごとに分かれる。保存・復元の検証中は同じURLを使い、本番とローカルのどちらもテスト専用のブラウザープロファイルで開く。終了は自分が起動したサーバーのターミナルで Ctrl+C。

## 同時に作業するとき

既に専用クローンがあればそれを使う。別のPCで新たに用意する場合は、親フォルダーで次を一度実行する。

```powershell
git clone https://github.com/Yoshi2026s/famicom-wars.git sumaho-wars-claude
cd sumaho-wars-claude
```

着手時には担当するフォルダーで以下を確認する。独立したクローン間で未pushのコミットは共有されない。別のクローンで進めている作業は、担当者の引き継ぎとGitHub上のブランチ・PRで照合する。

```powershell
git remote -v
git status --short --branch
git worktree list
git fetch origin
git log -1 --oneline origin/main
gh pr list --repo Yoshi2026s/famicom-wars --base main
```

新しい実装依頼は、作業ツリーがきれいで担当が重複していないことを確認してから `git switch -c claude/<作業名> origin/main` で始める。Codex側は `codex/<作業名>` を使う。既存PRを交代する場合は、引き継ぎ元が最後の変更をそのブランチにpushし、引き継ぎ先がfetchした後、同じブランチ名・コミットで再開する。別の変更が先に統合されたら、最新の `origin/main` との差分を見て、重なる変更を調整して再検証する。

## 変更箇所と確認先

| 変更したいもの | 主な編集元 | 最初の確認先 |
| --- | --- | --- |
| 兵種、移動、戦闘、CPU、施設、生産 | `public/rules.js`、湾岸の配置は `public/coastal-scenario.js` | `test/coastal.test.mjs` と対象機能のテスト。旧マップは `test/crossing.test.mjs` |
| 盤面・操作・ダイアログ | `public/index.html`、`public/game.js`、`public/style.css`、`public/battlefield.css`、`public/orientation.js` | スマホ縦画面で部隊切替・全体図・生産・ターン終了、キーボードで選択とキャンセル |
| 自動保存、シナリオの切替・復元 | `public/crossing-save.js`、`public/game.js`、`public/rules.js` | `test/crossing-save.test.mjs` と `test/coastal.test.mjs`。再読込・旧セーブ・同時に開いたタブ |
| 戦闘演出、BGM、効果音 | `public/combat.js`、`public/combat.css`、`public/music.js`、`public/combat-audio.js` | `test/battle.test.mjs`、`test/music.test.mjs`。実際の再生、スキップ、音声設定の復元 |
| 素材・ホーム画面アイコン | `scripts/draw-assets.mjs`、`scripts/compose-bgm.mjs`、`public/manifest.webmanifest` | [READMEの再生成手順](../README.md#ローカル開発)。編集元と対象生成物の差分を照合 |

ゲームはビルド工程のない静的サイトで、`public/index.html` からスクリプトを順番に読み込む。湾岸の保存キーは `sumaho-wars:coastal-save`、旧対戦は `famicom-wars:crossing-save`。シナリオ選択は `sumaho-wars:scenario`。互換性確認にはテストで生成した進行を使う。

## PR・公開・引き継ぎ

1. 変更箇所のテストと画面操作を確認し、Node.js 24 で `node --test`、`git diff --check` を実行。対象ブランチから `main` 向けのPRを作る。
2. PRの最新コミットに対する `Test and deploy to GitHub Pages` の `test` と必須チェックの成功を確認し、原則squashマージする。PRでは `deploy` がスキップされる。
3. マージ後は [Actions](https://github.com/Yoshi2026s/famicom-wars/actions/workflows/pages.yml) で対象の `main` コミットの `deploy` 成功を確認し、[公開ゲーム](https://yoshi2026s.github.io/famicom-wars/) で盤面表示と影響のある操作を試す。公開されるのは `public/` の内容。

担当を交代するときは、次をPR本文または引き継ぎチャットに残す。公開PRには利用者データ、認証情報、個人フォルダーの絶対パスを含めない。

```text
目的・完了条件：
担当した範囲／次の担当者が編集する範囲：
ブランチ・最新コミット・PR：
未コミットまたは未pushの変更：
実行したテスト・結果・使用環境（エミュレーション／実機）：
マージ・Pages配信・公開画面の確認状況：
残っている作業と再開する箇所：
```
