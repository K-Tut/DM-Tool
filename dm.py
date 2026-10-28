"""
D&D DM Tool - local server.
Start with:  python dm.py      -> opens http://localhost:8766 (the DM screen)
Players on the same Wi-Fi / hotspot scan the QR code shown when you share a battlemap.
Works without internet. Scenarios are saved as JSON files in ./scenarios
"""
import json
import re
import shutil
import socket
import sys
import threading
import time
import webbrowser
import mimetypes
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

ROOT = Path(__file__).resolve().parent
APP = ROOT / "docs"          # the app (GitHub Pages publishes this same folder)
SCEN = ROOT / "scenarios"
DATA = ROOT / "data"
PORT = 8766
SCEN.mkdir(exist_ok=True)
DATA.mkdir(exist_ok=True)

import_state = {"running": False, "done": 0, "total": 0, "msg": "", "error": None}

# ---------------- live table session (shared battlemap) ----------------
table = {"active": False, "rev": 0, "imageRev": 0, "image": "", "name": "", "grid": {}, "tokens": [], "scenarioId": "", "mapId": "", "w": 0, "h": 0}
cond = threading.Condition()


def table_view(dm, img_rev):
    t = {k: table[k] for k in ("active", "rev", "imageRev", "name", "grid", "scenarioId", "mapId", "w", "h")}
    t["tokens"] = table["tokens"] if dm else [x for x in table["tokens"] if not x.get("hidden")]
    if img_rev != "skip" and str(img_rev) != str(table["imageRev"]):
        t["image"] = table["image"]
    return t


def bump():
    table["rev"] += 1
    cond.notify_all()


_mon = {"mtime": 0, "map": {}}


def monster_entry(key):
    f = DATA / "monsters.json"
    if not f.exists():
        return None
    if f.stat().st_mtime != _mon["mtime"]:
        d = json.loads(f.read_text(encoding="utf-8"))
        _mon["map"] = {x["slug"] + "|" + x["ed"]: x for x in d.get("list", [])}
        _mon["mtime"] = f.stat().st_mtime
    return _mon["map"].get(key)


def safe_id(s):
    return re.sub(r"[^A-Za-z0-9_-]", "", s or "")[:80]


def lan_ips():
    ips = set()
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.add(info[4][0])
    except Exception:
        pass
    for target in ("8.8.8.8", "192.168.1.1", "10.255.255.255"):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect((target, 1))
            ips.add(s.getsockname()[0])
            s.close()
        except Exception:
            pass
    ips = [i for i in ips if not i.startswith("127.") and not i.startswith("169.254.")]
    # Windows mobile hotspot is usually 192.168.137.1 -> list it first
    ips.sort(key=lambda i: (0 if i.startswith("192.168.137.") else 1 if i.startswith("192.168.") else 2, i))
    return ips


def run_import(include_2014, refresh, images=False):
    import_state.update(running=True, done=0, total=0, msg="Starting...", error=None)
    try:
        import monster_importer

        def prog(done, total, msg):
            import_state.update(done=done, total=total, msg=msg)
        monster_importer.run(include_2014=include_2014, refresh=refresh, progress=prog, download_images=images)
    except ModuleNotFoundError as e:
        import_state["error"] = f"Missing Python package: {e.name}. Run:  pip install requests beautifulsoup4"
    except Exception as e:
        import_state["error"] = f"{type(e).__name__}: {e}"
    finally:
        import_state["running"] = False


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        pass

    def send_bytes(self, body, ctype, code=200):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, obj, code=200):
        self.send_bytes(json.dumps(obj, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8", code)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n).decode("utf-8")) if n else {}

    def static(self, path):
        f = (APP / path.lstrip("/")).resolve()
        if APP not in f.parents or not f.is_file():
            return self.send_bytes(b"not found", "text/plain", 404)
        self.send_bytes(f.read_bytes(), mimetypes.guess_type(str(f))[0] or "application/octet-stream")

    def do_GET(self):
        u = urlparse(self.path)
        path, q = u.path, parse_qs(u.query)
        if path in ("/", ""):
            return self.static("index.html")
        if path in ("/table", "/table/"):
            return self.static("table.html")
        if path == "/api/scenarios":
            out = []
            for f in sorted(SCEN.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
                if f.stem.startswith("_"):      # _world.json is the world map, not a scenario
                    continue
                try:
                    c = json.loads(f.read_text(encoding="utf-8"))
                    out.append({"id": c.get("id") or f.stem, "name": c.get("name", "?"), "updated": c.get("updated", 0),
                                "thumb": c.get("thumb", ""), "summary": c.get("summary", ""), "subtitle": c.get("subtitle", "")})
                except Exception:
                    pass
            return self.send_json(out)
        m = re.match(r"^/api/scenarios/([^/]+)$", path)
        if m:
            f = SCEN / (safe_id(m.group(1)) + ".json")
            if not f.exists():
                if m.group(1) == "_world":
                    return self.send_json({"id": "_world", "name": "World", "map": None, "nodes": []})
                return self.send_json({"error": "not found"}, 404)
            return self.send_bytes(f.read_bytes(), "application/json; charset=utf-8")
        if path == "/api/monsters":
            f = DATA / "monsters.json"
            return self.send_bytes(f.read_bytes() if f.exists() else b'{"list":[],"blocks":{}}', "application/json; charset=utf-8")
        if path == "/api/monsters/import":
            return self.send_json(import_state)
        if path == "/api/mimg":                 # monster image: cached file, downloaded on first use
            key = q.get("k", [""])[0]
            e = monster_entry(key)
            if not e or not e.get("img"):
                return self.send_bytes(b"", "text/plain", 404)
            import monster_importer as mi
            f = mi.image_file(e)
            if not f.exists():
                try:
                    import requests
                    mi.cache_image(requests.Session(), e)
                except Exception:
                    pass
            if not f.exists():
                return self.send_bytes(b"", "text/plain", 404)
            self.send_response(200)
            body = f.read_bytes()
            self.send_header("Content-Type", mimetypes.guess_type(str(f))[0] or "image/jpeg")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "max-age=86400")
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/api/net":
            return self.send_json({"port": self.server.server_port, "ips": lan_ips()})
        if path == "/api/table":
            dm = q.get("dm", ["0"])[0] == "1"
            since = int(q.get("rev", ["-1"])[0] or -1)
            img = q.get("img", [""])[0]
            with cond:
                end = time.time() + 20
                while table["rev"] <= since and time.time() < end:
                    cond.wait(timeout=end - time.time())
                view = table_view(dm, img)
            return self.send_json(view)
        return self.static(path)

    def do_PUT(self):
        m = re.match(r"^/api/scenarios/([^/]+)$", urlparse(self.path).path)
        if not m:
            return self.send_json({"error": "bad path"}, 404)
        sid = safe_id(m.group(1))
        data = self.body()
        f = SCEN / (sid + ".json")
        if f.exists():
            bak = SCEN / "backup"
            bak.mkdir(exist_ok=True)
            shutil.copy(f, bak / f.name)
        tmp = f.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        tmp.replace(f)
        return self.send_json({"ok": True})

    def do_DELETE(self):
        m = re.match(r"^/api/scenarios/([^/]+)$", urlparse(self.path).path)
        if not m:
            return self.send_json({"error": "bad path"}, 404)
        f = SCEN / (safe_id(m.group(1)) + ".json")
        if f.exists():
            trash = SCEN / "deleted"
            trash.mkdir(exist_ok=True)
            shutil.move(str(f), str(trash / f.name))
        return self.send_json({"ok": True})

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/monsters/import":
            b = self.body()
            if not import_state["running"]:
                threading.Thread(target=run_import, args=(bool(b.get("include2014")), bool(b.get("refresh")), bool(b.get("images"))), daemon=True).start()
            return self.send_json({"ok": True})
        if path == "/api/table/host":          # DM starts sharing a battlemap (or switches map)
            b = self.body()
            with cond:
                if b.get("image") is not None and b.get("image") != table["image"]:
                    table["image"] = b["image"]
                    table["imageRev"] += 1
                for k in ("name", "grid", "tokens", "scenarioId", "mapId", "w", "h"):
                    if k in b:
                        table[k] = b[k]
                table["active"] = True
                bump()
            return self.send_json({"ok": True, "rev": table["rev"]})
        if path == "/api/table/update":        # DM changed tokens/grid
            b = self.body()
            with cond:
                for k in ("name", "grid", "tokens"):
                    if k in b:
                        table[k] = b[k]
                bump()
            return self.send_json({"ok": True, "rev": table["rev"]})
        if path == "/api/table/move":          # anyone moves a token
            b = self.body()
            with cond:
                for t in table["tokens"]:
                    if t.get("id") == b.get("id"):
                        t["x"], t["y"] = int(b.get("x", t.get("x", 0))), int(b.get("y", t.get("y", 0)))
                bump()
            return self.send_json({"ok": True, "rev": table["rev"]})
        if path == "/api/table/stop":
            with cond:
                table["active"] = False
                bump()
            return self.send_json({"ok": True})
        self.send_json({"error": "bad path"}, 404)


def main():
    port = PORT
    for a in sys.argv[1:]:
        if a.isdigit():
            port = int(a)
    srv = ThreadingHTTPServer(("0.0.0.0", port), Handler)   # 0.0.0.0 = reachable from phones on the same network
    srv.daemon_threads = True
    print(f"DM Tool running at http://localhost:{port}  (players: same Wi-Fi/hotspot, scan the QR code)")
    ips = lan_ips()
    if ips:
        print("Addresses for players:", ", ".join(f"http://{i}:{port}/table" for i in ips))
    if "--no-browser" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(f"http://localhost:{port}")).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
