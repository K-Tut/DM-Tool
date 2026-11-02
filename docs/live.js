"use strict";
/* ============ Players' phones: online table (no laptop firewall, no admin rights needed) ============
   The DM Tool page itself is the meeting point: it opens a WebRTC connection (PeerJS) and the players' phones
   connect to it over the internet. It does what dm.py does on the local network: the shared battlemap,
   who is at the table, and the loot / items handed out. The local-network mode (laptop server) still exists. */
const PEERJS_URL = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";
function liveMode() { let m = ""; try { m = localStorage.getItem("dmLiveMode") || ""; } catch (e) { } return S.server && m === "lan" ? "lan" : "online"; }
function tableUrl() { return location.protocol === "https:" ? new URL("table.html", location.href).href : (window.TABLE_URL || "https://k-tut.github.io/DM-Tool/table.html"); }
function loadPeerJs() {
  if (window.Peer) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = PEERJS_URL; s.onload = res; s.onerror = () => rej(new Error("no internet")); document.head.appendChild(s); });
}
// every change on the DM side goes through here: to dm.py (local network) or to the online host
async function liveApi(path, body) { if (liveMode() === "lan") return api(path, { method: "POST", body }); await Host.ensure().catch(() => { }); return Host.apply(path, body || {}); }

const Host = {
  peer: null, id: null, status: "off", error: "", conns: new Set(),
  H: { table: { active: false, rev: 0, imageRev: 0, image: "", name: "", grid: {}, tokens: [], templates: [], scenarioId: "", mapId: "", w: 0, h: 0 }, players: {}, offers: [], imgs: {}, imgRev: 0 },
  restore() { try { const o = JSON.parse(localStorage.getItem("dmLiveHost") || "null"); if (o) { this.H.players = o.players || {}; this.H.offers = o.offers || []; } } catch (e) { } },
  persist() { clearTimeout(this._pt); this._pt = setTimeout(() => { try { localStorage.setItem("dmLiveHost", JSON.stringify({ players: this.H.players, offers: this.H.offers.filter(o => !o.closed) })); } catch (e) { } }, 400); },
  async ensure() {
    if (this.peer && !this.peer.destroyed) return;
    this.status = "connecting"; this.error = ""; refreshLiveUi();
    try { await loadPeerJs(); } catch (e) { this.status = "error"; this.error = "The online table needs internet (on the DM device and the players' phones)."; refreshLiveUi(); throw e; }
    try { this.id = localStorage.getItem("dmPeerId"); } catch (e) { }
    if (!this.id) { this.id = "ktut-dm-" + Math.random().toString(36).slice(2, 10); try { localStorage.setItem("dmPeerId", this.id); } catch (e) { } }
    this.restore();
    await new Promise(res => {
      const p = this.peer = new Peer(this.id, { debug: 1, ...(window.PEER_OPTS || {}) });
      p.on("open", () => { this.status = "ready"; refreshLiveUi(); res(); });
      p.on("connection", c => this.attach(c));
      p.on("disconnected", () => { this.status = "connecting"; refreshLiveUi(); setTimeout(() => { try { p.reconnect(); } catch (e) { } }, 1500); });
      p.on("error", e => {
        if (e.type === "unavailable-id") { this.id = "ktut-dm-" + Math.random().toString(36).slice(2, 10); try { localStorage.setItem("dmPeerId", this.id); } catch (x) { } p.destroy(); this.peer = null; this.ensure().then(res, res); return; }
        if (e.type === "peer-unavailable") return;   // a player who left
        this.status = "error"; this.error = e.message || e.type; refreshLiveUi(); res();
      });
    });
  },
  attach(c) {
    c.meta = { imageRev: -1, imgRev: -1 };
    c.on("open", () => { this.conns.add(c); this.send(c); });
    c.on("data", m => this.msg(c, m));
    c.on("close", () => { this.conns.delete(c); this.bump(); });
    c.on("error", () => { this.conns.delete(c); });
  },
  online(pid) { for (const c of this.conns) if (c.pid === pid && c.open) return true; return false; },
  players() { return Object.values(this.H.players).map(p => ({ ...p, online: this.online(p.pid) })); },
  view(dm, c) {
    const t = this.H.table, v = { active: t.active, rev: t.rev, imageRev: t.imageRev, name: t.name, grid: t.grid, templates: t.templates, scenarioId: t.scenarioId, mapId: t.mapId, w: t.w, h: t.h };
    v.tokens = dm ? t.tokens : t.tokens.filter(x => !x.hidden);
    v.players = this.players();
    v.offers = this.H.offers.filter(o => !o.closed).map(o => dm ? o : { ...o, items: (o.items || []).map(it => it.cursed && !it.identified ? { ...it, curse: "" } : it) });
    if (c) { if (c.meta.imageRev !== t.imageRev) { v.image = t.image; c.meta.imageRev = t.imageRev; } if (c.meta.imgRev !== this.H.imgRev) { v.imgs = this.H.imgs; c.meta.imgRev = this.H.imgRev; } }
    return v;
  },
  send(c) { try { if (c.open) c.send({ t: "state", s: this.view(false, c) }); } catch (e) { } },
  bump() { this.H.table.rev++; for (const c of this.conns) this.send(c); onLiveState(this.view(true)); this.persist(); },
  msg(c, m) {
    if (!m || typeof m !== "object") return;
    if (m.t === "hello") return this.send(c);
    if (m.t === "join" && m.p && m.p.pid) { const p = m.p; c.pid = p.pid; this.H.players[p.pid] = { pid: String(p.pid).slice(0, 40), name: String(p.name || "Player").slice(0, 40), color: String(p.color || "#2f7d4a").slice(0, 10), img: String(p.img || "").slice(0, 20000) }; return this.bump(); }
    if (m.t === "move") return this.apply("api/table/move", m);
    if (m.t === "act") { if (c.pid) m.pid = c.pid; return this.apply("api/offer/act", m); }
  },
  // the same rules as dm.py
  apply(path, b) {
    const H = this.H, T = H.table;
    if (path === "api/table/host") { if (b.image != null && b.image !== T.image) { T.image = b.image; T.imageRev++; } ["name", "grid", "tokens", "templates", "scenarioId", "mapId", "w", "h"].forEach(k => { if (k in b) T[k] = b[k]; }); T.active = true; }
    else if (path === "api/table/update") ["name", "grid", "tokens", "templates"].forEach(k => { if (k in b) T[k] = b[k]; });
    else if (path === "api/table/move") T.tokens.forEach(t => { if (t.id === b.id) { t.x = +b.x; t.y = +b.y; } });
    else if (path === "api/table/stop") T.active = false;
    else if (path === "api/offer/new") {
      const o = { claims: {}, oks: {}, shares: null, ...b.offer };
      o.members = o.kind === "player" && o.to ? [o.to] : this.players().filter(p => p.online).map(p => p.pid);
      if (o.kind === "player") o.claims = Object.fromEntries((o.items || []).map(it => [it.id, o.to]));
      o.done = false; H.offers.push(o);
    } else if (path === "api/offer/act") {
      const o = H.offers.find(x => x.id === b.oid); if (!o) return { error: "no offer" };
      const pid = b.pid || "", a = b.act;
      if (pid && !o.members.includes(pid) && o.kind !== "player") o.members.push(pid);
      if (a === "claim" && !o.done) { if (o.claims[b.item] === pid) delete o.claims[b.item]; else o.claims[b.item] = pid; o.oks = {}; }
      else if (a === "split" && !o.done && o.members.length) { const n = o.members.length, c = o.coins || {};
        o.shares = Object.fromEntries(o.members.map(p => [p, Object.fromEntries(Object.keys(c).map(k => [k, Math.floor((+c[k] || 0) / n)]))]));
        o.leftover = Object.fromEntries(Object.keys(c).filter(k => (+c[k] || 0) % n).map(k => [k, (+c[k] || 0) % n])); o.oks = {}; }
      else if (a === "ok" && !o.done) { o.oks[pid] = !o.oks[pid]; if (o.members.every(p => o.oks[p])) o.done = true; }
      else if (a === "identify") (o.items || []).forEach(it => { if (it.id === b.item) { it.identified = true; it.identifiedBy = pid; } });
      else if (a === "close") o.closed = true;
    }
    if (path.startsWith("api/table")) this.noteImages();
    this.bump(); return { ok: true };
  },
  // monster pictures for the players' tokens: sent once, then referenced by key
  noteImages() {
    let changed = false;
    for (const t of this.H.table.tokens) { if (!t.ref || this.H.imgs[t.ref]) continue;
      const src = imgForPlayers(t.ref); if (src) { this.H.imgs[t.ref] = src; changed = true; } }
    if (changed) this.H.imgRev++;
  }
};
function imgForPlayers(ref) {
  if (ref.startsWith("c:")) { const sm = S.scen?.monsters.find(m => m.id === ref.slice(2)); return sm?.custom?.image || ""; }
  if (S.mimg[ref]) return S.mimg[ref];
  const e = S.mon.byKey[ref]; return e?.img && /^https?:/.test(e.img) ? e.img : "";
}
// what changed at the table (players joined, loot claimed, tokens moved by players) -> DM screen
function onLiveState(s) {
  const sig = JSON.stringify([s.players, s.offers]);
  if (sig !== S.shareSig) { S.shareSig = sig; S.players = s.players || []; S.offers = s.offers || [];
    if (S.view === "scen" && S.tab === "loot" && !document.querySelector("input:focus, textarea:focus, select:focus") && !S.modal) render(); }
  refreshLiveUi();
  if (s.active && S.scen && s.scenarioId === S.scen.id) {
    S.live = { mapId: s.mapId };
    const m = S.scen.battlemaps.find(b => b.id === s.mapId);
    if (m && !S.ui.dragging) {
      let changed = false;
      for (const t of s.tokens) { const mine = m.tokens.find(k => k.id === t.id); if (mine && (mine.x !== t.x || mine.y !== t.y)) { mine.x = t.x; mine.y = t.y; changed = true; } }
      if (changed) { save(); if (S.mapId === m.id) drawBattlemap(); if (typeof cbMap === "function" && cbMap()?.id === m.id) drawCbMap(); }
    }
  } else if (!s.active) S.live = null;
}
function refreshLiveUi() { if (S.modal?.type === "qr") renderModal(); }
function liveStatusHtml() {
  if (liveMode() === "lan") return "";
  const n = Host.players().filter(p => p.online).length;
  return Host.status === "ready" ? `<span class="small"><span class="livedot"></span>online table open${n ? ` · ${n} player${n > 1 ? "s" : ""} connected` : ""}</span>`
    : Host.status === "connecting" ? `<span class="small muted">connecting to the internet relay…</span>` : Host.status === "error" ? `<span class="small warn">${esc(Host.error)}</span>` : "";
}

// keep the players' phones in touch (they reconnect when nothing arrives for a while), and reopen the table after a reload
setInterval(() => { if (Host.peer && Host.status === "ready") for (const c of Host.conns) Host.send(c); }, 15000);
window.addEventListener("load", () => setTimeout(() => { let used = false; try { used = !!localStorage.getItem("dmPeerId"); } catch (e) { } if (used && liveMode() === "online") Host.ensure().catch(() => { }); }, 1500));
