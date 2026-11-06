# Vib-Ribbon 風のゲームを Cloudflare Pages に置いた

音源をドラッグ&ドロップすると地形が生えて、それに合わせて走るゲームを作った。Vib-Ribbon のパクリ。素の HTML と JavaScript だけで、ビルドは無し。

<!-- tags: Web, ゲーム -->

## 構成

- `main` / `audio-analyzer` / `terrain-generator` / `game` / `player` / `renderer` の6モジュール
- 描画は Canvas 2D のパースペクティブ。WebGL は使わず、PS1 風のワイヤーフレームにした
- `OfflineAudioContext` の `suspend()` でスペクトルフラックスを計算して、適応閾値でピークを取る
- 周波数帯を地形に割り当てる。ベース→峰、トレブル→波、ミッド＋ベース→ループ、小音量→穴

## 結果

- `npx wrangler pages deploy` で公開。`web-vib-ribbon.pages.dev` が 200 を返す（ファイル8個）
- 6モジュールとも `node --check` を通過
- ブラウザで ES module のグラフが 11ms で `ALL_MODULES_LOADED`
- CDP で `dz-dragover` → `dz-drop` を発火させ、`handleFile` 経由で解析画面に遷移することを確認

## ハマったところ

- `OfflineAudioContext` の source を `start()` していなくて、解析がずっと空だった。最初の1時間はこれ
- ドロップゾーンが 400×200px しかなく、外に落とすとブラウザが音源を開いてしまう。window 全体で受けるようにして、`body.dragging` で見た目も変えた
- dropZone と window の両方で受けると二重に処理される。`handlingDrop` フラグと、MIME＋拡張子のチェックで弾いた
- PowerShell の `Invoke-WebRequest` で文字化けして見えたが、表示側の問題だった。ファイル自体は最初から UTF-8

ヘッドレス Chrome には音声出力が無いので、解析からプレイまでの通しは結局検証できていない。実ブラウザでしか確認できない部分が残った。

※ 音を入れて通しで遊んだのは、公開したあとだった。
