import json, os, re

BASE = os.path.dirname(os.path.abspath(__file__))
POSTS = os.path.join(BASE, "posts")
TAG_RE = re.compile(r"^<!--\s*tags:\s*(.+?)\s*-->\s*$", re.M)

items = []
for name in sorted(os.listdir(POSTS), reverse=True):
    if not name.endswith(".md"):
        continue
    src = open(os.path.join(POSTS, name), encoding="utf-8").read()
    title = (re.search(r"^#\s+(.+)$", src, re.M) or [None, name[:-3]])[1].strip()
    tags = [t.strip() for t in ((TAG_RE.search(src) or [None, ""])[1]).split(",") if t.strip()]
    items.append({"file": f"posts/{name}", "title": title, "tags": tags})

with open(os.path.join(BASE, "posts.json"), "w", encoding="utf-8", newline="\n") as f:
    json.dump(items, f, ensure_ascii=False, indent=2)
    f.write("\n")

print(f"{len(items)} posts -> posts.json")
