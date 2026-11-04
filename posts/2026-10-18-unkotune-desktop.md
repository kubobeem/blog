# Android の YouTube Music クライアントを Windows の exe にした

<!-- tags: デスクトップアプリ, 音楽 -->

ArchiveTune という Android 用の YouTube Music クライアントを fork して、エミュレータも VM も使わずに Windows の単体 exe で動かした。名前は途中で Unkotune に変えて、v0.1.0 として公開した。

## 何が大変だったか

元コードは 194,621 行 / 686 ファイルの Kotlin + Compose。KMP のターゲットが無く、`android.*` に依存している行が 119,137 行、つまり約 60%。UI 側だけで `R.string` 参照 3,398 個、`R.drawable` 参照 1,619 個ある。リソースの置換から始めるしかなかった。

`desktop` モジュールを新しく作って、Compose Multiplatform で動かす。音声のデコードは JavaCV 1.5.14（ffmpeg 8.1.2）。Gradle は 9.7.1。配布は jpackage で JRE 同梱。

ログインは Chrome / Edge / Brave を専用プロファイル + DevTools ポートで起動して、CDP の `Storage.getCookies` でクッキーを回収している。保存先は `~/.unkotune/` の JSON。

## 結果

- ホーム画面が描けて、アートワークと再生バーまで出る。再生位置が2秒刻みで進むのを確認
- ラジオは `got 49 related` から 50曲のキューを生成、E2E で再生継続まで確認
- 公開版の zip は 139.9MB
- クリーンな clone から `createDistributable` が 1分08秒

## ハマったところ

- **全曲が即スキップ。** javacv が S16 を `ShortBuffer` で返すのに `as? ByteBuffer` でキャストしていて、全フレームが捨てられていた。両対応 + LE 変換で解決
- **ホームが真っ黒。** `filterIsInstance<SongItem>()` が Album と Playlist を全部落としていた。汎用の `ItemRow` を足して解決
- **exe だけクッキー取得が即死。** jpackage の最小 JRE に `java.net.http` が入っていない。`nativeDistributions.modules` に追加
- **ラジオが空。** `next()` + relatedEndpoint ではタブが返ってこない。`RDAMVM<videoId>` 形式のプレイリストIDに変えた
- スクショが撮れない。`SetForegroundWindow` が OS に拒否されるので、`PrintWindow` で裏のウィンドウを直接撮った

upstream が shallow clone だったので履歴は引き継げず、スナップショット1コミットで公開している。

### コメント

> **emulator信者** (2026/10/18 21:07)
> エミュレータで済むものを 194,621 行移植して「動いた」。趣味って怖いな。
