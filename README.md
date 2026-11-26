# ファミコンウォーズ

## 現状

[GitHub Pages で遊ぶ](https://yoshi2026s.github.io/famicom-wars/)

「はじまりの草原」は5×5の盤面で歩兵を動かす、一人用のブラウザーゲームの試作です。中央の歩兵を選んでから印のあるマスを選ぶと、上下左右に合計2マスまで移動します。移動は各ターンに1回です。「ターン終了」でその位置から次のターンを始めます。ページを開き直すと最初の盤面に戻ります。

E2に訓練用の敵歩兵が1体います。最初のターンは、C3の味方歩兵を選び、E3に移動してからE2の敵を選ぶと撃破できます。敵の上下左右にいる間は、ターンをまたいでも敵を直接選んで攻撃できます。攻撃すると、そのターンの味方の行動は終了します。敵はその場で待機し、攻撃1回で盤面から消えます。撃破後も移動訓練を続けられます。「もう一度訓練する」で両方の歩兵が初期位置に戻ります。

スマホは縦向きでタップ操作します。横向きでは案内が表示され、縦向きに戻すと続きから遊べます。キーボードではTabで盤面に入り、矢印キーとEnterまたはスペースで操作します。

訓練・歩兵戦とも、攻撃が成立すると専用の戦闘画面に切り替わります。攻撃する側のHPが8〜10なら3、4〜7なら2、1〜3なら1ダメージです。先に攻撃を受けた側が生き残ると、被弾後のHPで同じ画面から1回だけ反撃します。実際に減る量は相手の残りHPが上限です。「演出をスキップ」で攻撃と反撃を含む結果を先に確認し、「マップに戻る」で続行できます。

戦闘画面では「先攻」「反撃」を表示し、カメラが攻撃する隊列と被弾する隊列を追います。歩兵は構え、発射、反動、被弾、身を伏せる姿勢に切り替わります。隊列の位置に合わせて弾道が伸び、着弾地点に火花、土煙、ダメージ、地形による軽減量が出ます。端末の「動きを減らす」が有効な場合は画面の動きを抑え、HPと結果を表示します。

マップと戦闘画面にある「効果音」で、射撃音と着弾音のオン・オフを切り替えます。対応ブラウザーでは射撃側と着弾側に合わせて音の左右が切り替わります。初期設定はオフです。選択した設定は同じブラウザーで次に開いたときにも適用されます。演出をスキップすると、残りの効果音は停止します。

「BGM」は効果音とは別に設定します。マップでは「風渡る尾根」、戦闘では「薄明の攻防」を再生します。勝利時は金色の旗と上昇するファンファーレ、敗北時は青灰色の戦場と下降する旋律で結果を表示します。それぞれの決着曲は一度だけ流れ、勝敗画面は「マップに戻る」を押すまで表示します。戦闘後はマップ曲の続きに戻ります。画面を離れると一時停止します。初期設定はオフで、オン・オフは同じブラウザーに保存されます。

## 歩兵戦「草原の遭遇戦」

画面上部の「歩兵戦」、または訓練の撃破後に表示される「歩兵戦へ進む」から対戦を始めます。[歩兵戦を直接開く](https://yoshi2026s.github.io/famicom-wars/#battle)

最大HPは10です。歩兵戦では味方はB4、敵はD2に出撃し、どちらもHP10で始まります。訓練ではHP1から始まります。味方の移動と攻撃は訓練と同じ操作です。ターンを終了すると敵が最大1マス近づき、上下左右で隣接すれば攻撃を始めます。先に相手のHPを0にすると勝利です。反撃で敵を撃破した場合も勝利になります。決着後は「もう一度対戦する」で初期配置から再挑戦できます。

歩兵戦には草原・森・山があります。攻撃を受ける部隊のマスが森ならダメージを1、山なら2減らします。ダメージは最低1で、反撃にも同じ防御効果が働きます。たとえば味方をC3の森に移動してターンを終了すると、敵はC2の山に移動して攻撃します。敵の先攻は森で3から2に、味方の反撃は山で3から1に減ります。

## 車両戦「水辺の攻防」

上部の「水辺の攻防」から、14列×10行の作戦マップに移れます。[水辺の攻防を直接開く](https://yoshi2026s.github.io/famicom-wars/#crossing)

味方はB7に偵察車、D2に歩兵、C2に支援車が出撃します。敵はH2に歩兵、H6に偵察車、H3に支援車が出撃し、全員HP10で始まります。盤面かマップ上の部隊一覧で、動かす部隊を選びます。味方はそれぞれ1ターンに1回まで移動し、移動後も射程内の敵を攻撃できます。攻撃するとその部隊の行動が終了します。部隊一覧で双方のHPを確認でき、行動指示には敵の移動先と攻撃対象が表示されます。

歩兵は移動力2、偵察車は移動力4で、射程はどちらも1マスです。支援車は移動力1で、射程は上下左右で数えた距離2〜3マスです。戦車は移動力3・射程1で、攻撃と反撃の基礎ダメージが通常より1高くなります。相手が自分の射程内にいれば、攻撃を受けた直後に反撃できます。

敵のターンは出撃順に、生き残っている部隊が移動と攻撃をそれぞれ1回まで行います。全員の行動が終わると味方のターンに戻ります。

川や他の部隊がいるマスは通れません。F2・E6・E9にある橋を使うと、対岸まで進めます。湿地は移動力を2消費し、受けるダメージを1軽減します。森と山の防御効果は歩兵戦と同じです。

味方の本拠地はA7、敵の本拠地はN8です。歩兵を空いている敵本拠地へ移動させると、その場で占領して勝利します。敵歩兵に味方の本拠地を占領されると敗北です。いずれかの陣営が全滅した場合も決着します。「もう一度対戦する」で初期配置から再挑戦できます。

都市は4つあります。C4は味方、H5は敵が所有し、E2とF6は中立から始まります。歩兵を空いている都市に移動させると占領できます。初期資金は各陣営4,500で、2ターン目以降は毎ターンの開始時に所有都市1つにつき1,000が入ります。同時に、自軍の都市や工場にいる生存部隊はHPを2回復します（最大10）。

工場はB6とI5にあり、最初はそれぞれ味方と敵が所有します。歩兵が空いている相手の工場に移動すると占領できます。占領した歩兵などがマスを空けると、同じ工場から自軍の部隊を生産できます。自軍の工場はそれぞれ1ターンに1部隊を生産でき、費用は陣営の共通資金から支払います。費用は歩兵1,000、偵察車2,500、支援車3,000、戦車4,000です。

味方は行動指示の「味方工場」で、生産する工場と部隊を選びます。敵も占領した工場を使い、敵ターンの最後に生き残っている数が最も少ない種類を補充します。新部隊は生産した工場にHP10で出撃し、次のターンから移動と先制攻撃ができます。

狭い画面では作戦マップを横にスワイプできます。キーボードでは矢印キーで画面外のマスにも移れます。同じページで作戦を切り替えると、それぞれの盤面から再開できます。ページを再読み込みすると全作戦の進行が初期化されます。

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

- 盤面・補助背景・歩兵のドット絵の編集元は `scripts/draw-assets.mjs` です。`node scripts/draw-assets.mjs` でPNGを再生成できます。歩兵の戦闘用画像は待機・構え・発射・反動・被弾・身を伏せる姿勢の6コマを1ファイルに格納しています。
- 戦闘背景 `public/assets/highland-dusk.webp` は組み込みの画像生成で制作し、WebPに変換した素材です。
- BGMの曲データとMP3生成は `scripts/compose-bgm.mjs` にあります。`pnpm install --frozen-lockfile` で生成用の依存関係を取得し、`node scripts/compose-bgm.mjs` で4曲を再生成できます。

<details>
<summary>戦闘背景の生成プロンプト</summary>

> Create an original environment background for a retro browser tactical videogame battle. Landscape 3:2, edge to edge. Exceptional hand-crafted 32-bit pixel art with a perceptible pixel grid, nuanced clusters of color and selective dithering, elegant atmosphere. A luminous evening sun behind distant indigo mountain peaks over a wide highland valley; receding fir-covered ridges, amber rim light, violet cloud bands, light haze. The horizon is high (about 36% from top); from around 62% down is a broad uninterrupted FLAT readable meadow of sage grass and warm packed earth where side-view pixel soldiers will be composited; foreground grass only in little clusters at lower corners. Balanced composition with the sun slightly off-center. Keep the entire central three quarters and lower third readable and open so responsive crops also include the twilight valley and ground. Rich teal shadows and apricot gold sun, cinematic value separation without oppressive darkness. Background only, absolutely no sprites, no people, no buildings, no signs, no text, logos, battle effects, frames, or UI. Independent fictional setting; no resemblance to any specific game or existing asset.

</details>

## GitHub Pages への公開

1. 公開先の GitHub リポジトリに `main` を push します。
2. リポジトリの **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選びます。
3. **Actions → Test and deploy to GitHub Pages → Run workflow** から `main` を選んで初回配信します。配信ジョブが成功したら、ジョブに表示される公開 URL を開いて確認します。

以降は `main` 向けのプルリクエストでテストを実行します。`main` に反映した変更は、テスト成功後に `public/` の内容を自動配信します。プロジェクト用の Pages URL でも動くように、HTML 内の素材リンクは相対パスで指定します。
