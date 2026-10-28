"""
Monster importer: downloads the monster list and stat blocks from aidedd.org into data/monsters.json.
Runs on your own PC; pages are cached in data/mcache so re-runs are fast.

Usage:  python monster_importer.py              (2024 monsters)
        python monster_importer.py --2014       (also the older 2014 monsters)
        python monster_importer.py --test URL   (show how one page is read)
"""
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
CACHE = DATA / "mcache"
OUT = DATA / "monsters.json"
INDEX_2024 = "https://www.aidedd.org/monster/"
INDEX_2014 = "https://www.aidedd.org/dnd-filters/monsters.php"
LINK_2024 = re.compile(r"/monster/([a-z0-9][a-z0-9-]*)/?$")
LINK_2014 = re.compile(r"monstres\.php\?vo=([a-z0-9-]+)")
HEADERS = {"User-Agent": "Mozilla/5.0 (personal D&D DM tool; respectful crawler)"}
DELAY = 0.4
SECTION_WORDS = {"traits", "actions", "bonus actions", "reactions", "legendary actions", "lair actions", "mythic actions", "regional effects"}


def clean(s):
    s = (s or "").replace("\xa0", " ")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r" *\n *", "\n", s)
    return s.strip()


def fetch(session, url, refresh=False):
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / (re.sub(r"[^a-z0-9]+", "_", url.lower())[-120:] + ".html")
    if f.exists() and not refresh:
        return f.read_text(encoding="utf-8", errors="replace")
    last = None
    for attempt in range(3):
        try:
            r = session.get(url, headers=HEADERS, timeout=30)
            if r.status_code == 404:
                return None
            r.raise_for_status()
            r.encoding = r.encoding or "utf-8"
            f.write_text(r.text, encoding="utf-8")
            time.sleep(DELAY)
            return r.text
        except Exception as e:
            last = e
            time.sleep(2 * (attempt + 1))
    print(f"  ! failed {url}: {last}")
    return None


def parse_index(html, base, link_re, edition):
    """Every table row that links to a monster page -> summary dict."""
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    out = {}
    for table in soup.find_all("table"):
        headers = [clean(th.get_text(" ")).lower() for th in table.find_all("th")]
        for tr in table.find_all("tr"):
            a = None
            for cand in tr.find_all("a", href=True):
                if link_re.search(cand["href"]):
                    a = cand
                    break
            if not a:
                continue
            slug = link_re.search(a["href"]).group(1)
            cells = [clean(td.get_text(" ")) for td in tr.find_all("td")]
            e = {"slug": slug, "name": clean(a.get_text(" ")), "url": urljoin(base, a["href"]), "ed": edition}
            if headers and len(headers) == len(cells):
                for h, v in zip(headers, cells):
                    for key, words in (("cr", ("cr", "challenge")), ("type", ("type",)), ("size", ("size",)), ("ac", ("ac", "armor")),
                                       ("hp", ("hp", "hit points")), ("speed", ("speed",)), ("align", ("alignment",)), ("src", ("source", "book")), ("env", ("environment", "habitat"))):
                        if h in words or any(h.startswith(w) for w in words):
                            e[key] = v
            else:
                # heuristics by content
                for v in cells:
                    if not e.get("cr") and re.fullmatch(r"\d+(/\d)?", v) and v != e["name"]:
                        e["cr"] = v
                    elif not e.get("size") and v in ("Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan", "Small or Medium", "Medium or Small"):
                        e["size"] = v
                    elif not e.get("src") and re.search(r"(Manual|Handbook|Guide|Tome|Treasury|Multiverse|Giants|Monsters|Book|Adventure|Curse|Tomb|Storm|Waterdeep|Ghosts|Rime|Descent|Eberron|Theros|Ravenloft|Spelljammer|Faer)", v):
                        e["src"] = v
                    elif not e.get("type") and re.match(r"^(Aberration|Beast|Celestial|Construct|Dragon|Elemental|Fey|Fiend|Giant|Humanoid|Monstrosity|Ooze|Plant|Undead|Swarm)", v):
                        e["type"] = v
            if e.get("src") and len(e["src"]) > 45:
                m = re.search(r"((?:Monster Manual|Player's Handbook|Dungeon Master's Guide|Monsters of the Multiverse|Mordenkainen|Volo|Fizban|Bigby|Tasha|Xanathar)[^|]*?)\s*$", e["src"])
                e["src"] = m.group(1).strip() if m else ""
            out[slug + "|" + edition] = e
    return out


def statblock_lines(html, name):
    """Readable stat block as a list of lines (tables become 'a | b | c' rows)."""
    from bs4 import BeautifulSoup, NavigableString, Tag
    soup = BeautifulSoup(html, "html.parser")
    for bad in soup.select("script, style, nav, header, footer, form, iframe, noscript"):
        bad.decompose()
    root = None
    for sel in (".bloc", ".jaune", "#statblock", ".statblock", "main", "article", "#content", ".content"):
        root = soup.select_one(sel)
        if root and name.lower().split(" ")[0] in root.get_text(" ").lower():
            break
        root = None
    root = root or soup.body or soup
    for br in root.find_all("br"):
        br.replace_with("\n")
    lines = []

    def add(t):
        for part in clean(t).split("\n"):
            part = clean(part)
            if part:
                lines.append(part)

    def walk(node):
        for ch in node.children:
            if isinstance(ch, NavigableString):
                if ch.strip():
                    add(str(ch))
                continue
            if not isinstance(ch, Tag):
                continue
            if ch.name == "table":
                for tr in ch.find_all("tr"):
                    cells = [clean(td.get_text(" ")) for td in tr.find_all(["td", "th"])]
                    if any(cells):
                        lines.append(" | ".join(cells))
            elif ch.name in ("p", "h1", "h2", "h3", "h4", "h5", "li"):
                add(ch.get_text(" "))
            elif ch.name in ("div", "section", "span", "ul", "ol", "center", "blockquote"):
                block_kids = ch.find_all(["div", "p", "table", "h1", "h2", "h3", "h4", "li"], recursive=False)
                if block_kids:
                    walk(ch)
                else:
                    add(ch.get_text(" "))
            elif ch.name in ("img", "hr"):
                continue
            else:
                add(ch.get_text(" "))
    walk(root)
    # trim navigation noise: start at the monster name, stop at obvious footer text
    low = [l.lower() for l in lines]
    start = next((i for i, l in enumerate(low) if l == name.lower() or l.startswith(name.lower())), 0)
    lines = lines[start:]
    end = len(lines)
    for i, l in enumerate(lines):
        if i > 5 and re.match(r"^(©|copyright|aidedd|back to|retour|related|see also|similar monsters)", l, re.I):
            end = i
            break
    lines = [re.sub(r"\s+([.,;:])", r"\1", l) for l in lines[:end]]
    return lines[:200]


ALLOWED = {"div", "p", "span", "strong", "b", "em", "i", "br", "h1", "h2", "h3", "h4", "h5", "table", "thead", "tbody", "tr", "td", "th", "ul", "ol", "li", "sup", "sub", "hr"}
DROP = {"script", "style", "noscript", "iframe", "form", "input", "button", "nav", "header", "footer", "ins", "select", "textarea", "img", "picture", "video", "audio", "link", "meta"}
SIZES = ("Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan")


def statblock_html(html, name, page_url=""):
    """Return (clean stat block HTML, image URL, meta dict). Keeps the page's own layout (classes) so it can be styled like the original."""
    from bs4 import BeautifulSoup, Tag
    soup = BeautifulSoup(html, "html.parser")
    h1 = None
    for h in soup.find_all(["h1", "h2"]):
        if name.lower() in h.get_text(" ").lower():
            h1 = h
            break
    h1 = h1 or soup.find("h1")
    if not h1:
        return "", "", {}
    box = h1.parent
    for _ in range(6):   # climb until the block contains the core stats
        t = box.get_text(" ")
        if re.search(r"(Armor Class|\bAC\b)", t) and re.search(r"(Hit Points|\bHP\b)", t) and len(box.find_all(["p", "div"])) > 3:
            break
        if box.parent is None or box.parent.name in ("body", "html", "[document]"):
            break
        box = box.parent
    # creature image (search the block and its surroundings)
    img = ""
    for scope in (box, box.parent, soup):
        if scope is None:
            continue
        for im in scope.find_all("img"):
            src = im.get("src") or im.get("data-src") or ""
            if not src or re.search(r"(logo|icon|flag|banner|pub|ads|sprite|\.svg|\.gif)", src, re.I):
                continue
            if "/images/" in src or name.split(" ")[0].lower() in (im.get("alt", "") + src).lower():
                img = urljoin(page_url or "https://www.aidedd.org/", src)
                break
        if img:
            break
    # sanitize a copy
    frag = BeautifulSoup(str(box), "html.parser")
    root = frag.find(True)
    for t in list(root.find_all(True)):
        if t.decomposed if hasattr(t, "decomposed") else False:
            continue
        cls = " ".join(t.get("class") or [])
        if t.name in DROP or re.search(r"(picture|image|ads|pub|share|social|menu|breadcrumb|comment)", cls, re.I):
            t.decompose()
    for t in list(root.find_all(True)):
        if t.name == "svg":
            t.replace_with(frag.new_tag("hr"))
            continue
        if t.name == "a":
            t.unwrap()
            continue
        if t.name not in ALLOWED:
            t.unwrap()
            continue
        keep = {}
        if t.get("class"):
            keep["class"] = " ".join(c for c in t["class"] if re.fullmatch(r"[\w-]+", c))
        if t.name in ("td", "th") and t.get("colspan"):
            keep["colspan"] = t["colspan"]
        t.attrs = keep
    # drop empty trailing junk lines
    out = root.decode_contents() if root.name == "div" else str(root)
    out = re.sub(r"(\s*<br/?>\s*){3,}", "<br/>", out).strip()
    # meta from the text
    text = clean(root.get_text("\n"))
    meta = {}
    lines = [l for l in text.split("\n") if l.strip()]
    for l in lines[1:6]:
        m = re.match(r"^(%s)( or \w+)?\s+(.+?)(?:,\s*(.+))?$" % "|".join(SIZES), l.strip(), re.I)
        if m:
            meta["size"] = m.group(1).title()
            meta["type"] = m.group(3).strip().title() if m.group(3).islower() else m.group(3).strip()
            if m.group(4):
                meta["align"] = m.group(4).strip()
            break
    flat = clean(root.get_text(" ")).replace("\n", " ")
    for key, rx in (("ac", r"(?:Armor Class|\bAC)\s*(\d+)"), ("hp", r"(?:Hit Points|\bHP)\s*(\d+(?:\s*\([^)]*\))?)"),
                    ("speed", r"Speed\s+(.+?)(?=\s+(?:MOD\b|STR\b|Str\b|Skills|Saving|Senses|Languages|Challenge|CR\b|Damage|Condition|Immun|Resist|Vulner|Gear|Initiative)|$)"), ("cr", r"(?:Challenge|\bCR)\s*(\d+(?:/\d+)?)")):
        m = re.search(rx, flat)
        if m:
            meta[key] = re.sub(r"\(\s+", "(", re.sub(r"\s+\)", ")", re.sub(r"\s+", " ", m.group(1)))).strip().rstrip(",;")
    return out, img, meta


IMG_DIR = DATA / "mimg"


def image_file(e):
    ext = (re.search(r"\.(jpe?g|png|webp)(?:$|\?)", e.get("img", ""), re.I) or [None, "jpg"])[1].lower()
    return IMG_DIR / (re.sub(r"[^a-z0-9-]", "", e["slug"]) + "_" + e["ed"] + "." + ext)


def cache_image(session, e):
    f = image_file(e)
    if f.exists():
        return f
    try:
        IMG_DIR.mkdir(parents=True, exist_ok=True)
        r = session.get(e["img"], headers=HEADERS, timeout=30)
        if r.ok and r.headers.get("content-type", "").startswith("image"):
            f.write_bytes(r.content)
            time.sleep(DELAY)
            return f
    except Exception as ex:
        print(f"  ! image failed {e.get('img')}: {ex}")
    return None


def run(include_2014=False, refresh=False, progress=None, limit=None, download_images=False):
    import requests
    session = requests.Session()
    log = progress or (lambda d, t, m: print(f"[{d}/{t}] {m}"))
    entries = {}
    log(0, 0, "Reading monster list (2024)…")
    html = fetch(session, INDEX_2024, refresh=True)
    if html:
        entries.update(parse_index(html, INDEX_2024, LINK_2024, "2024"))
    if include_2014:
        log(0, 0, "Reading monster list (2014)…")
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
            block, img, meta = statblock_html(page, e["name"], e["url"])
            if not block:   # fall back to the plain text reader
                block = statblock_lines(page, e["name"])
            blocks[e["slug"] + "|" + e["ed"]] = block
            if img:
                e["img"] = img
            for k, v in meta.items():   # the stat block is more reliable than the index table
                if v and (k != "cr" or not re.fullmatch(r"\d+(/\d+)?", str(e.get("cr", "")))):
                    e[k] = v
        except Exception as ex:
            print(f"  ! parse error {e['url']}: {ex}")
        if download_images and e.get("img"):
            cache_image(session, e)
    DATA.mkdir(exist_ok=True)
    out = {"source": "aidedd.org", "imported": time.strftime("%Y-%m-%d %H:%M"), "list": items, "blocks": blocks}
    OUT.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    log(len(items), len(items), f"Done: {len(items)} monsters, {len(blocks)} stat blocks -> {OUT.name}")
    return out


if __name__ == "__main__":
    a = sys.argv[1:]
    if a and a[0] == "--test":
        import requests
        url = a[1]
        html = fetch(requests.Session(), url, refresh=True)
        if "monster/" in url and not LINK_2024.search(url):
            for e in list(parse_index(html, url, LINK_2024, "2024").values())[:10]:
                print(e)
        elif "monsters.php" in url:
            for e in list(parse_index(html, url, LINK_2014, "2014").values())[:10]:
                print(e)
        else:
            from bs4 import BeautifulSoup
            name = clean((BeautifulSoup(html, "html.parser").find("h1") or BeautifulSoup("<x>?</x>", "html.parser")).get_text())
            block, img, meta = statblock_html(html, name, url)
            print("NAME:", name, "| IMAGE:", img, "| META:", meta)
            print(block[:3000])
    else:
        run(include_2014="--2014" in a, refresh="--refresh" in a, download_images="--images" in a)
