# 日々のメモ

markdown ファイルを置くだけの個人ブログ。フレームワーク無し、ビルド無し。

## 記事を追加する

1. `posts/2026-11-05-nanika.md` を作る（1行目に `# タイトル`）
2. `posts.json` に `"posts/2026-11-05-nanika.md"` を足す（順番は自由・表示は日付の新しい順）

## ローカルで見る

fetch を使うので、ファイルを直接開くと動きません。フォルダで配信してください。

```powershell
cd D:\code\blogs
python -m http.server 8000
```

→ http://localhost:8000/

## 中身

| ファイル | 役割 |
|---|---|
| `index.html` | ページ本体・サイドバー |
| `style.css` | 2010年ごろの個人ブログ風の見た目 |
| `app.js` | 記事の読み込みと描画 |
| `posts.json` | 記事一覧（表示は日付の新しい順） |
| `vendor/marked.min.js` | markdown → HTML（オフラインで動くよう同梱） |
