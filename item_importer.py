"""
Magic item importer: downloads the magic item list and descriptions from aidedd.org into data/items.json,
plus the trinket table from dnd2024.wikidot.com (the app has its own trinket list if that isn't found).
Runs on your own PC; pages are cached in data/mcache so re-runs are fast.

Usage:  python item_importer.py              (2024 magic items)
        python item_importer.py --2014       (also the older 2014 items)
        python item_importer.py --test URL   (show how one page or list is read)
"""
import json
import re
import sys
import time
from urllib.parse import urljoin

from monster_importer import DATA, DROP, ALLOWED, clean, fetch

OUT = DATA / "items.json"
INDEX_2024 = "https://www.aidedd.org/magic-item/"
INDEX_2014 = "https://www.aidedd.org/dnd-filters/magic-items.php"
LINK_2024 = re.compile(r"/magic-item/([a-z0-9][a-z0-9-]*)/?$")
LINK_2014 = re.compile(r"(?:om|magic-items?)\.php\?vo=([a-z0-9-]+)")
LANG = {"en", "fr", "es", "de", "it", "pt", "pl", "ru", "nl", "ja", "zh", "ko"}
WIKI = "https://dnd2024.wikidot.com"
RARITY = re.compile(r"\b(very rare|uncommon|common|rare|legendary|artifact|rarity varies|varies)\b", re.I)
CATS = ["Wondrous Item", "Armor", "Weapon", "Potion", "Ring", "Rod", "Scroll", "Staff", "Wand", "Shield", "Ammunition"]


def norm_rarity(s):
    m = RARITY.search(s or "")
    if not m:
        return ""
    r = m.group(1).lower()
    return "varies" if "varies" in r else r


def norm_cat(s):
    for c in CATS:
        if re.search(r"\b" + c.split()[0] + r"s?\b", s or "", re.I):
            return "Wondrous Item" if c == "Wondrous Item" else ("Weapon" if c == "Ammunition" else c)
    return ""


def parse_index(html, base, link_re, edition):
    """Every link to an item page (table rows or plain lists) -> summary dict, using the row text for rarity/type."""
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    out = {}
    for a in soup.find_all("a", href=True):
        m = link_re.search(a["href"].split("#")[0])
        if not m or m.group(1) in LANG:
            continue
        slug = m.group(1)
        name = clean(a.get_text(" "))
        if not name or len(name) > 80:
            continue
        row = a.find_parent("tr") or a.find_parent("li") or a.parent
        text = clean(row.get_text(" | ")) if row else name
        e = {"slug": slug, "name": name, "url": urljoin(base, a["href"]), "ed": edition}
        rest = text.replace(name, "", 1)
        if norm_rarity(rest):
            e["rarity"] = norm_rarity(rest)
        if norm_cat(rest):
            e["cat"] = norm_cat(rest)
        if re.search(r"attun", rest, re.I) or re.search(r"\|\s*(yes|oui|x)\s*(\||$)", rest, re.I):
            e["attune"] = True
        src = re.search(r"((?:Dungeon Master's Guide|Player's Handbook|Xanathar|Tasha|Eberron|Fizban|Bigby|Book of Many Things|Monster Manual|Vecna|Spelljammer|Planescape|Strixhaven|Wildemount)[^|]*)", rest)
        if src:
            e["src"] = clean(src.group(1))
        key = slug + "|" + edition
        if key not in out or len(e) > len(out[key]):
            out[key] = e
    return out


def item_html(html, name):
    """(clean description HTML, meta) for one magic item page."""
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    h1 = None
    for h in soup.find_all(["h1", "h2"]):
        if name.lower()[:20] in h.get_text(" ").lower():
            h1 = h
            break
    h1 = h1 or soup.find("h1")
    if not h1:
        return "", {}
    box = h1.parent
    for _ in range(6):   # climb until the block holds the rarity line and some description
        t = box.get_text(" ")
        if RARITY.search(t) and len(t) > len(name) + 30:
            break
        if box.parent is None or box.parent.name in ("body", "html", "[document]"):
            break
        box = box.parent
    frag = BeautifulSoup(str(box), "html.parser")
    root = frag.find(True)
    for t in list(root.find_all(True)):
        if getattr(t, "decomposed", False) or t.attrs is None:
            continue
        cls = " ".join(t.get("class") or [])
        if t.name in DROP or t.name == "img" or re.search(r"(picture|image|ads|pub|share|social|menu|breadcrumb|comment|nav)", cls, re.I):
            t.decompose()
    for t in list(root.find_all(True)):
        if t.name == "svg":
            t.replace_with(frag.new_tag("hr"))
            continue
        if t.name == "a" or t.name not in ALLOWED:
            t.unwrap()
            continue
        keep = {}
        if t.get("class"):
            keep["class"] = " ".join(c for c in t["class"] if re.fullmatch(r"[\w-]+", c))
        if t.name in ("td", "th") and t.get("colspan"):
            keep["colspan"] = t["colspan"]
        t.attrs = keep
    out = root.decode_contents() if root.name == "div" else str(root)
    out = re.sub(r"(\s*<br/?>\s*){3,}", "<br/>", out).strip()
    lines = [l for l in clean(root.get_text("\n")).split("\n") if l.strip()]
    meta = {}
    for l in lines[1:5]:   # the type line: "Wondrous Item, Uncommon (Requires Attunement)"
        if norm_rarity(l) and len(l) < 160:
            meta["rarity"] = norm_rarity(l)
            if norm_cat(l):
                meta["cat"] = norm_cat(l)
            meta["attune"] = bool(re.search(r"attun", l, re.I))
            meta["typeline"] = l.strip()
            break
    return out, meta


def wiki_trinkets(session, refresh=False):
    """The d100 trinket table from dnd2024.wikidot.com (any equipment page with a 'Trinket' heading)."""
    from bs4 import BeautifulSoup
    pages, found = [WIKI + "/equipment:all", WIKI + "/equipment:trinkets", WIKI + "/equipment:adventuring-gear"], []
    html = fetch(session, pages[0], refresh)
    if html:
        for a in BeautifulSoup(html, "html.parser").find_all("a", href=True):
            h = a["href"]
            if h.startswith("/equipment:") and WIKI + h not in pages:
                pages.append(WIKI + h)
    for url in pages[:40]:
        html = fetch(session, url, refresh)
        if not html:
            continue
        soup = BeautifulSoup(html, "html.parser")
        for table in soup.find_all("table"):
            head = table.find_previous(["h1", "h2", "h3", "h4", "h5", "strong"])
            cap = " ".join(x.get_text(" ") for x in [head, table.find("caption"), table.find("th")] if x)
            if not re.search(r"trinket", cap, re.I):
                continue
            for tr in table.find_all("tr"):
                cells = [clean(td.get_text(" ")) for td in tr.find_all("td")]
                if len(cells) >= 2 and re.fullmatch(r"\d{1,3}", cells[0]) and len(cells[-1]) > 6:
                    found.append(cells[-1])
        if len(found) >= 50:
            break
    return list(dict.fromkeys(found))


def run(include_2014=False, refresh=False, progress=None, limit=None):
    import requests
    session = requests.Session()
    log = progress or (lambda d, t, m: print(f"[{d}/{t}] {m}"))
    entries = {}
    log(0, 0, "Reading magic item list (2024)…")
    html = fetch(session, INDEX_2024, refresh=True)
    if html:
        entries.update(parse_index(html, INDEX_2024, LINK_2024, "2024"))
    if include_2014:
        log(0, 0, "Reading magic item list (2014)…")
        html = fetch(session, INDEX_2014, refresh=True)
        if html:
            entries.update(parse_index(html, INDEX_2014, LINK_2014, "2014"))
    items = list(entries.values())
    if limit:
        items = items[:limit]
    blocks = {}
    for i, e in enumerate(items, 1):
        log(i, len(items), e["name"])
        page = fetch(session, e["url"], refresh)
        if not page:
            continue
        try:
            block, meta = item_html(page, e["name"])
            if block:
                blocks[e["slug"] + "|" + e["ed"]] = block
            for k, v in meta.items():
                if v not in ("", None):
                    e[k] = v
        except Exception as ex:
            print(f"  ! parse error {e['url']}: {ex}")
    log(len(items), len(items), "Reading the trinket table…")
    try:
        trinkets = wiki_trinkets(session, refresh)
    except Exception as ex:
        print(f"  ! trinkets: {ex}")
        trinkets = []
    DATA.mkdir(exist_ok=True)
    out = {"source": "aidedd.org", "imported": time.strftime("%Y-%m-%d %H:%M"), "list": items, "blocks": blocks, "trinkets": trinkets}
    OUT.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    log(len(items), len(items), f"Done: {len(items)} magic items, {len(blocks)} descriptions, {len(trinkets)} trinkets -> {OUT.name}")
    return out


if __name__ == "__main__":
    a = sys.argv[1:]
    if a and a[0] == "--test":
        import requests
        url = a[1]
        html = fetch(requests.Session(), url, refresh=True)
        if url.rstrip("/").endswith("magic-item") or "magic-items.php" in url:
            for e in list(parse_index(html, url, LINK_2024 if "magic-item/" in url else LINK_2014, "2024").values())[:15]:
                print(e)
        else:
            from bs4 import BeautifulSoup
            name = clean((BeautifulSoup(html, "html.parser").find("h1") or BeautifulSoup("<x>?</x>", "html.parser")).get_text())
            block, meta = item_html(html, name)
            print("NAME:", name, "| META:", meta)
            print(block[:3000])
    else:
        run(include_2014="--2014" in a, refresh="--refresh" in a)
