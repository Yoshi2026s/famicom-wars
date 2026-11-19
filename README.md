# ファミコンウォーズ

## 現状

空の作業フォルダから開発環境を用意した段階です。ゲームの仕様、実装、素材、リモートリポジトリ、公開先は未設定です。

## ローカル開発

Node.js 24 を使います。追加パッケージのインストールは不要です。

```powershell
node --version
node --test
node dev-server.mjs
```

ブラウザーで http://127.0.0.1:8080/ を開きます。終了するにはターミナルで Ctrl+C を押します。

- `public/` にブラウザーへ配信する HTML、CSS、JavaScript、素材を置きます。
- `test/` に自動テストを置きます。変更後は `node --test` を実行します。

最初の開発では、対象とする作品・ルールを決め、小さな盤面でユニット選択から移動、ターン終了まで確認できる範囲を定めます。

## GitHub Pages への公開

1. 公開先の GitHub リポジトリに `main` を push します。
2. リポジトリの **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選びます。
3. **Actions → Test and deploy to GitHub Pages → Run workflow** から `main` を選んで初回配信します。配信ジョブが成功したら、ジョブに表示される公開 URL を開いて確認します。

以降は `main` 向けのプルリクエストでテストを実行します。`main` に反映した変更は、テスト成功後に `public/` の内容を自動配信します。プロジェクト用の Pages URL でも動くように、HTML 内の素材リンクは相対パスで指定します。
