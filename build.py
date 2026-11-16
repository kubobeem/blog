import html, json, os, re
from collections import Counter
from urllib.parse import quote as urlquote

BASE = os.path.dirname(os.path.abspath(__file__))
POSTS = os.path.join(BASE, "posts")
INDEX = os.path.join(BASE, "index.html")
TAG_RE = re.compile(r"^<!--\s*tags:\s*(.+?)\s*-->\s*$", re.M)
DATE_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})")

items = []
for name in sorted(os.listdir(POSTS), reverse=True):
    if not name.endswith(".md"):
        continue
    src = open(os.path.join(POSTS, name), encoding="utf-8").read()
    title = (re.search(r"^#\s+(.+)$", src, re.M) or [None, name[:-3]])[1].strip()
    tags = [t.strip() for t in ((TAG_RE.search(src) or [None, ""])[1]).split(",") if t.strip()]
    items.append({"file": f"posts/{name}", "title": title, "tags": tags})

with open(os.path.join(BASE, "posts.json"), "w", encoding="utf-8", newline="\n") as f:
    json.dump(items, f, ensure_ascii=False, indent=1)
    f.write("\n")

# 一覧を app.js と同じ並び（pin- 先頭、slug 降順）で事前描画する。
# こうすると初回表示で posts.json + JS 待ちにならず、HTML が届いた順に一覧が見える。
def slug_of(it):
    return it["file"][len("posts/"):-len(".md")]

# app.js と同じ並び: pin- を先頭に、残りは slug 降順
ordered = sorted(items, key=lambda it: (slug_of(it).startswith("pin-"), slug_of(it)), reverse=True)

def esc(s):
    return html.escape(s, quote=True)

entries = []
for it in ordered:
    s = slug_of(it)
    m = DATE_RE.match(s)
    date = m.group(1) if m else "固定"
    entries.append(f'<li style="--i:{len(entries)}"><span class="date">{date}</span><a href="#{esc(s)}">{esc(it["title"])}</a></li>')
list_html = '<ul class="entries">' + "".join(entries) + "</ul>"

counts = Counter()
for it in items:
    counts.update(it["tags"])
def tag_href(t):
    # app.js の encodeURIComponent と同じ逃がし方
    return urlquote(t, safe="-_.!~*'()")

tag_html = "".join(
    f'<li style="--i:{i}"><a href="#tag/{tag_href(t)}">{esc(t)}</a> ({n})</li>'
    for i, (t, n) in enumerate(sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])))
)

page = open(INDEX, encoding="utf-8").read()

def replace_between(text, start, end, new):
    i = text.index(start) + len(start)
    j = text.index(end, i)
    return text[:i] + new + text[j:]

page = replace_between(page, "<!-- LIST:START -->", "<!-- LIST:END -->", "\n  " + list_html + "\n")
page = replace_between(page, "<!-- TAGS:START -->", "<!-- TAGS:END -->", tag_html)
open(INDEX, "w", encoding="utf-8", newline="\n").write(page)

print(f"{len(items)} posts -> posts.json + index.html prerendered")

# RSS feed (feed.xml)。チャンネル画像は kubobeem.me の og:image (kuboes.ninja/og.png)。
# 各記事の最初の画像があれば description に <img> で入れる。日付なし(pin-)は除外。
import email.utils
from datetime import datetime, timezone, timedelta

OG_IMAGE = "https://kuboes.ninja/og.png"
FEED = os.path.join(BASE, "feed.xml")

def rss_date(date_str):
    dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone(timedelta(hours=9)))
    return email.utils.format_datetime(dt)

def excerpt_and_image(md_text):
    body_lines = []
    for ln in md_text.splitlines():
        if ln.startswith("# "):
            continue
        if TAG_RE.match(ln):
            continue
        body_lines.append(ln)
    body = "\n".join(body_lines).strip()
    img_src = None
    m = re.search(r"!\[.*?\]\(([^)]+)\)", body)
    if m:
        img_src = m.group(1)
    else:
        m2 = re.search(r'<img[^>]+src="([^"]+)"', body)
        if m2:
            img_src = m2.group(1)
    paras = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
    text = ""
    for p in paras:
        p_clean = re.sub(r"!\[.*?\]\(.*?\)", "", p).strip()
        p_clean = re.sub(r"<img[^>]*>", "", p_clean).strip()
        p_clean = re.sub(r"[#>*`]", "", p_clean).strip()
        if p_clean:
            text = p_clean
            break
    if len(text) > 200:
        text = text[:200] + "…"
    return text, img_src

def abs_url(src):
    if src.startswith("http"):
        return src
    if src.startswith("/"):
        return "https://kubobeem.tech" + src
    return "https://kubobeem.tech/" + src

feed_items = []
for it in ordered:
    s = slug_of(it)
    m = DATE_RE.match(s)
    if not m:
        continue  # pin- など日付なしは除外
    date_str = m.group(1)
    md_path = os.path.join(POSTS, s + ".md")
    md_text = open(md_path, encoding="utf-8").read() if os.path.exists(md_path) else ""
    desc_text, img_src = excerpt_and_image(md_text)
    link = f"https://kubobeem.tech/#{s}"
    desc_html = ""
    # 画像がない記事は og:image を入れる（RSSで画像が表示されるように）
    img = img_src if img_src else OG_IMAGE
    desc_html += f'<p><img src="{esc(abs_url(img))}" alt=""></p>'
    if desc_text:
        desc_html += f"<p>{esc(desc_text)}</p>"
    if not desc_html:
        desc_html = f"<p>{esc(it['title'])}</p>"
    feed_items.append(f"""  <item>
    <title>{esc(it['title'])}</title>
    <link>{link}</link>
    <guid isPermaLink="false">{link}</guid>
    <pubDate>{rss_date(date_str)}</pubDate>
    <description><![CDATA[{desc_html}]]></description>
  </item>""")

feed_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>日々のメモ</title>
  <link>https://kubobeem.tech/</link>
  <description>思ったことをだらだら書くだけのブログ。電子工作とプログラムと音楽。</description>
  <language>ja</language>
  <image>
    <url>{OG_IMAGE}</url>
    <title>日々のメモ</title>
    <link>https://kubobeem.tech/</link>
  </image>
{chr(10).join(feed_items)}
</channel>
</rss>
"""
with open(FEED, "w", encoding="utf-8", newline="\n") as f:
    f.write(feed_xml)
print(f"feed.xml: {len(feed_items)} items")
