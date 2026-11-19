# ファミコンウォーズ

## 現状

[GitHub Pages で遊ぶ](https://yoshi2026s.github.io/famicom-wars/)

「はじまりの草原」は5×5の盤面で歩兵を動かす、一人用のブラウザーゲームの試作です。中央の歩兵を選んでから印のあるマスを選ぶと、上下左右に合計2マスまで移動します。移動は各ターンに1回です。「ターン終了」でその位置から次のターンを始めます。ページを開き直すと最初の盤面に戻ります。

E2に訓練用の敵歩兵が1体います。最初のターンは、C3の味方歩兵を選び、E3に移動してからE2の敵を選ぶと撃破できます。敵の上下左右にいる間は、ターンをまたいでも敵を直接選んで攻撃できます。攻撃すると、そのターンの味方の行動は終了します。敵はその場で待機し、攻撃1回で盤面から消えます。撃破後も移動訓練を続けられます。「もう一度訓練する」で両方の歩兵が初期位置に戻ります。

スマホではタップ、キーボードではTabで盤面に入り、矢印キーとEnterまたはスペースで操作します。

訓練・歩兵戦とも、攻撃が成立すると専用の戦闘画面に切り替わります。攻撃する側のHPが8〜10なら3、4〜7なら2、1〜3なら1ダメージです。先に攻撃を受けた側が生き残ると、被弾後のHPで同じ画面から1回だけ反撃します。実際に減る量は相手の残りHPが上限です。「演出をスキップ」で攻撃と反撃を含む結果を先に確認し、「マップに戻る」で続行できます。

戦闘画面では夕暮れの高原を背景に、隊列が展開してから構え、射撃、被弾、後退が順に進みます。着弾に合わせて火花と土煙が立ち、ダメージと地形による軽減量が出ます。端末の「動きを減らす」が有効な場合は画面の動きを抑え、HPと結果を表示します。

マップと戦闘画面にある「効果音」で、射撃音と着弾音のオン・オフを切り替えます。初期設定はオフです。選択した設定は同じブラウザーで次に開いたときにも適用されます。演出をスキップすると、残りの効果音は停止します。

「BGM」は効果音とは別に設定します。マップではピアノとフルートが旋律を受け渡す「風渡る尾根」、戦闘ではブラスと打楽器が先導する「残照の激突」を再生します。どちらもオリジナル曲です。交戦のたびに戦闘曲の頭から始まり、戦闘後はマップ曲の続きに戻ります。画面を離れると一時停止します。初期設定はオフで、オン・オフは同じブラウザーに保存されます。

## 歩兵戦「草原の遭遇戦」

画面上部の「歩兵戦」、または訓練の撃破後に表示される「歩兵戦へ進む」から対戦を始めます。[歩兵戦を直接開く](https://yoshi2026s.github.io/famicom-wars/#battle)

最大HPは10です。歩兵戦では味方はB4、敵はD2に出撃し、どちらもHP10で始まります。訓練ではHP1から始まります。味方の移動と攻撃は訓練と同じ操作です。ターンを終了すると敵が最大1マス近づき、上下左右で隣接すれば攻撃を始めます。先に相手のHPを0にすると勝利です。反撃で敵を撃破した場合も勝利になります。決着後は「もう一度対戦する」で初期配置から再挑戦できます。

歩兵戦には草原・森・山があります。攻撃を受ける部隊のマスが森ならダメージを1、山なら2減らします。ダメージは最低1で、反撃にも同じ防御効果が働きます。たとえば味方をC3の森に移動してターンを終了すると、敵はC2の山に移動して攻撃します。敵の先攻は森で3から2に、味方の反撃は山で3から1に減ります。

同じページで訓練と歩兵戦を切り替えると、それぞれの盤面から再開できます。ページを再読み込みすると両方の進行が初期化されます。

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

- 盤面・補助背景・歩兵のドット絵の編集元は `scripts/draw-assets.mjs` です。`node scripts/draw-assets.mjs` でPNGを再生成できます。歩兵の戦闘用画像は待機・構え・反動の3コマを1ファイルに格納しています。
- 戦闘背景 `public/assets/highland-dusk.webp` は組み込みの画像生成で制作し、WebPに変換した素材です。
- BGMの曲データとMP3生成は `scripts/compose-bgm.mjs` にあります。`pnpm install --frozen-lockfile` で生成用の依存関係を取得し、`node scripts/compose-bgm.mjs` で2曲を再生成できます。

<details>
<summary>戦闘背景の生成プロンプト</summary>

> Create an original environment background for a retro browser tactical videogame battle. Landscape 3:2, edge to edge. Exceptional hand-crafted 32-bit pixel art with a perceptible pixel grid, nuanced clusters of color and selective dithering, elegant atmosphere. A luminous evening sun behind distant indigo mountain peaks over a wide highland valley; receding fir-covered ridges, amber rim light, violet cloud bands, light haze. The horizon is high (about 36% from top); from around 62% down is a broad uninterrupted FLAT readable meadow of sage grass and warm packed earth where side-view pixel soldiers will be composited; foreground grass only in little clusters at lower corners. Balanced composition with the sun slightly off-center. Keep the entire central three quarters and lower third readable and open so responsive crops also include the twilight valley and ground. Rich teal shadows and apricot gold sun, cinematic value separation without oppressive darkness. Background only, absolutely no sprites, no people, no buildings, no signs, no text, logos, battle effects, frames, or UI. Independent fictional setting; no resemblance to any specific game or existing asset.

</details>

## GitHub Pages への公開

1. 公開先の GitHub リポジトリに `main` を push します。
2. リポジトリの **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選びます。
3. **Actions → Test and deploy to GitHub Pages → Run workflow** から `main` を選んで初回配信します。配信ジョブが成功したら、ジョブに表示される公開 URL を開いて確認します。

以降は `main` 向けのプルリクエストでテストを実行します。`main` に反映した変更は、テスト成功後に `public/` の内容を自動配信します。プロジェクト用の Pages URL でも動くように、HTML 内の素材リンクは相対パスで指定します。
