// 日付の新しい順に一覧を出し、#slug（または /slug）でその記事を表示する
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function load(files) {
  return Promise.all(files.map(async (file) => {
    const md = await (await fetch("/" + file)).text();
    const slug = file.replace(/^posts\//, "").replace(/\.md$/, "");
    return {
      slug,
      title: (md.match(/^#\s+(.+)$/m) || [])[1] || slug,
      date: (slug.match(/^\d{4}-\d{2}-\d{2}/) || [""])[0],
      body: md.replace(/^#\s+.+$/m, ""),
    };
  }));
}

function currentSlug() {
  // #slug でも /slug（末尾スラッシュあり/なし）でも同じ記事を開く
  const raw = location.hash.slice(1) || location.pathname.replace(/^\/+|\/+$/g, "").split("/").pop();
  return decodeURIComponent(raw || "");
}

function view(posts) {
  const slug = currentSlug();
  const post = posts.find((p) => p.slug === slug);
  const main = document.getElementById("posts");

  if (post) {
    main.innerHTML = `<article>
  <h2>${esc(post.title)}</h2>
  <p class="date">${esc(post.date || "固定投稿")}</p>
  ${marked.parse(post.body)}
</article>
<p class="back"><a href="/">&laquo; 記事一覧へ戻る</a></p>`;
  } else if (slug) {
    main.innerHTML = `<div class="notfound">
  <h2>404</h2>
  <p>ページが見つかりません。</p>
  <p><code>${esc(slug)}</code> という記事は存在しません。URL を打ち間違えたか、記事を消したか、そのどちらかです。</p>
  <p><a href="/">&laquo; 記事一覧へ戻る</a></p>
</div>`;
  } else {
    main.innerHTML = `<ul class="entries">${[...posts].sort((a, b) =>
      Number(b.slug.startsWith("pin-")) - Number(a.slug.startsWith("pin-")) || b.slug.localeCompare(a.slug)
    ).map((p) =>
      `<li><span class="date">${esc(p.date || "固定")}</span><a href="#${esc(p.slug)}">${esc(p.title)}</a></li>`
    ).join("")}</ul>`;
  }

  document.title = post ? `${post.title} - 日々のメモ` : slug ? "404 - 日々のメモ" : "日々のメモ";
}

(async () => {
  try {
    const posts = (await load(await (await fetch("/posts.json")).json()))
      .sort((a, b) => b.slug.localeCompare(a.slug)); // slug の先頭が日付なので新しい順になる
    view(posts);
    addEventListener("hashchange", () => view(posts));
  } catch (e) {
    document.getElementById("posts").innerHTML = `<p class="error">記事を読み込めませんでした。<br>
      file:// で直接開いていないか確認してください（<code>python -m http.server</code> などで配信すると動きます）。</p>`;
    console.error(e);
  }
})();
