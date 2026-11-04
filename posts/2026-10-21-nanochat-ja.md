# 日本語だけで学習した 49M のモデルを一晩で作った

<!-- tags: LLM, 機械学習 -->

nanochat を fork して、日本語に寄せた小型モデルを作った。名前は nano-ja。合成データ作りから、tokenizer、pretrain、SFT、GGUF 化、WebGPU のデモ公開まで一通り通した。

## 構成

- nanochat fork（depth 6）、RTX 4060 8GB、WSL2 / Windows native
- 教師データは `opencode serve` の API 経由で 5 つの無料モデルを round-robin
- 合成日本語は教養 50% / 2ch・5ch のスラング 50%。これに mc4-ja と Wikipedia-ja を足す
- 学習は torch 2.9.1+cu128、triton-windows 3.5.1

## 結果

- pretrain 62,000 steps 完走、最終 loss 3.33、7時間2分、約 10億 tokens、40.7k tok/s
- 事前の実測は 51,000 tok/s / 3.4GB だったので、一晩で Chinchilla の 8 割くらいまで行く計算だった
- 公開コーパスは 310k docs / 10億字 ≒ 714M tokens、13 shards
- SFT は 5,681 会話（約 710 steps）。val bpb 0.867
- 最終モデルは 49M params
- GGUF は bf16 322MB / Q4_K_M 99〜100MB。llama-cli で 130 tok/s、自己紹介は普通に出る
- WebGPU デモは 22〜24 tok/s、初回トークン 92ms。logits が NumPy の参照実装と小数4桁まで一致

## ハマったところ

- `opencode serve` の cwd をリポジトリ内にすると、リクエストごとに git スナップショットが走って固まる。サンドボックスはリポ外の temp に置く
- `variant=none` を指定すると GLM が無音になって 0 出力。`low` を使うか指定しない
- 並列 10 レーンはセッション上限に当たる。5+4 に戻した
- 生成 JSON の閉じ `"` が欠けて `Invalid control character`。抽出側に修復フォールバックを追加
- 夜間チェーンが detached 起動時の cp932 で即死。UTF-8 を強制し、pythonw に変えてコンソール CLOSE による中断も回避
- GGUF の出力が崩壊したのは `q = norm(q) * 1.2` を q と k の両方に適用していたせい。attention の logit が 1.44 倍になっていた
- WebGPU 側は in-place rmsnorm が無音の no-op、`ve_gate` を f16 で積んで f32 で読む不整合、埋め込み後の RMSNorm 抜け。段階比較で1個ずつ潰した

ブラウザで 20 tok/s 超えのモデルが動くのを見ると、49M でも作った甲斐はある。

### コメント

> **スケール信奉者** (2026/10/22 02:29)
> 49M で「日本語モデル」。自己紹介ができるだけの模型に名前を付けるの、親バカすぎる。
