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
    entries.append(f'<li><span class="date">{date}</span><a href="#{esc(s)}">{esc(it["title"])}</a></li>')
list_html = '<ul class="entries">' + "".join(entries) + "</ul>"

counts = Counter()
for it in items:
    counts.update(it["tags"])
def tag_href(t):
    # app.js の encodeURIComponent と同じ逃がし方
    return urlquote(t, safe="-_.!~*'()")

tag_html = "".join(
    f'<li><a href="#tag/{tag_href(t)}">{esc(t)}</a> ({n})</li>'
    for t, n in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
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
