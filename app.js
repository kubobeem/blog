// 日付の新しい順に一覧を出し、#slug（または /slug）でその記事を表示する
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const TAG_RE = /^<!--\s*tags:\s*(.+?)\s*-->\s*$/m;

// テーマ。既定は OS の設定で、押したら localStorage に固定する
const themeRoot = document.documentElement;
const themeBtn = document.getElementById("theme-toggle");
if (localStorage.getItem("theme")) themeRoot.dataset.theme = localStorage.getItem("theme");
const isDark = () => themeRoot.dataset.theme
  ? themeRoot.dataset.theme === "dark"
  : matchMedia("(prefers-color-scheme: dark)").matches;
const labelTheme = () => { themeBtn.textContent = isDark() ? "ライトにする" : "ダークにする"; };
themeBtn.addEventListener("click", () => {
  themeRoot.dataset.theme = isDark() ? "light" : "dark";
  localStorage.setItem("theme", themeRoot.dataset.theme);
  labelTheme();
});
labelTheme();

// 一覧に要るのは posts.json のメタ情報だけ。本文は記事を開いたときに取ってキャッシュする
const load = (items) => items.map((it) => {
  const slug = it.file.replace(/^posts\//, "").replace(/\.md$/, "");
  return {
    slug,
    file: it.file,
    title: it.title || slug,
    tags: it.tags || [],
    date: (slug.match(/^\d{4}-\d{2}-\d{2}/) || [""])[0],
  };
});

const bodyCache = new Map();

// 画像は後回し: JS で 3 秒後に読み込む（50kb/s でも文字が先に出る）。
// <img data-src="..."> になっている画像だけが対象。src が付いた画像は即読み込みのまま。
// カウンタだけは 10 秒後に読み込む（40KB あって重いので、ページが落ち着いてから）。
let imgTimer = null;
let counterTimer = null;
function loadDeferredImages() {
  imgTimer = null;
  document.querySelectorAll("img[data-src]").forEach((img) => {
    if (img.closest(".counter")) return; // カウンタは別タイマーで 10 秒後に
    img.src = img.dataset.src;
    img.removeAttribute("data-src");
  });
}
function loadCounter() {
  counterTimer = null;
  document.querySelectorAll(".counter img[data-src]").forEach((img) => {
    img.src = img.dataset.src;
    img.removeAttribute("data-src");
  });
}
function scheduleImageLoad() {
  if (imgTimer) clearTimeout(imgTimer);
  imgTimer = setTimeout(loadDeferredImages, 3000);
  if (counterTimer) clearTimeout(counterTimer);
  counterTimer = setTimeout(loadCounter, 10000);
}

// 記事本文の画像も data-src 化する。寸法が分かっている画像は width/height を付けてずれ防止。
// 新しい画像を posts/ に足したら、ここに「パス: [幅, 高さ]」を追加すること。
const KNOWN_IMG_SIZE = {
  "/images/2026-11-06-ai-pro-accounts.jpg": [956, 509],
};
function deferArticleImages(html) {
  return html.replace(/<img\s+src="([^"]+)"([^>]*)>/g, (m, src, rest) => {
    const size = KNOWN_IMG_SIZE[src];
    const dims = size ? ` width="${size[0]}" height="${size[1]}"` : "";
    return `<img data-src="${src}"${dims} loading="lazy" decoding="async"${rest}>`;
  });
}

// marked は記事本文を開くときだけ遅延読み込みする。
// 一覧表示では 12KB の marked.min.js を取らない。
let markedReady = null;
function loadMarked() {
  if (window.marked) return Promise.resolve();
  if (!markedReady) markedReady = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "/vendor/marked.min.js";
    s.onload = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
  return markedReady;
}
async function getBody(post) {
  if (!bodyCache.has(post.slug)) {
    const md = await (await fetch("/" + post.file)).text();
    bodyCache.set(post.slug, md.replace(/^#\s+.+$/m, "").replace(TAG_RE, ""));
  }
  return bodyCache.get(post.slug);
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
const entry = (p, i) => `<li style="--i:${i}"><span class="date">${esc(p.date || "固定")}</span><a href="#${esc(p.slug)}">${esc(p.title)}</a></li>`;
const list = (posts) => `<ul class="entries">${posts.map(entry).join("")}</ul>`;
const back = `<p class="back"><a href="/">&laquo; 記事一覧へ戻る</a></p>`;

async function view(posts) {
  const slug = currentSlug();
  const post = posts.find((p) => p.slug === slug);
  const main = document.getElementById("posts");
  const sorted = [...posts].sort((a, b) =>
    Number(b.slug.startsWith("pin-")) - Number(a.slug.startsWith("pin-")) || b.slug.localeCompare(a.slug)
  );

  if (slug.startsWith("tag/")) {
    const name = slug.slice(4);
    const hits = sorted.filter((p) => p.tags.includes(name));
    const html = `<h2>タグ: ${esc(name)}</h2>
${hits.length ? list(hits) : `<p>このタグの記事はありません。</p>`}
${back}`;
    if (main.innerHTML !== html) main.innerHTML = html;
    document.title = `${name} - 日々のメモ`;
  } else if (post) {
    // 共通タグの多い順に最大3件
    const related = sorted
      .map((p) => ({ p, n: p.tags.filter((t) => post.tags.includes(t)).length }))
      .filter((x) => x.n > 0 && x.p.slug !== post.slug)
      .sort((a, b) => b.n - a.n || b.p.slug.localeCompare(a.p.slug))
      .slice(0, 3);
    document.title = `${post.title} - 日々のメモ`;
    if (!bodyCache.has(post.slug)) main.innerHTML = `<p class="loading">読み込み中…</p>`;
    const body = await getBody(post);
    if (currentSlug() !== slug) return; // 待っている間に別のページへ移った
    let parsed;
    try {
      await loadMarked();
      parsed = deferArticleImages(marked.parse(body));
    } catch (e) {
      parsed = `<p>${esc(body)}</p>`; // marked が読めないときは素のテキストで出す
    }
    main.innerHTML = `<article>
  <h2>${esc(post.title)}</h2>
  <p class="date">${esc(post.date || "固定投稿")}</p>
  ${parsed}
  ${post.tags.length ? `<p class="tags">タグ: ${post.tags.map(tagLink).join(" ")}</p>` : ""}
  ${related.length ? `<p class="related">関連: ${related.map((x) => `<a href="#${esc(x.p.slug)}">${esc(x.p.title)}</a>`).join(" / ")}</p>` : ""}
</article>
${back}`;
    // 記事の中身も上からだんだん出す
    [...main.querySelectorAll("article > *")].forEach((el, i) => el.style.setProperty("--i", i));
    scheduleImageLoad();
  } else if (slug) {
    const html = `<div class="notfound">
  <h2>404</h2>
  <p>ページが見つかりません。</p>
  <p><code>${esc(slug)}</code> という記事は存在しません。URL を打ち間違えたか、記事を消したか、そのどちらかです。</p>
  <p><a href="/">&laquo; 記事一覧へ戻る</a></p>
</div>`;
    if (main.innerHTML !== html) main.innerHTML = html;
    document.title = "404 - 日々のメモ";
  } else {
    // 一覧は build.py が index.html に事前描画済み。同じ内容なら描き直さない（チラつき・ずれ防止）
    const html = list(sorted);
    const cur = main.querySelector("ul.entries");
    if (!cur || cur.outerHTML !== html) main.innerHTML = html;
    document.title = "日々のメモ";
  }
}

function renderTags(posts) {
  const counts = new Map();
  posts.forEach((p) => p.tags.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
  const el = document.getElementById("taglist");
  const html = [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t, n], i) => `<li style="--i:${i}">${tagLink(t)} (${n})</li>`)
    .join("");
  // 事前描画済み（コメントを除いて同じ）なら描き直さない
  if (el.innerHTML.replace(/<!--.*?-->/g, "") !== html) el.innerHTML = html;
}

// posts.json は遅延読み込み。一覧は index.html に事前描画済みなので、
// 一覧表示のときは posts.json を取らない。記事・タグ表示のときだけ取る。
let postsPromise = null;
function getPosts() {
  if (!postsPromise) {
    postsPromise = fetch("/posts.json").then((r) => r.json()).then((items) =>
      load(items).sort((a, b) => b.slug.localeCompare(a.slug))); // slug の先頭が日付なので新しい順になる
  }
  return postsPromise;
}
async function onRoute() {
  try {
    const posts = await getPosts();
    renderTags(posts);
    view(posts);
  } catch (e) {
    document.getElementById("posts").innerHTML = `<p class="error">記事を読み込めませんでした。<br>
      file:// で直接開いていないか確認してください（<code>python -m http.server</code> などで配信すると動きます）。</p>`;
    console.error(e);
  }
}

(async () => {
  scheduleImageLoad(); // カウンタ等の画像は 3 秒後に読み込む
  // 一覧表示（slugなし）なら posts.json は取らない。HTML に一覧が入ってるから。
  if (!currentSlug()) {
    addEventListener("hashchange", onRoute);
    return;
  }
  await onRoute();
  addEventListener("hashchange", onRoute);
})();
