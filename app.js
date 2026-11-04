// 日付の新しい順に一覧を出し、#slug（または /slug）でその記事を表示する
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const TAG_RE = /^<!--\s*tags:\s*(.+?)\s*-->\s*$/m;

async function load(files) {
  return Promise.all(files.map(async (file) => {
    const md = await (await fetch("/" + file)).text();
    const slug = file.replace(/^posts\//, "").replace(/\.md$/, "");
    const tags = (md.match(TAG_RE) || ["", ""])[1].split(",").map((t) => t.trim()).filter(Boolean);
    return {
      slug,
      title: (md.match(/^#\s+(.+)$/m) || [])[1] || slug,
      date: (slug.match(/^\d{4}-\d{2}-\d{2}/) || [""])[0],
      tags,
      body: md.replace(/^#\s+.+$/m, "").replace(TAG_RE, ""),
    };
  }));
}

function currentSlug() {
  // #slug・/slug（末尾スラッシュあり/なし）・/tag/name を同じ形に寄せる
  const hash = location.hash.slice(1);
  if (hash) return decodeURIComponent(hash);
  const parts = location.pathname.split("/").filter(Boolean);
  const last = decodeURIComponent(parts.pop() || "");
  return parts[parts.length - 1] === "tag" ? "tag/" + last : last;
}

const tagLink = (t) => `<a href="#tag/${encodeURIComponent(t)}">${esc(t)}</a>`;
const entry = (p) => `<li><span class="date">${esc(p.date || "固定")}</span><a href="#${esc(p.slug)}">${esc(p.title)}</a></li>`;
const list = (posts) => `<ul class="entries">${posts.map(entry).join("")}</ul>`;
const back = `<p class="back"><a href="/">&laquo; 記事一覧へ戻る</a></p>`;

function view(posts) {
  const slug = currentSlug();
  const post = posts.find((p) => p.slug === slug);
  const main = document.getElementById("posts");
  const sorted = [...posts].sort((a, b) =>
    Number(b.slug.startsWith("pin-")) - Number(a.slug.startsWith("pin-")) || b.slug.localeCompare(a.slug)
  );

  if (slug.startsWith("tag/")) {
    const name = slug.slice(4);
    const hits = sorted.filter((p) => p.tags.includes(name));
    main.innerHTML = `<h2>タグ: ${esc(name)}</h2>
${hits.length ? list(hits) : `<p>このタグの記事はありません。</p>`}
${back}`;
    document.title = `${name} - 日々のメモ`;
  } else if (post) {
    // 共通タグの多い順に最大3件
    const related = sorted
      .map((p) => ({ p, n: p.tags.filter((t) => post.tags.includes(t)).length }))
      .filter((x) => x.n > 0 && x.p.slug !== post.slug)
      .sort((a, b) => b.n - a.n || b.p.slug.localeCompare(a.p.slug))
      .slice(0, 3);
    main.innerHTML = `<article>
  <h2>${esc(post.title)}</h2>
  <p class="date">${esc(post.date || "固定投稿")}</p>
  ${marked.parse(post.body)}
  ${post.tags.length ? `<p class="tags">タグ: ${post.tags.map(tagLink).join(" ")}</p>` : ""}
  ${related.length ? `<p class="related">関連: ${related.map((x) => `<a href="#${esc(x.p.slug)}">${esc(x.p.title)}</a>`).join(" / ")}</p>` : ""}
</article>
${back}`;
    document.title = `${post.title} - 日々のメモ`;
  } else if (slug) {
    main.innerHTML = `<div class="notfound">
  <h2>404</h2>
  <p>ページが見つかりません。</p>
  <p><code>${esc(slug)}</code> という記事は存在しません。URL を打ち間違えたか、記事を消したか、そのどちらかです。</p>
  <p><a href="/">&laquo; 記事一覧へ戻る</a></p>
</div>`;
    document.title = "404 - 日々のメモ";
  } else {
    main.innerHTML = list(sorted);
    document.title = "日々のメモ";
  }
}

function renderTags(posts) {
  const counts = new Map();
  posts.forEach((p) => p.tags.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
  document.getElementById("taglist").innerHTML = [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t, n]) => `<li>${tagLink(t)} (${n})</li>`)
    .join("");
}

(async () => {
  try {
    const posts = (await load(await (await fetch("/posts.json")).json()))
      .sort((a, b) => b.slug.localeCompare(a.slug)); // slug の先頭が日付なので新しい順になる
    renderTags(posts);
    view(posts);
    addEventListener("hashchange", () => view(posts));
  } catch (e) {
    document.getElementById("posts").innerHTML = `<p class="error">記事を読み込めませんでした。<br>
      file:// で直接開いていないか確認してください（<code>python -m http.server</code> などで配信すると動きます）。</p>`;
    console.error(e);
  }
})();
