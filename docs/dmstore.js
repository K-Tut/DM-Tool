"use strict";
/* ============ DM Tool storage: this device (IndexedDB) + laptop folder mirror + Google Drive sync ============
   - Every device keeps its own copy of scenarios, the world map and the monster compendium (IndexedDB).
   - When the app is served by dm.py (laptop), scenarios are mirrored two-way into the scenarios/ folder,
     and the monster compendium comes from the laptop's data/monsters.json.
   - Google Drive sync uses the hidden app-data folder (scope drive.appdata), the same one as the Character
     Builder, with its own file names: dm_scen_<id>.json, dm_world.json, dm_monsters.json.
*/
const DDB = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const r = indexedDB.open("dm-tool", 1);
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore("scens", { keyPath: "id" }); d.createObjectStore("kv"); };
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
    });
  },
  async tx(store, mode, fn) {
    const d = await this.open();
    return new Promise((res, rej) => { const t = d.transaction(store, mode); const out = fn(t.objectStore(store)); t.oncomplete = () => res(out instanceof IDBRequest ? out.result : out); t.onerror = () => rej(t.error); });
  },
  all() { return this.tx("scens", "readonly", s => s.getAll()); },
  getScen(id) { return this.tx("scens", "readonly", s => s.get(id)); },
  putScen(c) { return this.tx("scens", "readwrite", s => s.put(c)); },
  delScen(id) { return this.tx("scens", "readwrite", s => s.delete(id)); },
  get(k) { return this.tx("kv", "readonly", s => s.get(k)); },
  set(k, v) { return this.tx("kv", "readwrite", s => s.put(v, k)); }
};
const clone = o => JSON.parse(JSON.stringify(o));
function scenSummary(sc) { return { id: sc.id, name: sc.name, subtitle: sc.subtitle || "", summary: sc.summary || "", thumb: sc.thumb || "", updated: sc.updated || 0 }; }

const Store = {
  async list() { return (await DDB.all()).sort((a, b) => (b.updated || 0) - (a.updated || 0)).map(scenSummary); },
  async get(id) { return DDB.getScen(id); },
  async put(sc, touch = true) {
    if (touch) sc.updated = Date.now();
    await DDB.putScen(clone(sc));
    if (touch) { Folder.push(sc); Sync.soon(); }
  },
  async del(id) {
    await DDB.delScen(id); await Folder.remove(id);
    const t = (await DDB.get("tombstones")) || {}; t[id] = Date.now(); await DDB.set("tombstones", t);
    Sync.soon();
  },
  async getWorld() { const w = (await DDB.get("world")) || { id: "_world", name: "World", map: null, nodes: [], updated: 0 }; w.nodes ||= []; return w; },
  async putWorld(w, touch = true) {
    if (touch) w.updated = Date.now();
    await DDB.set("world", clone(w));
    if (touch) { Folder.pushWorld(w); Sync.soon(); }
  },
  async getMon() { return (await DDB.get("monsters")) || { list: [], blocks: {} }; },
  async setMon(m, fromRemote) {
    m._updated = fromRemote ? (m._updated || Date.now()) : Date.now();
    await DDB.set("monsters", m);
    if (!fromRemote) Sync.soon();
  }
};

// ---------- laptop: mirror into the scenarios folder (only when dm.py serves the app) ----------
const Folder = {
  timers: {},
  put(path, obj) {
    clearTimeout(this.timers[path]);
    const data = clone(obj); delete data._driveId; delete data._syncedAt;
    this.timers[path] = setTimeout(() => fetch(path, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).catch(() => { }), 400);
  },
  push(sc) { if (S.server && sc) this.put("api/scenarios/" + encodeURIComponent(sc.id), sc); },
  pushWorld(w) { if (S.server && w) this.put("api/scenarios/_world", w); },
  async remove(id) { if (S.server) await fetch("api/scenarios/" + encodeURIComponent(id), { method: "DELETE" }).catch(() => { }); },
  // newer version wins; files only on disk come in, scenarios only in the app go out
  async pull() {
    if (!S.server) return 0;
    let n = 0;
    try {
      const list = await (await fetch("api/scenarios", { cache: "no-store" })).json();
      const tomb = (await DDB.get("tombstones")) || {}, onDisk = new Set();
      for (const it of list) {
        onDisk.add(it.id);
        if (tomb[it.id]) { await this.remove(it.id); continue; }
        const local = await DDB.getScen(it.id);
        if (!local || (it.updated || 0) > (local.updated || 0)) {
          const sc = await (await fetch("api/scenarios/" + encodeURIComponent(it.id), { cache: "no-store" })).json();
          if (!sc || sc.error) continue;
          sc.id ||= it.id; sc.updated ||= Date.now();
          if (local) { sc._driveId = local._driveId; sc._syncedAt = local._syncedAt; }
          await DDB.putScen(sc); n++;
        } else if ((local.updated || 0) > (it.updated || 0)) this.push(local);
      }
      for (const sc of await DDB.all()) if (!onDisk.has(sc.id)) this.push(sc);
      // world map
      const rw = await (await fetch("api/scenarios/_world", { cache: "no-store" })).json(), lw = await DDB.get("world");
      if (rw && (rw.updated || 0) > (lw?.updated || 0) && (rw.map || (rw.nodes || []).length)) { await DDB.set("world", rw); n++; }
      else if (lw && (lw.updated || 0) > (rw?.updated || 0)) this.pushWorld(lw);
      // monster compendium imported on this laptop
      const st = await (await fetch("api/monsters/import", { cache: "no-store" })).json();
      const lm = await DDB.get("monsters");
      if (!st.running) {
        const rm = await (await fetch("api/monsters", { cache: "no-store" })).json();
        if ((rm.list || []).length && rm.imported && rm.imported !== lm?.imported) { await Store.setMon(rm, false); await loadMonsters(); n++; }
      }
    } catch (e) { console.warn("folder sync", e); }
    return n;
  }
};
async function detectServer() {
  try { const r = await fetch("api/net", { cache: "no-store" }); if (!r.ok) return false; const j = await r.json(); return Array.isArray(j.ips); } catch (e) { return false; }
}

// ---------- Google Drive sync ----------
const Sync = {
  token: null, exp: 0, status: "off", msg: "", timer: null, busy: false, last: 0, settings: {},
  async init() { this.settings = (await DDB.get("settings")) || {}; this.loadToken(); },
  saveSettings() { return DDB.set("settings", this.settings); },
  clientId() { return this.settings.clientId || window.GOOGLE_CLIENT_ID || ""; },
  enabled() { return !!(this.settings.sync && this.clientId()); },
  setStatus(st, msg) { this.status = st; this.msg = msg || ""; renderSyncChip(); },
  loadToken() { try { const t = JSON.parse(localStorage.getItem("gtoken") || "null"); if (t && t.exp > Date.now() + 60000) { this.token = t.token; this.exp = t.exp; } } catch (e) { } },
  hasToken() { if (!this.token) this.loadToken(); return this.token && this.exp > Date.now() + 30000; },
  loadGis() {
    if (window.google?.accounts?.oauth2) return Promise.resolve();
    return new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.onload = res; s.onerror = () => rej(new Error("Could not load Google sign-in (offline?)")); document.head.appendChild(s); });
  },
  // must be called from a click (opens the Google popup)
  async connect() {
    if (!this.clientId()) { toast("Enter your Google Client ID first"); return; }
    try { await this.loadGis(); } catch (e) { this.setStatus("error", e.message); return; }
    return new Promise(res => {
      const tc = google.accounts.oauth2.initTokenClient({
        client_id: this.clientId(), scope: "https://www.googleapis.com/auth/drive.appdata",
        callback: async r => {
          if (r.error) { this.setStatus("error", r.error); return res(); }
          this.token = r.access_token; this.exp = Date.now() + (r.expires_in || 3600) * 1000;
          try { localStorage.setItem("gtoken", JSON.stringify({ token: this.token, exp: this.exp })); } catch (e) { }
          this.settings.sync = true; await this.saveSettings();
          await this.run(); res();
        },
        error_callback: e => { this.setStatus("error", e.type === "popup_closed" ? "Sign-in cancelled" : (e.message || e.type)); res(); }
      });
      tc.requestAccessToken({ prompt: this.settings.connectedOnce ? "" : "consent" });
      this.settings.connectedOnce = true; this.saveSettings();
    });
  },
  disconnect() { this.token = null; this.exp = 0; this.settings.sync = false; this.saveSettings(); this.setStatus("off"); },
  soon(ms = 2500) { if (!this.enabled()) return; clearTimeout(this.timer); this.timer = setTimeout(() => this.run(), ms); },
  async api(method, url, body, headers = {}) {
    const r = await fetch(url, { method, body, headers: { Authorization: "Bearer " + this.token, ...headers } });
    if (r.status === 401) { this.token = null; throw new Error("auth"); }
    if (!r.ok) throw new Error(method + " " + r.status + " " + (await r.text()).slice(0, 200));
    return r;
  },
  async list() {
    const files = []; let page = "";
    do {
      const j = await (await this.api("GET", "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&pageSize=1000&fields=nextPageToken,files(id,name,modifiedTime,appProperties)" + (page ? "&pageToken=" + page : ""))).json();
      files.push(...j.files); page = j.nextPageToken || "";
    } while (page);
    return files;
  },
  async download(id) { return (await this.api("GET", `https://www.googleapis.com/drive/v3/files/${id}?alt=media`)).json(); },
  async upload(name, obj, updated, id) {
    const meta = { name, appProperties: { updated: String(updated) } };
    if (!id) meta.parents = ["appDataFolder"];
    const data = clone(obj); delete data._driveId; delete data._syncedAt;
    const bnd = "b" + Math.random().toString(36).slice(2);
    const body = new Blob([`--${bnd}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${bnd}\r\nContent-Type: application/json\r\n\r\n`, JSON.stringify(data), `\r\n--${bnd}--`]);
    const url = id ? `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=multipart` : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
    return (await this.api(id ? "PATCH" : "POST", url, body, { "Content-Type": "multipart/related; boundary=" + bnd })).json();
  },
  async remove(id) { await this.api("DELETE", `https://www.googleapis.com/drive/v3/files/${id}`); },

  async run() {
    if (!this.enabled() || this.busy) return;
    if (!navigator.onLine) { this.setStatus("offline", "Offline — will sync later"); return; }
    if (!this.hasToken()) { this.setStatus("signin", "Tap to reconnect Google Drive"); return; }
    this.busy = true; this.setStatus("syncing");
    let changes = 0, openChanged = false, worldChanged = false;
    try {
      await flushSave();
      const remote = await this.list(), rmap = {};
      remote.forEach(f => rmap[f.name] = f);
      const ru = f => +(f?.appProperties?.updated || 0);
      // --- monster compendium (big, changes rarely) ---
      const lm = await DDB.get("monsters"), rmf = rmap["dm_monsters.json"];
      if (rmf && ru(rmf) > (lm?._updated || 0)) { this.setStatus("syncing", "Downloading monsters…"); const m = await this.download(rmf.id); m._updated = ru(rmf); await Store.setMon(m, true); await loadMonsters(); changes++; }
      else if (lm && (lm.list || []).length && (lm._updated || 0) > ru(rmf)) { this.setStatus("syncing", "Uploading monsters…"); await this.upload("dm_monsters.json", lm, lm._updated, rmf?.id); }
      // --- world map ---
      const lw = await DDB.get("world"), rwf = rmap["dm_world.json"];
      if (rwf && ru(rwf) > (lw?.updated || 0)) { const w = await this.download(rwf.id); w.updated = ru(rwf); await DDB.set("world", w); Folder.pushWorld(w); changes++; worldChanged = true; }
      else if (lw && (lw.updated || 0) > ru(rwf)) await this.upload("dm_world.json", lw, lw.updated, rwf?.id);
      // --- scenarios ---
      const tomb = (await DDB.get("tombstones")) || {}, seen = new Set();
      for (const sc of await DDB.all()) {
        const name = "dm_scen_" + sc.id + ".json"; seen.add(name);
        const r = rmap[name], rU = ru(r), lU = sc.updated || 0;
        if (!r) {
          if (sc._syncedAt && lU <= sc._syncedAt) { await DDB.delScen(sc.id); await Folder.remove(sc.id); changes++; if (S.scen?.id === sc.id) { S.scen = null; S.view = "home"; openChanged = true; } }   // deleted on another device
          else { const f = await this.upload(name, sc, lU); sc._syncedAt = lU; sc._driveId = f.id; await DDB.putScen(sc); }
        } else if (rU > lU) {
          const rc = await this.download(r.id); rc.updated = rU; rc._syncedAt = rU; rc._driveId = r.id; await DDB.putScen(rc); Folder.push(rc); changes++;
          if (S.scen?.id === rc.id) { S.scen = migrateScen(rc); openChanged = true; }
        } else if (lU > rU) { await this.upload(name, sc, lU, r.id); sc._syncedAt = lU; sc._driveId = r.id; await DDB.putScen(sc); }
        else if (sc._syncedAt !== lU) { sc._syncedAt = lU; await DDB.putScen(sc); }
      }
      for (const f of remote) {
        if (!f.name.startsWith("dm_scen_") || seen.has(f.name)) continue;
        const id = f.name.slice(8, -5);
        if (tomb[id]) { await this.remove(f.id); delete tomb[id]; continue; }
        const rc = await this.download(f.id); rc.updated = ru(f); rc._syncedAt = ru(f); rc._driveId = f.id; rc.id ||= id;
        await DDB.putScen(rc); Folder.push(rc); changes++;
      }
      for (const id in tomb) if (!rmap["dm_scen_" + id + ".json"]) delete tomb[id];
      await DDB.set("tombstones", tomb);
      this.last = Date.now();
      this.setStatus("ok", "Synced " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      if (changes) await afterRemoteChange(openChanged, worldChanged);
    } catch (e) {
      if (e.message === "auth") this.setStatus("signin", "Tap to reconnect Google Drive");
      else { this.setStatus("error", e.message); console.warn(e); }
    } finally { this.busy = false; }
  }
};
// re-read lists after another device (or the laptop folder) changed something
async function afterRemoteChange(openChanged, worldChanged) {
  S.list = await Store.list();
  if (worldChanged || S.view === "home") S.world = await Store.getWorld();
  const typing = document.activeElement && ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName);
  if ((S.view === "home" || openChanged) && !S.modal && !typing) render();
}
function renderSyncChip() {
  const el = document.getElementById("syncchip"); if (!el) return;
  const st = Sync.status;
  if (!Sync.enabled() && st !== "error") { el.innerHTML = ""; return; }
  const icon = { ok: "☁✓", syncing: "☁…", signin: "☁!", offline: "☁✕", error: "☁!" }[st] || "☁";
  el.innerHTML = `<button class="ghost small ${st === "signin" || st === "error" ? "warnbtn" : ""}" data-act="syncTap" title="${esc(Sync.msg || st)}">${icon}<span class="synctxt"> ${esc(st === "ok" ? "Synced" : st === "syncing" ? (Sync.msg || "Syncing") : st === "signin" ? "Reconnect" : st === "offline" ? "Offline" : "Sync error")}</span></button>`;
}
// periodic + when the app comes back to the foreground
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") { Sync.soon(300); Folder.pull().then(n => { if (n) afterRemoteChange(false, true); }); }
  else flushSave().then(() => Sync.run());
});
window.addEventListener("online", () => Sync.soon(500));
setInterval(() => { if (document.visibilityState === "visible" && Date.now() - Sync.last > 45000) Sync.run(); }, 15000);
