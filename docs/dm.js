"use strict";
/* ================= D&D DM Tool ================= */
const S = { view: "home", scen: null, list: [], tab: "overview", mapId: null, mon: { list: [], blocks: {} }, ui: {}, modal: null, diceAlways: true };
const ACT = {}, CHG = {};

// ---------- helpers (also used by dice.js) ----------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const norm = s => String(s || "").toLowerCase().replace(/[’'`]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const sgn = n => (n >= 0 ? "+" : "") + n;
const uid = () => Math.random().toString(36).slice(2, 9);
function rollDie(sides) { const a = new Uint32Array(1), lim = Math.floor(0x100000000 / sides) * sides; let x; do { crypto.getRandomValues(a); x = a[0]; } while (x >= lim); return 1 + (x % sides); }
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.remove("hidden"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.add("hidden"), 2200); }
async function api(path, opts = {}) { const r = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined }); return r.json(); }
function getPath(o, p) { return p.split(".").reduce((a, k) => a == null ? a : a[k], o); }
function setPath(o, p, v) { const ks = p.split("."); let cur = o; for (let i = 0; i < ks.length - 1; i++) { if (cur[ks[i]] == null) cur[ks[i]] = {}; cur = cur[ks[i]]; } cur[ks[ks.length - 1]] = v; }
function para(t) { return String(t || "").split("\n").map(l => l.trim()).filter(Boolean).map(l => `<p style="margin:0 0 5px">${esc(l)}</p>`).join(""); }
function sbLinks(html, title) {
  html = html.replace(/(^|[^\w])(\d+)d(\d+)(?:\s*([+−-])\s*(\d+)(?![\w]))?/g, (m, pre, n, s, sg, fl) => {
    const f = `${n}d${s}${sg ? (sg === "+" ? "+" : "-") + fl : ""}`;
    return `${pre}<a href="#" class="dicelink" data-act="roll" data-k="dmg" data-f="${f}" data-t="${esc(title)}">🎲${n}d${s}${sg ? ` ${sg} ${fl}` : ""}</a>`;
  });
  return html.replace(/(Attack Roll:\s*|^|[\s(])([+−-]\d+)(\s*to hit)?/g, (m, pre, mod, th) => (/Attack Roll/.test(pre) || th) ? `${pre}<a href="#" class="dicelink" data-act="roll" data-k="d20" data-m="${mod.replace("−", "-")}" data-t="${esc(title)} attack">🎲${mod}</a>${th || ""}` : m);
}
function inp(path, v, o = {}) { const t = o.type || (typeof v === "number" ? "number" : "text"); return `<input type="${t}" data-path="${path}" ${t === "number" ? "data-num" : ""} value="${esc(v ?? "")}" placeholder="${esc(o.ph || "")}" style="${o.style || ""}" ${o.attr || ""}>`; }
function sel(path, v, options, o = {}) { const opts = options.map(x => Array.isArray(x) ? x : [x, x]); return `<select data-path="${path}" ${o.attr || ""}>${o.blank !== undefined ? `<option value="">${esc(o.blank)}</option>` : ""}${opts.map(([k, l]) => `<option value="${esc(k)}" ${String(k) === String(v ?? "") ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`; }
function pickImage(maxSize) {
  return new Promise(res => {
    const f = document.createElement("input"); f.type = "file"; f.accept = "image/*";
    f.onchange = () => { const file = f.files[0]; if (!file) return res(null); const r = new FileReader();
      r.onload = () => { const img = new Image(); img.onload = () => { const s = Math.min(1, maxSize / Math.max(img.width, img.height)); const cv = document.createElement("canvas"); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s); cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        const t = document.createElement("canvas"); const ts = 200 / Math.max(cv.width, cv.height); t.width = Math.round(cv.width * ts); t.height = Math.round(cv.height * ts); t.getContext("2d").drawImage(cv, 0, 0, t.width, t.height);
        res({ data: cv.toDataURL("image/jpeg", 0.86), w: cv.width, h: cv.height, thumb: t.toDataURL("image/jpeg", 0.7), name: file.name.replace(/\.[^.]+$/, "") }); }; img.src = r.result; };
      r.readAsDataURL(file); };
    f.click();
  });
}
function keepScroll(fn) { const m = {}; document.querySelectorAll("[data-sk]").forEach(e => m[e.dataset.sk] = [e.scrollTop, e.scrollLeft]); fn(); document.querySelectorAll("[data-sk]").forEach(e => { const v = m[e.dataset.sk]; if (v) { e.scrollTop = v[0]; e.scrollLeft = v[1]; } }); }

// ---------- data ----------
const NODE_TYPES = { room: ["Room", "#5b6b7a", "🏠"], encounter: ["Encounter", "#a33", "⚔"], trap: ["Trap", "#c27c0e", "⚠"], secret: ["Secret", "#6b2f8e", "🔑"], clue: ["Clue", "#1f6e8e", "🔍"], treasure: ["Treasure", "#b8901a", "💰"], npc: ["NPC", "#2f7d4a", "🙂"], other: ["Other", "#555", "•"] };
const WORLD_TYPES = { city: ["City", "#7a4b1f", "🏰"], town: ["Town / village", "#5b6b7a", "🏘"], dungeon: ["Dungeon", "#a33", "💀"], region: ["Region", "#2f7d4a", "⛰"], landmark: ["Landmark", "#1f6e8e", "📍"], quest: ["Quest / hook", "#c27c0e", "❗"], faction: ["Faction", "#6b2f8e", "⚑"], other: ["Other", "#555", "•"] };
const isWorld = () => S.view === "home";
const doc = () => isWorld() ? S.world : S.scen;          // the object the map, nodes and data-path fields belong to
const types = () => isWorld() ? WORLD_TYPES : NODE_TYPES;
const SIZE_CELLS = { tiny: 1, small: 1, medium: 1, large: 2, huge: 3, gargantuan: 4 };
const TOKEN_COLORS = ["#1f4e8e", "#2f7d4a", "#6b2f8e", "#c27c0e", "#0f8a8a", "#8e1f1f", "#444444", "#b03a8a"];
function newScenario(name) { return { id: "s" + Date.now().toString(36), name: name || "New scenario", subtitle: "", synopsis: "", created: Date.now(), updated: Date.now(), map: null, nodes: [], battlemaps: [], monsters: [], npcs: [], secrets: [], notes: "", party: { size: 4, level: 3 } }; }
// ----- encounter difficulty (DMG 2014 XP thresholds, as used by donjon's 5e encounter calculator) -----
const XP_BY_CR = { "0": 10, "1/8": 25, "1/4": 50, "1/2": 100, "1": 200, "2": 450, "3": 700, "4": 1100, "5": 1800, "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900, "11": 7200, "12": 8400, "13": 10000, "14": 11500, "15": 13000,
  "16": 15000, "17": 18000, "18": 20000, "19": 22000, "20": 25000, "21": 33000, "22": 41000, "23": 50000, "24": 62000, "25": 75000, "26": 90000, "27": 105000, "28": 120000, "29": 135000, "30": 155000 };
const THRESH = [null, [25, 50, 75, 100], [50, 100, 150, 200], [75, 150, 225, 400], [125, 250, 375, 500], [250, 500, 750, 1100], [300, 600, 900, 1400], [350, 750, 1100, 1700], [450, 900, 1400, 2100], [550, 1100, 1600, 2400], [600, 1200, 1900, 2800],
  [800, 1600, 2400, 3600], [1000, 2000, 3000, 4500], [1100, 2200, 3400, 5100], [1250, 2500, 3800, 5700], [1400, 2800, 4300, 6400], [1600, 3200, 4800, 7200], [2000, 3900, 5900, 8800], [2100, 4200, 6300, 9500], [2400, 4900, 7300, 10900], [2800, 5700, 8500, 12700]];
const MULTS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];
const DIFF = { trivial: ["Trivial", "#6b6b6b"], easy: ["Easy", "#2f7d4a"], medium: ["Medium", "#b8901a"], hard: ["Hard", "#c25b0e"], deadly: ["Deadly", "#a31f1f"] };
function monCr(sm) { const e = monEntry(sm); return String(sm.custom?.cr || e?.cr || "").trim(); }
function monXp(sm) { return XP_BY_CR[monCr(sm)] ?? 0; }
function party() { const p = S.scen.party ||= { size: 4, level: 3 }; return { size: Math.max(1, +p.size || 4), level: Math.max(1, Math.min(20, +p.level || 1)) }; }
function encounterOf(nd) { return (nd.monsters || []).map(x => ({ sm: S.scen.monsters.find(m => m.id === x.id), n: Math.max(0, +x.n || 0) })).filter(x => x.sm && x.n > 0); }
function difficulty(enc) {
  if (!enc.length) return null;
  const { size, level } = party();
  const base = enc.reduce((t, x) => t + monXp(x.sm) * x.n, 0), count = enc.reduce((t, x) => t + x.n, 0);
  let mi = count === 1 ? 1 : count === 2 ? 2 : count <= 6 ? 3 : count <= 10 ? 4 : count <= 14 ? 5 : 6;
  if (size < 3) mi += 1; else if (size >= 6) mi -= 1;
  const mult = MULTS[Math.max(0, Math.min(MULTS.length - 1, mi))], adj = Math.round(base * mult);
  const t = THRESH[level].map(v => v * size);
  const key = adj >= t[3] ? "deadly" : adj >= t[2] ? "hard" : adj >= t[1] ? "medium" : adj >= t[0] ? "easy" : "trivial";
  const unknown = enc.some(x => !(monCr(x.sm) in XP_BY_CR));
  return { base, adj, mult, count, key, t, unknown };
}
function diffBadge(d, long) {
  if (!d) return "";
  const [l, c] = DIFF[d.key];
  return `<span class="chip" style="background:${c};color:#fff" title="${d.base} XP × ${d.mult} = ${d.adj} adjusted XP · party thresholds easy ${d.t[0]} / medium ${d.t[1]} / hard ${d.t[2]} / deadly ${d.t[3]}">⚔ ${l}${long ? ` · ${d.base} XP (adj. ${d.adj})` : ""}${d.unknown ? " ?" : ""}</span>`;
}
// NPC names (and aliases) in text become links
function npcLinks(html) {
  const npcs = (S.scen?.npcs || []).flatMap(n => [n.name, ...String(n.aliases || "").split(",")].map(x => x.trim()).filter(x => x.length > 1).map(x => [x, n.id]));
  if (!npcs.length) return html;
  npcs.sort((a, b) => b[0].length - a[0].length);
  const map = {}; npcs.forEach(([k, id]) => map[k.toLowerCase()] ||= id);
  const rx = new RegExp("\\b(" + npcs.map(([k]) => esc(k).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\b", "gi");
  return html.split(/(<[^>]+>)/).map(part => part.startsWith("<") ? part : part.replace(rx, m => `<a href="#" class="npclink" data-act="npcPeek" data-id="${map[m.toLowerCase()]}">${m}</a>`)).join("");
}
function richText(t) { return npcLinks(para(t)); }
function migrateScen(sc) {
  sc.npcs ||= []; sc.secrets ||= []; sc.party ||= { size: 4, level: 3 };
  sc.nodes.forEach(nd => { nd.monsters = (nd.monsters || []).map(x => typeof x === "string" ? { id: x, n: (sc.monsters.find(m => m.id === x)?.count) || 1 } : x); });
  return sc;
}
function monKey(m) { return m.slug + "|" + m.ed; }
function monEntry(sm) { return sm.ref ? S.mon.byKey[sm.ref] : null; }
function monName(sm) { return sm.name || monEntry(sm)?.name || "Monster"; }
function monHp(sm) { const e = monEntry(sm); const v = sm.custom?.hp || e?.hp || ""; const n = parseInt(String(v)); return isNaN(n) ? null : n; }
function monSize(sm) { const e = monEntry(sm); const s = norm(sm.custom?.size || e?.size || "medium").split(" ")[0]; return SIZE_CELLS[s] || 1; }

// ---------- saving ----------
// everything is stored on this device (dmstore.js); dm.py on the laptop gets a copy in its folders
let saveT = null, saveW = null, pendingScen = null, pendingWorld = null;
function save() {
  if (isWorld()) { if (!S.world) return; pendingWorld = S.world; clearTimeout(saveW); saveW = setTimeout(flushSave, 500); return; }
  if (!S.scen) return; S.scen.updated = Date.now();
  const sc = S.scen;
  sc.summary = `${sc.nodes.length} nodes · ${sc.battlemaps.length} battlemaps · ${sc.monsters.length} monsters`;
  pendingScen = sc; clearTimeout(saveT); saveT = setTimeout(flushSave, 500);
}
async function flushSave() {
  clearTimeout(saveT); clearTimeout(saveW);
  const sc = pendingScen, w = pendingWorld; pendingScen = pendingWorld = null;
  if (sc) await Store.put(sc);
  if (w) await Store.putWorld(w);
}
async function loadList() { S.list = await Store.list(); }
async function loadWorld() { S.world = await Store.getWorld(); }
async function loadMonsters() {
  S.mon = await Store.getMon(); S.mon.byKey = {};
  (S.mon.list || []).forEach(m => S.mon.byKey[monKey(m)] = m);
  SB_CACHE.clear();
}
function monImgSrc(sm) { const e = monEntry(sm); if (!e?.img) return ""; return S.server ? "api/mimg?k=" + encodeURIComponent(sm.ref) : e.img; }

// ---------- render ----------
function render() { keepScroll(renderInner); }
function renderInner() {
  const nav = $("#topnav");
  nav.innerHTML = S.scen ? `<span class="muted small" style="align-self:center">${esc(S.scen.name)}</span>` : "";
  $("#main").innerHTML = S.view === "home" ? vHome() : vScenario();
  renderModal();
  if (typeof Dice !== "undefined") Dice.sync();
  afterRender();
}
function renderModal() {
  const bg = $("#modal"), box = $("#modal-box");
  if (!S.modal) { bg.classList.add("hidden"); return; }
  bg.classList.remove("hidden");
  keepScroll(() => { box.innerHTML = { qr: mQR, custom: mCustom, npc: mNpc }[S.modal.type](); });
}
// map views need real sizes -> set up after DOM is there
function afterRender() {
  const ov = $("#ovmap");   if (ov && doc()?.map) { if (S.ui.ovZ == null) S.ui.ovZ = MapView.fitZoom(ov, doc().map); drawOverview(); }
  const bm = $("#bmmap"); const m = curMap(); if (bm && m) { if (S.ui.bmZ == null) S.ui.bmZ = MapView.fitZoom(bm, m); drawBattlemap(); }
}

// ---------- HOME ----------
function vHome() {
  const n = (S.mon.list || []).length, imp = S.ui.imp || {};
  return `<div class="card"><div class="row"><h2 style="margin:0">Scenarios</h2>
      <input id="newname" placeholder="Name, e.g. Dwarven Forge" style="flex:1;min-width:180px"><button data-act="newScen">+ New scenario</button><button class="ghost" data-act="importScen">⤒ Import</button></div></div>
    <div class="chars">${S.list.map(s => `<div class="card charcard" data-act="openScen" data-id="${esc(s.id)}">${s.thumb ? `<img src="${s.thumb}">` : `<div class="ph">🗺</div>`}
      <div class="grow"><b>${esc(s.name)}</b>${s.subtitle ? `<div class="scsub">${esc(s.subtitle)}</div>` : ""}<div class="muted small">${esc(s.summary || "")}</div></div></div>`).join("") || '<p class="muted">No scenarios yet.</p>'}</div>
    <h2 style="margin:22px 0 10px">🌍 World map</h2>${vNodeMap()}
    <div class="card" style="margin-top:20px"><h3>Monster compendium</h3>
      <p>${n ? `<b>${n}</b> monsters from ${esc(S.mon.source || "aidedd.org")} (imported ${esc(S.mon.imported || "?")}).` : "No monsters on this device yet."} You can always add custom monsters by hand.</p>
      ${S.server ? (imp.running ? `<div class="progress"><div style="width:${imp.total ? Math.round(100 * imp.done / imp.total) : 3}%"></div></div><p class="small muted">${esc(imp.msg)} (${imp.done}/${imp.total})</p>`
        : `<div class="row"><button data-act="impMon">${n ? "Update" : "Import"} monsters from aidedd.org</button><label class="small"><input type="checkbox" id="imp2014"> also older 2014 monsters (slower)</label><label class="small"><input type="checkbox" id="impImg"> download all images now (for offline use; otherwise they load when first opened)</label></div>`)
        : `<p class="small muted">The import runs on the laptop (DM Tool started with start-dm). From there the monsters come to this device via <b>Google Drive sync</b>, or load a <code>monsters.json</code> file with <b>⤒ Import</b> at the top.</p>`}
      ${imp.error ? `<p class="warn">${esc(imp.error)}</p>` : ""}</div>
    ${vSyncCard()}
    ${S.server ? `<div class="card"><h3>Playing without internet</h3><p class="small">Turn on your laptop's <b>mobile hotspot</b> (Windows: Settings → Network &amp; internet → Mobile hotspot) and let players join it — no internet needed. Then open a battlemap and press <b>📡 Share with players</b>: they scan the QR code. If Windows asks about the firewall for Python, allow <b>private networks</b>.</p></div>` : ""}
    <p class="small muted" style="text-align:center">DM Tool ${APP_VERSION} · ${S.server ? "running on this laptop" : "app on this device"}</p>`;
}
function vSyncCard() {
  const on = Sync.enabled(), cid = Sync.clientId();
  return `<div class="card"><h3>Devices &amp; sync</h3>
    <p class="small">Everything is saved on this device${S.server ? " and in the laptop's <code>scenarios</code> folder" : ""}. <b>Google Drive sync</b> keeps laptop and phone in step: scenarios, the world map and the monster compendium (in a hidden app folder, the same one the Character Builder uses).</p>
    ${on ? `<div class="row"><span>☁ Connected — ${esc(Sync.msg || Sync.status)}</span><button class="small" data-act="syncNow">Sync now</button><button class="small ghost" data-act="syncOff">Disconnect</button></div>`
      : `<div class="row">${window.GOOGLE_CLIENT_ID ? "" : `<input id="clientId" placeholder="Google OAuth Client ID (same as the Character Builder)" value="${esc(cid)}" style="flex:1;min-width:220px">`}<button data-act="syncConnect">☁ Connect Google Drive</button></div>
        ${S.server ? `<p class="small muted">On the laptop, the Google Client ID must allow <code>${esc(location.origin)}</code> (Google Cloud → Credentials → your client → Authorized JavaScript origins).</p>` : ""}`}
    <div class="row" style="margin-top:8px"><button class="small" data-act="exportAll">⤓ Backup everything (one file)</button>${(S.mon.list || []).length ? `<button class="small ghost" data-act="exportMon">⤓ Monster file</button>` : ""}<span class="small muted">Scenarios, world map and monsters. Open it on the other device with <b>⤒ Import</b> (at the top): only newer versions replace what's there.</span></div></div>`;
}

// ---------- SCENARIO ----------
const TABS = [["overview", "🗺 Overview & nodes"], ["maps", "⚔ Battlemaps"], ["monsters", "👹 Monsters"], ["npcs", "🙂 NPCs"], ["notes", "📜 Secrets & notes"]];
function vScenario() {
  const sc = S.scen;
  const body = { overview: vNodeMap, maps: vMaps, monsters: vMonsters, npcs: vNpcs, notes: vNotes }[S.tab]();
  return `<div class="card"><div class="row">${inp("name", sc.name, { style: "font-size:20px;font-weight:800;flex:1;min-width:200px" })}
      <button class="ghost" data-act="exportScen">⤓ Export</button><button class="ghost danger" data-act="delScen" style="color:#fff">🗑</button></div>
      <div style="margin-top:6px">${inp("subtitle", sc.subtitle || "", { ph: "Subtitle: one or two sentences about the adventure (shown on the start page)", style: "width:100%;font-style:italic" })}</div>
      <div class="row small" style="margin-top:8px"><button class="small ${S.ui.synOpen ? "" : "ghost"}" data-act="synTog">📖 Synopsis ${S.ui.synOpen ? "▾" : "▸"}</button><b>Party:</b><label>${inp("party.size", party().size, { type: "number", style: "width:56px", attr: 'min="1" max="10"' })} players</label><label>level ${inp("party.level", party().level, { type: "number", style: "width:56px", attr: 'min="1" max="20"' })}</label>
        <span class="muted">used for the encounter difficulty (DMG XP thresholds, like donjon's calculator)</span></div>
      ${S.ui.synOpen ? ((S.ui.editSyn || !sc.synopsis) ? `<textarea data-live="synopsis" style="min-height:160px;margin-top:8px" placeholder="Synopsis: what the adventure is about, the hook, the villain's plan, how it might end… NPC names become links.">${esc(sc.synopsis || "")}</textarea><div><button class="small ghost" data-act="synEdit">✔ Done</button></div>`
        : `<div class="desc readtext" style="margin-top:8px">${richText(sc.synopsis)}</div><div><button class="small ghost" data-act="synEdit">✎ Edit</button></div>`) : ""}</div>
    <div class="dmtabs">${TABS.map(([k, l]) => `<button class="${S.tab === k ? "on" : ""}" data-act="tab" data-k="${k}">${l}</button>`).join("")}</div>${body}`;
}

// ----- overview: dungeon map + nodes -----
function vNodeMap() {
  const sc = doc(), w = isWorld();
  const nodes = sc.nodes.slice().sort((a, b) => a.n - b.n);
  const lk = w ? "wList" : "nList", listOpen = S.ui[lk] !== false;
  let h = `<div class="card">`;
  if (!sc.map) h += w ? `<p>Add a map of your world. Then click on it to place numbered nodes (cities, dungeons, regions…) and link them to your scenarios.</p><button data-act="setOvMap">🖼 Add world map image</button>`
    : `<p>Add the overview map of your dungeon, town or region. Then click on it to place numbered nodes (rooms, traps, secrets…).</p><button data-act="setOvMap">🖼 Add map image</button>`;
  else h += `<div class="row" style="margin-bottom:8px"><button class="${S.ui.placing ? "" : "ghost"}" data-act="togglePlace">${S.ui.placing ? "✔ Click the map to place nodes (click here to stop)" : "➕ Place nodes"}</button>
      <button class="ghost small" data-act="ovZoom" data-d="0.8">−</button><button class="ghost small" data-act="ovZoom" data-d="fit">Fit</button><button class="ghost small" data-act="ovZoom" data-d="1.25">+</button>
      <button class="ghost small right" data-act="setOvMap">Replace image</button></div>
    <div id="ovmap" class="mapbox ${S.ui.placing ? "placing" : ""}" data-sk="ov"></div><p class="small muted" style="margin:6px 0 0">Click a node to read it right there · drag a node to move it.</p>`;
  h += `</div><div class="card nodelist"><h3 data-act="listTog" data-k="${lk}" style="cursor:pointer;margin:0">${listOpen ? "▾" : "▸"} Nodes (${nodes.length})</h3>
    ${listOpen ? `<div style="margin-top:8px">${nodes.map(w ? worldNodeRow : nodeRow).join("") || '<p class="muted small">No nodes yet.</p>'}</div>` : ""}</div>`;
  return h;
}
function nodeRow(nd) {
  const sc = S.scen, t = NODE_TYPES[nd.type] || NODE_TYPES.other, open = S.ui.openNode === nd.id, i = sc.nodes.indexOf(nd);
  const enc = encounterOf(nd), d = difficulty(enc);
  const bm = sc.battlemaps.find(b => b.id === nd.battlemap);
  const npcsHere = (sc.npcs || []).filter(n => n.node === nd.id);
  const editing = S.ui.editNode === nd.id || !nd.text;
  return `<div class="nrow" id="node-${nd.id}"><div class="nhead" data-act="openNode" data-id="${nd.id}"><span class="nbadge" style="background:${t[1]}">${nd.n}</span><b style="flex:1">${esc(nd.title || "Untitled")}</b>
    <span class="chip">${t[2]} ${t[0]}</span>${enc.length ? `<span class="chip">👹 ${enc.reduce((a, x) => a + x.n, 0)}</span>` : ""}${diffBadge(d)}${npcsHere.length ? `<span class="chip">🙂 ${npcsHere.length}</span>` : ""}${bm ? `<span class="chip">⚔ map</span>` : ""}<span class="muted">${open ? "▾" : "▸"}</span></div>
    ${open ? `<div class="nbody">
      <div class="row">${inp(`nodes.${i}.title`, nd.title, { ph: "Title, e.g. Throne room", style: "flex:1" })}${sel(`nodes.${i}.type`, nd.type, Object.entries(NODE_TYPES).map(([k, v]) => [k, v[2] + " " + v[0]]))}</div>
      ${editing ? `<textarea data-live="nodes.${i}.text" placeholder="Read-aloud text, description, secrets, clues, trap details… NPC names become links." style="min-height:120px">${esc(nd.text || "")}</textarea><div><button class="small ghost" data-act="editNode" data-id="">✔ Done</button></div>`
        : `<div class="desc readtext">${richText(nd.text)}</div><div><button class="small ghost" data-act="editNode" data-id="${nd.id}">✎ Edit text</button></div>`}
      ${npcsHere.length ? `<div class="row small"><b>NPCs here:</b>${npcsHere.map(n => `<a href="#" class="npclink" data-act="npcPeek" data-id="${n.id}">${esc(n.name)}</a>`).join(", ")}</div>` : ""}
      <div class="encbox"><div class="row small"><b>Encounter</b>${diffBadge(d, true)}<span class="muted">party: ${party().size} × level ${party().level}</span></div>
        ${enc.map(x => `<div class="encrow"><b style="flex:1">${esc(monName(x.sm))}</b><span class="small muted">CR ${esc(monCr(x.sm) || "?")} · ${monXp(x.sm)} XP</span>
          <button class="small ghost" data-act="encN" data-n="${nd.id}" data-m="${x.sm.id}" data-d="-1">−</button><b>${x.n}</b><button class="small ghost" data-act="encN" data-n="${nd.id}" data-m="${x.sm.id}" data-d="1">+</button>
          <a href="#" data-act="encDel" data-n="${nd.id}" data-m="${x.sm.id}">✕</a></div>`).join("")}
        ${sc.monsters.length ? `<select data-act="encAdd" data-n="${nd.id}"><option value="">+ add monster to this encounter…</option>${sc.monsters.map(m => `<option value="${m.id}">${esc(monName(m))}${m.group ? " (" + esc(m.group) + ")" : ""} · CR ${esc(monCr(m) || "?")}</option>`).join("")}</select>` : '<span class="small muted">Pick the monsters for this scenario in the Monsters tab first.</span>'}
        ${enc.length ? `<div>${enc.map(x => `<details><summary class="small">${esc(monName(x.sm))} — stat block</summary>${statBlock(x.sm)}</details>`).join("")}</div>` : ""}</div>
      <div class="row small"><b>Battlemap:</b>${sel(`nodes.${i}.battlemap`, nd.battlemap || "", sc.battlemaps.map(b => [b.id, b.name]), { blank: "— none —" })}${bm ? `<button class="small" data-act="openMap" data-id="${bm.id}">Open battlemap</button>` : ""}
        <button class="small ghost right" data-act="delNode" data-id="${nd.id}">🗑 Delete node</button></div></div>` : ""}</div>`;
}
function worldNodeRow(nd) {
  const w = S.world, t = WORLD_TYPES[nd.type] || WORLD_TYPES.other, open = S.ui.openNode === nd.id, i = w.nodes.indexOf(nd);
  const scen = S.list.find(s => s.id === nd.scen), editing = S.ui.editNode === nd.id || !nd.text;
  return `<div class="nrow" id="node-${nd.id}"><div class="nhead" data-act="openNode" data-id="${nd.id}"><span class="nbadge" style="background:${t[1]}">${nd.n}</span><b style="flex:1">${esc(nd.title || "Untitled")}</b>
    <span class="chip">${t[2]} ${t[0]}</span>${scen ? `<span class="chip">📜 ${esc(scen.name)}</span>` : ""}<span class="muted">${open ? "▾" : "▸"}</span></div>
    ${open ? `<div class="nbody">
      <div class="row">${inp(`nodes.${i}.title`, nd.title, { ph: "Name, e.g. Ironhold", style: "flex:1" })}${sel(`nodes.${i}.type`, nd.type, Object.entries(WORLD_TYPES).map(([k, v]) => [k, v[2] + " " + v[0]]))}</div>
      ${editing ? `<textarea data-live="nodes.${i}.text" placeholder="Description, rulers, rumours, history…" style="min-height:120px">${esc(nd.text || "")}</textarea><div><button class="small ghost" data-act="editNode" data-id="">✔ Done</button></div>`
        : `<div class="desc readtext">${richText(nd.text)}</div><div><button class="small ghost" data-act="editNode" data-id="${nd.id}">✎ Edit text</button></div>`}
      <div class="row small"><b>Scenario here:</b>${sel(`nodes.${i}.scen`, nd.scen || "", S.list.map(s => [s.id, s.name]), { blank: "— none —" })}${scen ? `<button class="small" data-act="openScen" data-id="${esc(scen.id)}">Open scenario</button>` : ""}
        <button class="small ghost right" data-act="delNode" data-id="${nd.id}">🗑 Delete node</button></div></div>` : ""}</div>`;
}
// node popup: opens right at the node on the map
function nodePopup(nd) {
  const t = types()[nd.type] || types().other, w = isWorld();
  let extra = "";
  if (w) { const sc = S.list.find(s => s.id === nd.scen); if (sc) extra = `<div class="popscen" data-act="openScen" data-id="${esc(sc.id)}">${sc.thumb ? `<img src="${sc.thumb}">` : ""}<div><b>📜 ${esc(sc.name)}</b>${sc.subtitle ? `<div class="small">${esc(sc.subtitle)}</div>` : ""}<div class="small accent">Open scenario →</div></div></div>`; }
  else {
    const enc = encounterOf(nd), npcs = (S.scen.npcs || []).filter(n => n.node === nd.id), bm = S.scen.battlemaps.find(b => b.id === nd.battlemap);
    if (enc.length) extra += `<div class="small" style="margin-top:6px"><b>Encounter:</b> ${enc.map(x => x.n + "× " + esc(monName(x.sm))).join(", ")} ${diffBadge(difficulty(enc))}</div>`;
    if (npcs.length) extra += `<div class="small" style="margin-top:4px"><b>NPCs:</b> ${npcs.map(n => `<a href="#" class="npclink" data-act="npcPeek" data-id="${n.id}">${esc(n.name)}</a>`).join(", ")}</div>`;
    if (bm) extra += `<div style="margin-top:6px"><button class="small" data-act="openMap" data-id="${bm.id}">⚔ Open battlemap</button></div>`;
  }
  const cls = (nd.x > 0.6 ? " left" : "") + (nd.y > 0.55 ? " up" : "");
  return `<div class="npop${cls}" style="left:${nd.x * 100}%;top:${nd.y * 100}%"><div class="npop-h"><span class="nbadge" style="background:${t[1]}">${nd.n}</span><b class="grow">${esc(nd.title || "Untitled")}</b><span class="chip">${t[2]} ${t[0]}</span><a href="#" data-act="popClose" title="Close">✕</a></div>
    <div class="npop-b">${nd.text ? richText(nd.text) : '<span class="muted small">No description yet.</span>'}${extra}</div>
    <div class="npop-f"><button class="small ghost" data-act="popEdit" data-id="${nd.id}">✎ Edit in list</button></div></div>`;
}
function drawOverview() {
  const host = $("#ovmap"), d = doc(), m = d.map, z = S.ui.ovZ, T = types();
  const pop = d.nodes.find(nd => nd.id === S.ui.popNode);
  host.innerHTML = `<div class="mv-layer" style="width:${m.w * z}px;height:${m.h * z}px"><img src="${m.image}" draggable="false" alt="">
    ${d.nodes.map(nd => { const t = T[nd.type] || T.other; return `<div class="node ${S.ui.popNode === nd.id || S.ui.openNode === nd.id ? "open" : ""}" data-node="${nd.id}" title="${esc(nd.title || "")}" style="left:${nd.x * 100}%;top:${nd.y * 100}%;background:${t[1]}">${nd.n}</div>`; }).join("")}
    ${pop ? nodePopup(pop) : ""}</div>`;
}
function bindOverview() {
  let drag = null;
  document.addEventListener("pointerdown", e => {
    const host = e.target.closest("#ovmap"); if (!host || e.target.closest(".npop")) return;
    const nodeEl = e.target.closest(".node");
    if (nodeEl) { e.preventDefault(); nodeEl.setPointerCapture(e.pointerId); drag = { el: nodeEl, id: nodeEl.dataset.node, sx: e.clientX, sy: e.clientY, moved: false }; return; }
    if (S.ui.placing && e.target.closest(".mv-layer")) {
      const r = host.querySelector(".mv-layer").getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      const d = doc(), n = Math.max(0, ...d.nodes.map(k => k.n)) + 1;
      const nd = isWorld() ? { id: uid(), n, x, y, title: "Place " + n, type: "city", text: "", scen: "" } : { id: uid(), n, x, y, title: "Node " + n, type: "room", text: "", monsters: [] };
      d.nodes.push(nd); S.ui.openNode = nd.id; S.ui.popNode = null; save(); render();
    }
  });
  document.addEventListener("pointermove", e => {
    if (!drag) return; if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 4) drag.moved = true;
    if (!drag.moved) return; const r = $("#ovmap .mv-layer").getBoundingClientRect();
    drag.el.style.left = ((e.clientX - r.left) / r.width * 100) + "%"; drag.el.style.top = ((e.clientY - r.top) / r.height * 100) + "%";
  });
  document.addEventListener("pointerup", e => {
    if (!drag) return; const d = drag; drag = null; const nd = doc()?.nodes.find(k => k.id === d.id); if (!nd) return;
    if (d.moved) { const r = $("#ovmap .mv-layer").getBoundingClientRect(); nd.x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); nd.y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)); save(); drawOverview(); }
    else { S.ui.popNode = S.ui.popNode === nd.id ? null : nd.id; drawOverview(); }
  });
}

// ----- battlemaps -----
function freeCell(m, size, fromRight) {
  const cols = +m.grid.cols, rows = +m.grid.rows, occ = new Set();
  m.tokens.forEach(t => { const s = +t.size || 1; for (let dx = 0; dx < s; dx++) for (let dy = 0; dy < s; dy++) occ.add((t.x + dx) + "," + (t.y + dy)); });
  for (let y = 0; y <= rows - size; y++) for (let i = 0; i <= cols - size; i++) {
    const x = fromRight ? cols - size - i : i; let ok = true;
    for (let dx = 0; dx < size && ok; dx++) for (let dy = 0; dy < size && ok; dy++) if (occ.has((x + dx) + "," + (y + dy))) ok = false;
    if (ok) return { x, y };
  }
  return { x: 0, y: 0 };
}
function curMap() { return S.scen && S.mapId ? S.scen.battlemaps.find(b => b.id === S.mapId) : null; }
function vMaps() {
  const sc = S.scen, m = curMap();
  if (!m) return `<div class="card"><div class="row"><h3 style="margin:0">Battlemaps</h3><button class="right" data-act="addMap">+ Add battlemap image</button></div></div>
    <div class="mapcards">${sc.battlemaps.map(b => { const linked = sc.nodes.filter(nd => nd.battlemap === b.id); return `<div class="card mapcard" data-act="openMap" data-id="${b.id}" style="cursor:pointer"><img src="${b.thumb || b.image}"><b>${esc(b.name)}</b>
      <div class="small muted">${b.grid.cols}×${b.grid.rows} grid · ${b.tokens.length} tokens${linked.length ? " · nodes " + linked.map(n => "#" + n.n).join(", ") : ""}</div>${S.live && S.live.mapId === b.id ? '<div class="small"><span class="livedot"></span>shared with players</div>' : ""}</div>`; }).join("") || '<p class="muted">No battlemaps yet.</p>'}</div>`;
  const i = sc.battlemaps.indexOf(m), g = m.grid, live = S.live && S.live.mapId === m.id;
  const players = m.tokens.filter(t => t.kind !== "monster"), mons = m.tokens.filter(t => t.kind === "monster");
  const tokRow = t => { const k = m.tokens.indexOf(t);
    return `<div class="tokrow ${S.ui.selTok === t.id ? "sel" : ""}"><input type="color" value="${t.color}" data-path="battlemaps.${i}.tokens.${k}.color" style="width:26px">${inp(`battlemaps.${i}.tokens.${k}.name`, t.name)}
      ${sel(`battlemaps.${i}.tokens.${k}.size`, t.size || 1, [[1, "1×1"], [2, "2×2"], [3, "3×3"], [4, "4×4"]], { attr: "data-num" })}
      ${t.kind === "monster" ? `<button class="small ghost" data-act="tokHide" data-id="${t.id}" title="Hidden from players?">${t.hidden ? "🙈 hidden" : "👁 visible"}</button>
        <span class="small">HP <button class="small ghost" data-act="tokHp" data-id="${t.id}" data-d="-1">−</button><input type="number" data-path="battlemaps.${i}.tokens.${k}.hp" data-num value="${t.hp ?? ""}" style="width:52px">/${t.maxHp ?? "?"}<button class="small ghost" data-act="tokHp" data-id="${t.id}" data-d="1">+</button></span>` : ""}
      <a href="#" class="right" data-act="tokDel" data-id="${t.id}">✕</a></div>`; };
  return `<div class="row" style="margin-bottom:8px"><button class="ghost" data-act="closeMap">← All battlemaps</button>${inp(`battlemaps.${i}.name`, m.name, { style: "font-weight:700;flex:1" })}
      ${!S.server ? `<span class="small muted" title="Sharing the map with players needs the DM Tool running on the laptop">📡 share: laptop only</span>` : live ? `<span><span class="livedot"></span><b>Live</b></span><button data-act="showQR">📱 QR code</button><button class="ghost" data-act="stopShare">■ Stop sharing</button>` : `<button data-act="share">📡 Share with players</button>`}</div>
    <div class="mapedit"><div><div class="row small" style="margin-bottom:6px"><button class="ghost small" data-act="bmZoom" data-d="0.8">−</button><button class="ghost small" data-act="bmZoom" data-d="fit">Fit</button><button class="ghost small" data-act="bmZoom" data-d="1.25">+</button>
        <span class="muted">Drag tokens to move them (they snap to the grid).</span></div><div id="bmmap" class="mapbox" data-sk="bm"></div></div>
      <div><div class="card"><h3>Grid</h3>
        <div class="row small"><label>Cells across ${inp(`battlemaps.${i}.grid.cols`, +g.cols, { type: "number", style: "width:64px" })}</label><label>Cells down ${inp(`battlemaps.${i}.grid.rows`, +g.rows, { type: "number", style: "width:64px" })}</label>
          <button class="ghost small" data-act="squareRows">square cells</button></div>
        <div class="row small" style="margin-top:6px"><label>Shift x ${inp(`battlemaps.${i}.grid.ox`, +g.ox || 0, { type: "number", style: "width:60px", attr: 'step="0.5"' })}</label><label>y ${inp(`battlemaps.${i}.grid.oy`, +g.oy || 0, { type: "number", style: "width:60px", attr: 'step="0.5"' })}</label></div>
        <div class="row small" style="margin-top:6px"><label><input type="checkbox" data-path="battlemaps.${i}.grid.show" ${g.show !== false ? "checked" : ""}> show grid</label>
          <label>color <input type="color" data-path="battlemaps.${i}.grid.color" value="${g.color || "#000000"}" style="width:30px"></label>
          <label>opacity ${sel(`battlemaps.${i}.grid.opacity`, g.opacity ?? 0.35, [[0.15, "15%"], [0.25, "25%"], [0.35, "35%"], [0.5, "50%"], [0.7, "70%"], [1, "100%"]], { attr: "data-num" })}</label></div>
        <p class="small muted" style="margin:6px 0 0">Image ${m.w}×${m.h}px → cell ${(m.w / g.cols).toFixed(1)}×${(m.h / g.rows).toFixed(1)}px</p></div>
      <div class="card"><h3>Players</h3>${players.map(tokRow).join("") || '<p class="small muted">none</p>'}
        <div class="row small" style="margin-top:6px"><input id="newPlayer" placeholder="Player / character name" style="flex:1"><button class="small" data-act="addPlayer">+ Add</button></div></div>
      <div class="card"><h3>Monsters</h3>${(() => { const nd = S.scen.nodes.find(n => n.battlemap === m.id); const enc = nd ? encounterOf(nd) : [];
          return enc.length ? `<div class="row small" style="margin-bottom:6px"><button class="small" data-act="addEncTok">+ Add encounter of #${nd.n}: ${enc.map(x => x.n + "× " + esc(monName(x.sm))).join(", ")}</button>${diffBadge(difficulty(enc))}</div>` : ""; })()}
        ${mons.map(tokRow).join("") || '<p class="small muted">none</p>'}
        <div class="row small" style="margin-top:6px">${S.scen.monsters.length ? `<select id="newMonTok" style="flex:1">${S.scen.monsters.map(sm => `<option value="${sm.id}">${esc(monName(sm))}</option>`).join("")}</select><label>× <input type="number" id="newMonN" value="1" min="1" style="width:46px"></label><button class="small" data-act="addMonTok">+ Add</button>`
          : '<span class="muted">Add monsters to the scenario first (Monsters tab).</span>'}</div>
        <p class="small muted" style="margin:6px 0 0">New monster tokens start <b>hidden</b> from players — reveal them with 👁.</p></div>
      <div class="card"><button class="ghost small danger" style="color:#fff" data-act="delMap">🗑 Delete battlemap</button></div></div></div>`;
}
function drawBattlemap() {
  const m = curMap(), host = $("#bmmap"); if (!m || !host) return;
  host.innerHTML = MapView.html(m, S.ui.bmZ, { dm: true, sel: S.ui.selTok });
}

// live sharing (DM side)
async function pushTable(full) {
  if (!S.server) return;
  const m = curMap() || (S.live && S.scen.battlemaps.find(b => b.id === S.live.mapId)); if (!m || !S.live) return;
  if (S.live.mapId !== m.id) return;
  const body = { name: m.name, grid: m.grid, tokens: m.tokens };
  if (full) Object.assign(body, { image: m.image, w: m.w, h: m.h, scenarioId: S.scen.id, mapId: m.id });
  await api(full ? "api/table/host" : "api/table/update", { method: "POST", body });
}
async function dmPoll() {
  let rev = -1;
  for (;;) {
    try {
      const s = await api(`api/table?dm=1&rev=${rev}&img=skip`);
      rev = s.rev;
      if (s.active && S.scen && s.scenarioId === S.scen.id) {
        S.live = { mapId: s.mapId };
        const m = S.scen.battlemaps.find(b => b.id === s.mapId);
        if (m && !S.ui.dragging) {
          let changed = false;
          for (const t of s.tokens) { const mine = m.tokens.find(k => k.id === t.id); if (mine && (mine.x !== t.x || mine.y !== t.y)) { mine.x = t.x; mine.y = t.y; changed = true; } }
          if (changed) { save(); if (S.mapId === m.id) drawBattlemap(); }
        }
      } else if (!s.active) S.live = null;
    } catch (e) { await new Promise(r => setTimeout(r, 2000)); }
  }
}

// ----- monsters -----
function linkifyHtml(html, title) {
  const tpl = document.createElement("template"); tpl.innerHTML = html;
  const walker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT); const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(n => { const out = sbLinks(esc(n.nodeValue), title); if (out !== esc(n.nodeValue)) { const span = document.createElement("span"); span.innerHTML = out; n.replaceWith(...span.childNodes); } });
  return tpl.innerHTML;
}
// ----- stat block clean-up: rebuild the AC/HP/Speed lines and the ability scores from the text,
// whatever markup the source page used (aidedd's 2024 pages build them from layout elements) -----
const AB_KEYS = ["str", "dex", "con", "int", "wis", "cha"];
function spacedText(n) {   // text with spaces between elements, so <div>Str</div><div>15</div> reads "Str 15"
  if (n.nodeType === 3) return n.nodeValue;
  if (n.nodeType !== 1 && n.nodeType !== 11) return "";
  let t = ""; n.childNodes.forEach(c => { t += " " + spacedText(c) + " "; }); return t;
}
const SIGN = "[+\\-−–]\\s?\\d+";
function abParse(text) {
  const t = text.replace(/\s+/g, " "), out = {};
  const re24 = new RegExp(`\\b(Str|Dex|Con|Int|Wis|Cha)\\s+(\\d{1,2})\\s+(${SIGN})\\s+(${SIGN})`, "gi");
  const re14 = new RegExp(`\\b(Str|Dex|Con|Int|Wis|Cha)\\s+(\\d{1,2})\\s*\\(\\s*(${SIGN})\\s*\\)`, "gi");
  let m, ed = null;
  while ((m = re24.exec(t))) { const k = m[1].toLowerCase(); out[k] ||= { s: m[2], mod: m[3].replace(/\s/g, "").replace(/[−–]/, "-"), save: m[4].replace(/\s/g, "").replace(/[−–]/, "-") }; ed = "24"; }
  if (!AB_KEYS.every(k => out[k])) { for (const k in out) delete out[k]; ed = "14";
    while ((m = re14.exec(t))) { const k = m[1].toLowerCase(); out[k] ||= { s: m[2], mod: m[3].replace(/\s/g, "").replace(/[−–]/, "-") }; } }
  return AB_KEYS.every(k => out[k]) ? { ab: out, ed } : null;
}
function abHtml(p) {
  const L = k => k.charAt(0).toUpperCase() + k.slice(1);
  if (p.ed === "14") return `<div class="abil14">${AB_KEYS.map(k => `<div class="carac"><strong>${k.toUpperCase()}</strong><br>${p.ab[k].s} (${p.ab[k].mod})</div>`).join("")}</div>`;
  const cell = k => `<th class="${k}">${L(k)}</th><td class="sc ${k}">${p.ab[k].s}</td><td class="md ${k}">${p.ab[k].mod}</td><td class="md ${k}">${p.ab[k].save}</td>`;
  // three small blocks (Str+Int, Dex+Wis, Con+Cha) side by side, wrapping on narrow screens
  return `<div class="abil24w">${[["str", "int"], ["dex", "wis"], ["con", "cha"]].map(([a, b]) => `<table class="abil24"><tr><th></th><th></th><th class="h">MOD</th><th class="h">SAVE</th></tr><tr>${cell(a)}</tr><tr>${cell(b)}</tr></table>`).join("")}</div>`;
}
const HEAD_RE = /\b(Armor Class|Initiative|Hit Points|AC|HP|Speed)\b/;
function headHtml(text) {
  const parts = text.replace(/\s+/g, " ").split(HEAD_RE), f = {}, other = [];
  if (parts[0].replace(/\b(MOD|SAVE)\b/gi, "").trim().length > 2) other.push(parts[0].trim());
  for (let i = 1; i < parts.length; i += 2) {
    const v = parts[i + 1].replace(/(\s*\b(MOD|SAVE)\b)+\s*$/i, "").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").replace(/\s+([,;.])/g, "$1").trim();
    const k = { "Armor Class": "ac", AC: "ac", "Hit Points": "hp", HP: "hp", Initiative: "init", Speed: "speed" }[parts[i]];
    if (!f[k]) f[k] = { l: parts[i], v };
  }
  if (!f.ac && !f.hp) return null;
  const line = x => x ? `<strong>${esc(x.l)}</strong> ${esc(x.v)}` : "";
  return `<div class="sbhead"><p>${line(f.ac)}${f.init ? `<span class="sbinit">${line(f.init)}</span>` : ""}</p>${f.hp ? `<p>${line(f.hp)}</p>` : ""}${f.speed ? `<p>${line(f.speed)}</p>` : ""}${other.map(o => `<p>${esc(o)}</p>`).join("")}</div>`;
}
function fixStatBlock(root) {
  // 1) the smallest element that contains all six ability scores
  const cands = [...root.querySelectorAll("*")].filter(el => abParse(spacedText(el)));
  const C = cands.find(c => !cands.some(o => o !== c && c.contains(o)));
  if (!C) return;
  const parsed = abParse(spacedText(C));
  let abStart, abEnd;
  const tbl = C.closest("table");
  if (tbl || /^(TABLE|TBODY|THEAD|TR)$/.test(C.tagName)) abStart = abEnd = tbl || C;
  else {   // the shortest run of C's children that holds all six
    const kids = [...C.childNodes]; let best = null;
    for (let i = 0; i < kids.length; i++) { let txt = ""; for (let j = i; j < kids.length; j++) { txt += " " + spacedText(kids[j]); if (abParse(txt)) { if (!best || j - i < best[1] - best[0]) best = [i, j]; break; } } }
    if (!best || (best[0] === 0 && best[1] === kids.length - 1)) abStart = abEnd = C;
    else { abStart = kids[best[0]]; abEnd = kids[best[1]]; }
    // take along a "MOD SAVE" header row and empty layout elements right before it
    for (let p = abStart.previousSibling; p; p = abStart.previousSibling) {
      const t = spacedText(p).trim(), el = p.nodeType === 1;
      if (el && (p.tagName === "HR" || p.querySelector?.("hr,img,svg"))) break;
      if (t === "" || /^((MOD|SAVE)\s*)+$/i.test(t)) abStart = p; else break;
    }
    // and trailing bare values right after it (e.g. a last "+1" cell)
    for (let n = abEnd.nextSibling; n; n = abEnd.nextSibling) { const t = spacedText(n).trim(); if (/^([+\-−–]?\d+\s*)+$/.test(t)) abEnd = n; else break; }
  }
  const doc = root.ownerDocument || document, tpl = doc.createElement("template");
  // 2) header lines between the type line and the ability scores
  const h1 = root.querySelector("h1"), typeEl = root.querySelector(".type") || h1?.nextElementSibling || h1;
  const r = doc.createRange();
  let newHead = "";
  if (typeEl && (typeEl.compareDocumentPosition(abStart) & Node.DOCUMENT_POSITION_FOLLOWING) && !typeEl.contains(abStart)) {
    const hr = doc.createRange(); hr.setStartAfter(typeEl); hr.setEndBefore(abStart);
    const hh = headHtml(spacedText(hr.cloneContents()));
    if (hh) { newHead = `<hr>${hh}<hr>`; r.setStartAfter(typeEl); }
  }
  if (!newHead) r.setStartBefore(abStart);
  r.setEndAfter(abEnd);
  r.deleteContents();
  tpl.innerHTML = newHead + abHtml(parsed) + "<hr>";
  r.insertNode(tpl.content);
  // 3) tidy: no double rules, no empty leftovers
  root.querySelectorAll("hr").forEach(h => {   // next visible thing after a rule is another rule -> drop it
    if (!root.contains(h)) return;
    const w = (root.ownerDocument || document).createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT); w.currentNode = h;
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (n.nodeType === 3) { if (n.nodeValue.trim()) break; continue; }
      if (n.nodeName === "HR") { n.remove(); break; }
      if (!/^(DIV|SPAN|P|BR)$/.test(n.nodeName)) break;
    } });
  root.querySelectorAll("hr").forEach(h => { let n = h.nextSibling; while (n && ((n.nodeType === 3 && !n.nodeValue.trim()) || n.nodeName === "BR")) { const x = n.nextSibling; if (n.nodeName === "BR") n.remove(); n = x; } });
  [...root.querySelectorAll("div,span,p")].reverse().forEach(el => { if (!el.childNodes.length || (!el.textContent.trim() && !el.querySelector("img,hr,table,br"))) el.remove(); });
}
const SB_CACHE = new Map();
function prepStatHtml(html, title) {
  const key = title + "\u0000" + html; if (SB_CACHE.has(key)) return SB_CACHE.get(key);
  const tpl = document.createElement("template"); tpl.innerHTML = html;
  const wrap = document.createElement("div"); wrap.appendChild(tpl.content);
  try { fixStatBlock(wrap); } catch (e) { console.warn("stat block clean-up failed", e); }
  const out = linkifyHtml(wrap.innerHTML, title); SB_CACHE.set(key, out); return out;
}
function statBlock(sm) {
  const e = monEntry(sm), c = sm.custom || {};
  const name = monName(sm), blk = e ? S.mon.blocks[sm.ref] : null;
  const img = e && e.img ? `<img class="sbimg" src="${esc(monImgSrc(sm))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : (c.image ? `<img class="sbimg" src="${c.image}" alt="">` : "");
  const foot = e && e.src ? `<p class="sbsrc">Source: ${esc(e.src)}${e.ed ? " (" + e.ed + ")" : ""}</p>` : "";
  if (typeof blk === "string" && blk) return `<div class="statblock aidedd">${img}${prepStatHtml(blk, name)}${foot}</div>`;
  // plain text (custom monsters or older imports)
  const lines = Array.isArray(blk) ? blk : String(c.text || "").split("\n");
  const head = e ? [e.size, e.type, e.align].filter(Boolean).join(" ") : [c.size, c.type].filter(Boolean).join(" ");
  const chips = [monCr(sm) && "CR " + monCr(sm), (e?.ac || c.ac) && "AC " + (e?.ac || c.ac), (e?.hp || c.hp) && "HP " + (e?.hp || c.hp), (e?.speed || c.speed) && "Speed " + (e?.speed || c.speed)].filter(Boolean);
  let body = "";
  const SECT = /^(traits|actions|bonus actions|reactions|legendary actions|lair actions)$/i;
  const LABEL = /^(AC|Armor Class|HP|Hit Points|Speed|Initiative|Skills|Saving Throws|Senses|Languages|CR|Challenge|Immunities|Resistances|Vulnerabilities|Gear|Damage Immunities|Damage Resistances|Condition Immunities)\b/;
  lines.forEach((l, idx) => {
    if (!l.trim() || (idx === 0 && norm(l) === norm(name))) return;
    if (SECT.test(l.trim())) { body += `<div class="rub">${esc(l)}</div>`; return; }
    let h = esc(l); const lm = l.match(LABEL);
    if (lm) h = `<strong>${esc(lm[0])}</strong>${esc(l.slice(lm[0].length))}`;
    else { const tm = l.match(/^([A-Z][^.:]{1,60}?(?:\([^)]*\))?)\.\s/); if (tm) h = `<strong><em>${esc(tm[1])}.</em></strong> ${esc(l.slice(tm[0].length))}`; }
    body += `<p>${sbLinks(h, name)}</p>`;
  });
  return `<div class="statblock aidedd">${img}<h1>${esc(name)}</h1>${head ? `<div class="type">${esc(head)}</div>` : ""}${chips.length ? `<div class="red">${chips.map(x => `<span>${esc(x)}</span>`).join(" · ")}</div><hr>` : ""}${npcLinks(body)}${foot}</div>`;
}
function vMonsters() {
  const sc = S.scen, groups = {};
  sc.monsters.forEach(m => (groups[m.group || "Ungrouped"] ||= []).push(m));
  const gnames = [...new Set(sc.monsters.map(m => m.group).filter(Boolean))];
  const left = Object.entries(groups).sort((a, b) => a[0] === "Ungrouped" ? 1 : b[0] === "Ungrouped" ? -1 : a[0].localeCompare(b[0])).map(([g, ms]) => `<div class="grouphead">${esc(g)}</div>` + ms.map(m => {
    const i = sc.monsters.indexOf(m), open = S.ui.openMon === m.id, e = monEntry(m);
    const nodes = sc.nodes.filter(nd => (nd.monsters || []).some(x => x.id === m.id));
    return `<div class="mrow"><div class="mh"><a href="#" data-act="openMon" data-id="${m.id}">${open ? "▾" : "▸"} ${esc(monName(m))}</a>
      <span class="small muted">${esc([e?.cr || m.custom?.cr ? "CR " + (e?.cr || m.custom?.cr) : "", e?.type || m.custom?.type || ""].filter(Boolean).join(" · "))}</span>
      <span class="right small muted">${nodes.length ? "used in " : "not used yet"}</span>${nodes.map(nd => `<span class="chip">#${nd.n} ×${(nd.monsters.find(x => x.id === m.id) || {}).n || 0}</span>`).join("")}</div>
      ${open ? `<div style="margin-top:6px"><div class="row small"><label>Group ${inp(`monsters.${i}.group`, m.group || "", { ph: "e.g. Forge guards", attr: 'list="groupnames"' })}</label>
        ${sc.nodes.length ? `<select data-act="linkMonNode" data-m="${m.id}"><option value="">+ add to node / encounter…</option>${sc.nodes.slice().sort((a, b) => a.n - b.n).map(nd => `<option value="${nd.id}">#${nd.n} ${esc(nd.title || "")}</option>`).join("")}</select>` : ""}
        <button class="small ghost right" data-act="delMon" data-id="${m.id}">Remove</button></div>
        <textarea data-live="monsters.${i}.notes" placeholder="Your notes (tactics, loot, personality…)" style="min-height:50px;margin-top:6px">${esc(m.notes || "")}</textarea>
        ${statBlock(m)}</div>` : ""}</div>`;
  }).join("")).join("");
  return `<div class="two"><div class="card"><div class="row"><h3 style="margin:0">In this scenario (${sc.monsters.length})</h3><button class="small ghost right" data-act="customMon">+ Custom monster</button></div>
      <p class="small muted" style="margin:4px 0">Add each kind of monster once. How many appear where is set per node (Overview → node → Encounter).</p>
      <datalist id="groupnames">${gnames.map(g => `<option value="${esc(g)}">`).join("")}</datalist>
      ${left || '<p class="muted small">Add monsters from the compendium →</p>'}</div>
    <div class="card"><h3>Add from compendium</h3>${(S.mon.list || []).length ? `
      <div class="row"><input id="monq" placeholder="🔍 Search name, type, CR…" value="${esc(S.ui.monq || "")}" data-act-input="monq" style="flex:1">
        ${sel("__ed", S.ui.monEd || "2024", [["2024", "2024"], ["2014", "2014"], ["all", "All editions"]], { attr: 'data-act="monEd"' }).replace('data-path="__ed"', "")}</div>
      <div class="row small" style="margin-top:6px;gap:4px"><span class="muted">Type:</span><a href="#" class="chip ${(S.ui.monTypes || []).length ? "" : "on"}" data-act="monType" data-t="">All</a>${monTypeList().map(([t, n]) => `<a href="#" class="chip ${(S.ui.monTypes || []).includes(t) ? "on" : ""}" data-act="monType" data-t="${esc(t)}">${esc(cap(t))} <span class="cnt">${n}</span></a>`).join("")}</div>
      <div class="row small" style="margin-top:6px"><label>Sort ${sel("__sort", S.ui.monSort || "name", [["name", "Name A→Z"], ["cr", "CR low → high"], ["crd", "CR high → low"]], { attr: 'data-act="monSort"' }).replace('data-path="__sort"', "")}</label></div>
      <div id="monlist" data-sk="monlist" style="max-height:65vh;overflow:auto;margin-top:8px">${monList()}</div>` : '<p class="muted">Import the monster compendium on the start page (needs internet once), or add custom monsters.</p>'}</div></div>`;
}
const cap = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);
function baseType(m) { return norm(m.type || "").replace(/^swarm of \w+ /, "swarm ").split(" ")[0] || "other"; }
function crNum(cr) { cr = String(cr || "").trim(); if (!cr) return 99; if (cr.includes("/")) { const [a, b] = cr.split("/"); return +a / +b; } return parseFloat(cr) || 0; }
function monTypeList() { const ed = S.ui.monEd || "2024", c = {}; (S.mon.list || []).filter(m => ed === "all" || m.ed === ed).forEach(m => { const t = baseType(m); c[t] = (c[t] || 0) + 1; }); return Object.entries(c).sort((a, b) => a[0].localeCompare(b[0])); }
function monList() {
  const q = norm(S.ui.monq || ""), ed = S.ui.monEd || "2024", ts = S.ui.monTypes || [], so = S.ui.monSort || "name";
  let list = (S.mon.list || []).filter(m => ed === "all" || m.ed === ed);
  if (ts.length) list = list.filter(m => ts.includes(baseType(m)));
  if (q) list = list.filter(m => norm(`${m.name} ${m.type || ""} cr ${m.cr || ""} ${m.src || ""}`).includes(q));
  list = list.slice().sort((a, b) => so === "name" ? a.name.localeCompare(b.name) : (so === "cr" ? 1 : -1) * (crNum(a.cr) - crNum(b.cr)) || a.name.localeCompare(b.name));
  const shown = list.slice(0, 150);
  return shown.map(m => { const k = monKey(m), open = S.ui.openComp === k;
    return `<div class="mrow"><div class="mh"><a href="#" data-act="openComp" data-k="${esc(k)}">${open ? "▾" : "▸"} ${esc(m.name)}</a><span class="small muted">${esc([m.cr && "CR " + m.cr, m.size, m.type].filter(Boolean).join(" · "))}</span>
      <button class="small right" data-act="addMon" data-k="${esc(k)}">+ Add</button></div>${open ? statBlock({ ref: k }) : ""}</div>`; }).join("")
    + (list.length > shown.length ? `<p class="small muted">${list.length - shown.length} more — refine the search.</p>` : "") + (list.length ? "" : '<p class="muted small">Nothing found.</p>');
}

// ----- NPCs -----
function vNpcs() {
  const sc = S.scen;
  return `<div class="card"><div class="row"><h3 style="margin:0">NPCs (${sc.npcs.length})</h3><input id="newNpc" placeholder="Name, e.g. Thorin Ashforge" style="flex:1;min-width:180px"><button data-act="addNpc">+ Add NPC</button></div>
    <div class="row small" style="margin-top:6px"><span class="muted grow">Wherever you write an NPC's name (or an alias) in node descriptions or notes, it becomes a link to their entry.</span><button class="small ${S.ui.nameGen ? "" : "ghost"}" data-act="nameGen">🎲 Random names ${S.ui.nameGen ? "▾" : "▸"}</button></div>
    ${S.ui.nameGen ? nameGenBox() : ""}</div>
    <div class="npcgrid">${sc.npcs.map((n, i) => { const open = S.ui.openNpc === n.id;
      return `<div class="card npccard ${open ? "open" : ""}" id="npc-${n.id}"><div class="row" data-act="openNpc" data-id="${n.id}" style="cursor:pointer;flex-wrap:nowrap">${n.image ? `<img src="${n.image}" class="npcthumb">` : `<div class="npcthumb ph">🙂</div>`}
        <div class="grow"><b>${esc(n.name)}</b><div class="small muted">${esc(n.role || "")}</div></div><span class="muted">${open ? "▾" : "▸"}</span></div>
        ${open ? `<div style="display:grid;gap:8px;margin-top:10px">
          ${n.image ? `<img src="${n.image}" style="max-width:100%;max-height:340px;border-radius:8px;object-fit:contain">` : ""}
          <div class="row"><button class="small" data-act="npcImg" data-id="${n.id}">🖼 ${n.image ? "Change" : "Add"} image</button>${n.image ? `<button class="small ghost" data-act="npcImgDel" data-id="${n.id}">Remove image</button>` : ""}</div>
          <label class="small">Name ${inp(`npcs.${i}.name`, n.name, { style: "width:100%" })}</label>
          <label class="small">Also link these words (comma separated) ${inp(`npcs.${i}.aliases`, n.aliases || "", { ph: "e.g. Thorin, the forge master", style: "width:100%" })}</label>
          <label class="small">Role / description ${inp(`npcs.${i}.role`, n.role || "", { ph: "e.g. Dwarven smith, quest giver", style: "width:100%" })}</label>
          <label class="small">Where to find them ${sel(`npcs.${i}.node`, n.node || "", sc.nodes.slice().sort((a, b) => a.n - b.n).map(nd => [nd.id, "#" + nd.n + " " + (nd.title || "")]), { blank: "— no node —" })}</label>
          <label class="small">Notes (personality, voice, what they know, secrets)<textarea data-live="npcs.${i}.notes" style="min-height:140px">${esc(n.notes || "")}</textarea></label>
          <div><button class="small ghost danger" style="color:#fff" data-act="delNpc" data-id="${n.id}">🗑 Delete NPC</button></div></div>` : ""}</div>`; }).join("") || '<p class="muted">No NPCs yet.</p>'}</div>`;
}
function nameTags() { if (!S.ui.nameTags) { try { S.ui.nameTags = JSON.parse(localStorage.getItem("dmNameTags") || "null"); } catch (e) { } S.ui.nameTags ||= ["medieval", "surname"]; } return S.ui.nameTags; }
function nameGenBox() {
  const tags = nameTags(), chip = ([k, l]) => `<a href="#" class="chip ${tags.includes(k) ? "on" : ""}" data-act="nameTag" data-t="${k}">${esc(l)}</a>`;
  return `<div class="namegen"><div class="small"><b>Style</b> ${NAMES.STYLES.map(chip).join("")}</div>
    <div class="small"><b>Gender</b> ${NAMES.GENDERS.map(chip).join("")} <b style="margin-left:10px">Extras</b> ${NAMES.EXTRAS.map(chip).join("")}</div>
    <div class="row"><button data-act="genNames">🎲 Generate 6 names</button><span class="small muted">Pick several tags to mix them. Nothing picked = a mix of everything. Click a name to add the NPC.</span></div>
    ${(S.ui.names || []).length ? `<div class="namelist">${S.ui.names.map(n => `<button class="ghost" data-act="useName" data-v="${esc(n)}">${esc(n)}</button>`).join("")}</div>` : ""}</div>`;
}
function mNpc() {
  const n = (S.scen.npcs || []).find(x => x.id === S.modal.id); if (!n) return "";
  const nd = S.scen.nodes.find(x => x.id === n.node);
  return `<div class="row" style="flex-wrap:nowrap;align-items:flex-start">${n.image ? `<img src="${n.image}" style="width:140px;max-height:200px;object-fit:cover;border-radius:10px">` : ""}
    <div class="grow"><h2 style="margin:0">${esc(n.name)}</h2><div class="muted">${esc(n.role || "")}</div>${nd ? `<p class="small">📍 #${nd.n} ${esc(nd.title || "")}</p>` : ""}</div></div>
    <div class="desc" style="margin-top:10px">${richText(n.notes) || '<span class="muted">No notes yet.</span>'}</div>
    <div class="foot"><button class="ghost" data-act="npcGo" data-id="${n.id}">Open in NPCs tab</button><button data-act="closeModal">Close</button></div>`;
}

// ----- notes -----
function vNotes() {
  const sc = S.scen, editing = S.ui.editNotes || !sc.notes;
  return `<div class="two"><div class="card"><h3>Secrets &amp; clues</h3><p class="small muted">Tick them off when the players discover them.</p>
      ${sc.secrets.map((s, i) => `<div class="tokrow"><input type="checkbox" data-path="secrets.${i}.done" ${s.done ? "checked" : ""}><input type="text" data-path="secrets.${i}.text" value="${esc(s.text)}" style="flex:1;min-width:160px;${s.done ? "text-decoration:line-through;opacity:.6" : ""}">
        ${sel(`secrets.${i}.node`, s.node || "", sc.nodes.slice().sort((a, b) => a.n - b.n).map(nd => [nd.id, "#" + nd.n + " " + (nd.title || "")]), { blank: "— node —" })}<a href="#" data-act="delSecret" data-i="${i}">✕</a></div>`).join("")}
      <div class="row" style="margin-top:8px"><input id="newSecret" placeholder="New secret or clue…" style="flex:1"><button class="small" data-act="addSecret">+ Add</button></div></div>
    <div class="card"><div class="row"><h3 style="margin:0">Notes</h3><button class="small ghost right" data-act="editNotes">${editing ? "✔ Done" : "✎ Edit"}</button></div>
      ${editing ? `<textarea data-live="notes" style="min-height:420px;margin-top:8px" placeholder="Session plan, NPCs, hooks, loot… NPC names become links.">${esc(sc.notes || "")}</textarea>` : `<div class="desc readtext" style="margin-top:8px">${richText(sc.notes)}</div>`}</div></div>`;
}

// ----- modals -----
function mQR() {
  const ips = S.net?.ips || [], port = S.net?.port || location.port || 8766;
  const ip = S.ui.qrIp && ips.includes(S.ui.qrIp) ? S.ui.qrIp : ips[0];
  const url = ip ? `http://${ip}:${port}/table` : "";
  return `<h2>📱 Players: scan to join</h2>
    ${url ? `<div class="qrbox">${QR.svg(url, 300)}<p style="font-size:18px;font-weight:700;word-break:break-all">${esc(url)}</p></div>
      ${ips.length > 1 ? `<p class="small">Network: <select data-act="qrIp">${ips.map(i => `<option ${i === ip ? "selected" : ""}>${i}</option>`).join("")}</select> <span class="muted">(pick the one of the Wi-Fi/hotspot your players are on — the hotspot is usually 192.168.137.1)</span></p>` : ""}`
      : `<p class="warn">No network found. Connect the laptop to a Wi-Fi or turn on its mobile hotspot, then reopen this window.</p>`}
    <p class="small muted">Players must be on the same Wi-Fi or on your laptop's hotspot. No internet is needed. If their phone can't connect, allow Python through the Windows firewall for <b>private networks</b>.</p>
    <div class="foot"><button data-act="closeModal">Done</button></div>`;
}
function mCustom() {
  const c = S.modal.c;
  return `<h2>Custom monster</h2>
    <div class="grid g2"><label>Name<br><input id="cm_name" value="${esc(c.name || "")}" style="width:100%"></label><label>Size<br><select id="cm_size">${["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"].map(s => `<option ${c.size === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
      <label>Type<br><input id="cm_type" value="${esc(c.type || "")}" placeholder="e.g. Humanoid"></label><label>CR<br><input id="cm_cr" value="${esc(c.cr || "")}"></label>
      <label>AC<br><input id="cm_ac" value="${esc(c.ac || "")}"></label><label>HP<br><input id="cm_hp" value="${esc(c.hp || "")}" placeholder="e.g. 27 (5d8+5)"></label></div>
    <label>Stat block text (paste anything — dice like 2d6+3 and +5 to hit become clickable)<br><textarea id="cm_text" style="min-height:200px">${esc(c.text || "")}</textarea></label>
    <div class="foot"><button class="ghost" data-act="closeModal">Cancel</button><button data-act="saveCustom">Add monster</button></div>`;
}

// ---------- actions ----------
Object.assign(ACT, {
  home: async () => { await flushSave(); S.view = "home"; S.scen = null; S.mapId = null; Object.assign(S.ui, { ovZ: null, popNode: null, openNode: null, placing: false, editNode: null }); await loadList(); render(); },
  theme: () => { const r = document.documentElement; r.dataset.theme = r.dataset.theme === "dark" ? "light" : "dark"; try { localStorage.setItem("dmtheme", r.dataset.theme); } catch (e) { } },
  newScen: async () => { const n = ($("#newname").value || "").trim(); S.scen = newScenario(n || "New scenario"); S.view = "scen"; S.tab = "overview"; await Store.put(S.scen); render(); },
  openScen: async el => { await flushSave(); const sc = await Store.get(el.dataset.id); if (!sc) return toast("Scenario not found");
    S.scen = migrateScen(sc); S.view = "scen"; S.tab = "overview"; S.mapId = null; Object.assign(S.ui, { ovZ: null, popNode: null, openNode: null, placing: false, editNode: null, synOpen: false, editSyn: false }); render(); window.scrollTo(0, 0); },
  synTog: () => { S.ui.synOpen = !S.ui.synOpen; render(); },
  synEdit: () => { S.ui.editSyn = !(S.ui.editSyn || !S.scen.synopsis); render(); },
  listTog: el => { S.ui[el.dataset.k] = S.ui[el.dataset.k] === false; render(); },
  popClose: () => { S.ui.popNode = null; drawOverview(); },
  popEdit: el => { S.ui.popNode = null; S.ui.openNode = el.dataset.id; S.ui[isWorld() ? "wList" : "nList"] = true; render(); setTimeout(() => $("#node-" + el.dataset.id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 30); },
  monType: el => { const t = el.dataset.t; const a = S.ui.monTypes || []; S.ui.monTypes = !t ? [] : a.includes(t) ? a.filter(x => x !== t) : [...a, t]; render(); },
  delScen: async () => { if (!confirm(`Delete "${S.scen.name}" on all your devices?${S.server ? " (the laptop keeps a copy in scenarios/deleted)" : ""}`)) return; pendingScen = null; await Store.del(S.scen.id); S.scen = null; ACT.home(); },
  exportScen: () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(S.scen)], { type: "application/json" })); a.download = S.scen.name.replace(/[^\w-]+/g, "_") + ".scenario.json"; a.click(); },
  importScen: () => { const f = document.createElement("input"); f.type = "file"; f.accept = ".json,application/json"; f.onchange = async () => {
    try { const j = JSON.parse(await f.files[0].text());
      if (j.format === "dm-tool-backup-v1") {   // full backup: scenarios + world (+ monsters); only newer versions replace what's here
        let neu = 0, same = 0;
        for (const sc of j.scenarios || []) { const local = await Store.get(sc.id);
          if (!local || (sc.updated || 0) > (local.updated || 0)) { migrateScen(sc); sc.updated ||= Date.now(); await Store.put(sc, false); Folder.push(sc); neu++; } else same++; }
        if (j.world && (j.world.updated || 0) > (S.world?.updated || 0)) { await Store.putWorld(j.world, false); Folder.pushWorld(j.world); await loadWorld(); }
        let mon = "";
        if (j.monsters && (j.monsters.list || []).length && j.monsters.imported !== S.mon.imported) { await Store.setMon(j.monsters); await loadMonsters(); mon = ` · ${j.monsters.list.length} monsters`; }
        if (S.scen) { const cur = await Store.get(S.scen.id); if (cur) S.scen = migrateScen(cur); }
        await loadList(); render(); return toast(`${neu} scenarios new or updated, ${same} already up to date${mon}`); }
      if (Array.isArray(j.list) && j.blocks) { await Store.setMon(j); await loadMonsters(); render(); return toast(j.list.length + " monsters loaded"); }
      if (!j.nodes) throw 0; j.id ||= "s" + Date.now().toString(36); migrateScen(j); await Store.put(j); S.scen = j; S.view = "scen"; S.tab = "overview"; render(); }
    catch (e) { toast("Not a scenario, backup or monster file"); } }; f.click(); },
  exportAll: async () => { await flushSave(); const scs = []; for (const s of await Store.list()) scs.push(await Store.get(s.id));
    const mon = (S.mon.list || []).length ? { ...S.mon } : null; if (mon) delete mon.byKey;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify({ format: "dm-tool-backup-v1", saved: new Date().toISOString(), scenarios: scs, world: S.world, monsters: mon })], { type: "application/json" }));
    a.download = "dm-tool-backup-" + new Date().toISOString().slice(0, 10) + ".json"; a.click(); },
  exportMon: () => { const m = { ...S.mon }; delete m.byKey; const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(m)], { type: "application/json" })); a.download = "monsters.json"; a.click(); },
  syncTap: () => { if (Sync.status === "signin" || Sync.status === "error") Sync.connect(); else Sync.run(); },
  syncConnect: async () => { const v = ($("#clientId")?.value || "").trim(); if (v) { Sync.settings.clientId = v; await Sync.saveSettings(); } await Sync.connect(); render(); },
  syncOff: () => { Sync.disconnect(); render(); },
  syncNow: () => Sync.run(),
  impMon: async () => { await api("api/monsters/import", { method: "POST", body: { include2014: !!$("#imp2014")?.checked, images: !!$("#impImg")?.checked } }); S.ui.imp = { running: true, done: 0, total: 0, msg: "Starting…" }; render(); pollImport(); },
  tab: el => { S.tab = el.dataset.k; if (S.tab !== "maps") S.mapId = null; S.ui.bmZ = null; render(); },
  // overview
  setOvMap: async () => { const img = await pickImage(2600); if (!img) return; doc().map = { image: img.data, w: img.w, h: img.h }; if (!isWorld()) S.scen.thumb = img.thumb; S.ui.ovZ = null; save(); render(); },
  togglePlace: () => { S.ui.placing = !S.ui.placing; render(); },
  ovZoom: el => { const host = $("#ovmap"); S.ui.ovZ = el.dataset.d === "fit" ? MapView.fitZoom(host, doc().map) : S.ui.ovZ * +el.dataset.d; drawOverview(); },
  openNode: el => { S.ui.openNode = S.ui.openNode === el.dataset.id ? null : el.dataset.id; render(); },
  delNode: el => { if (!confirm("Delete this node?")) return; const d = doc(); d.nodes = d.nodes.filter(n => n.id !== el.dataset.id); (d.secrets || []).forEach(s => { if (s.node === el.dataset.id) s.node = ""; }); save(); render(); },
  encN: el => { const nd = S.scen.nodes.find(n => n.id === el.dataset.n); const x = nd.monsters.find(k => k.id === el.dataset.m); x.n = Math.max(0, (+x.n || 0) + +el.dataset.d); if (!x.n) nd.monsters = nd.monsters.filter(k => k !== x); save(); render(); },
  encDel: el => { const nd = S.scen.nodes.find(n => n.id === el.dataset.n); nd.monsters = nd.monsters.filter(k => k.id !== el.dataset.m); save(); render(); },
  editNode: el => { S.ui.editNode = el.dataset.id || null; render(); },
  editNotes: () => { S.ui.editNotes = !(S.ui.editNotes || !S.scen.notes); render(); },
  nameGen: () => { S.ui.nameGen = !S.ui.nameGen; if (S.ui.nameGen && !S.ui.names) S.ui.names = NAMES.generate(nameTags()); render(); },
  nameTag: el => { const t = nameTags(), k = el.dataset.t; S.ui.nameTags = t.includes(k) ? t.filter(x => x !== k) : [...t, k]; try { localStorage.setItem("dmNameTags", JSON.stringify(S.ui.nameTags)); } catch (e) { } render(); },
  genNames: () => { S.ui.names = NAMES.generate(nameTags()); render(); },
  useName: el => { const npc = { id: uid(), name: el.dataset.v, role: "", notes: "", aliases: "", image: "", node: "" }; S.scen.npcs.push(npc); S.ui.openNpc = npc.id; S.ui.names = S.ui.names.filter(n => n !== el.dataset.v); save(); render(); toast(el.dataset.v + " added");
    setTimeout(() => $("#npc-" + npc.id)?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 50); },
  addNpc: () => { const n = ($("#newNpc").value || "").trim(); if (!n) return toast("Type a name first"); const npc = { id: uid(), name: n, role: "", notes: "", aliases: "", image: "", node: "" }; S.scen.npcs.push(npc); S.ui.openNpc = npc.id; save(); render(); },
  openNpc: el => { S.ui.openNpc = S.ui.openNpc === el.dataset.id ? null : el.dataset.id; render(); },
  delNpc: el => { if (!confirm("Delete this NPC?")) return; S.scen.npcs = S.scen.npcs.filter(n => n.id !== el.dataset.id); save(); render(); },
  npcImg: async el => { const img = await pickImage(900); if (!img) return; S.scen.npcs.find(n => n.id === el.dataset.id).image = img.data; save(); render(); },
  npcImgDel: el => { S.scen.npcs.find(n => n.id === el.dataset.id).image = ""; save(); render(); },
  npcPeek: (el, e) => { e.stopPropagation(); S.modal = { type: "npc", id: el.dataset.id }; renderModal(); },
  npcGo: el => { S.modal = null; S.tab = "npcs"; S.ui.openNpc = el.dataset.id; render(); setTimeout(() => $("#npc-" + el.dataset.id)?.scrollIntoView({ block: "start", behavior: "smooth" }), 50); },
  addEncTok: () => { const m = curMap(), nd = S.scen.nodes.find(n => n.battlemap === m.id); if (!nd) return;
    for (const x of encounterOf(nd)) { const base = monName(x.sm), hp = monHp(x.sm), size = monSize(x.sm); const existing = m.tokens.filter(t => t.mon === x.sm.id).length;
      for (let k = 0; k < x.n; k++) { const pos = freeCell(m, size, true); m.tokens.push({ id: uid(), kind: "monster", mon: x.sm.id, name: `${base} ${existing + k + 1}`, color: "#8e1f1f", x: pos.x, y: pos.y, size, hidden: true, hp, maxHp: hp }); } }
    save(); render(); pushTable(); toast("Encounter tokens added (hidden)"); },
  unlinkMon: el => { const nd = S.scen.nodes.find(n => n.id === el.dataset.n); nd.monsters = (nd.monsters || []).filter(x => x.id !== el.dataset.m); save(); render(); },
  // battlemaps
  addMap: async () => { const img = await pickImage(3200); if (!img) return; const b = { id: uid(), name: img.name || "Battlemap", image: img.data, thumb: img.thumb, w: img.w, h: img.h, grid: { cols: 20, rows: Math.max(1, Math.round(20 * img.h / img.w)), ox: 0, oy: 0, show: true, color: "#000000", opacity: 0.35 }, tokens: [] };
    S.scen.battlemaps.push(b); S.mapId = b.id; S.ui.bmZ = null; save(); render(); },
  openMap: el => { S.tab = "maps"; S.mapId = el.dataset.id; S.ui.bmZ = null; S.ui.selTok = null; render(); },
  closeMap: () => { S.mapId = null; render(); },
  delMap: () => { const m = curMap(); if (!confirm(`Delete battlemap "${m.name}"?`)) return; S.scen.battlemaps = S.scen.battlemaps.filter(b => b !== m); S.scen.nodes.forEach(n => { if (n.battlemap === m.id) n.battlemap = ""; }); S.mapId = null; save(); render(); },
  bmZoom: el => { const host = $("#bmmap"); S.ui.bmZ = el.dataset.d === "fit" ? MapView.fitZoom(host, curMap()) : S.ui.bmZ * +el.dataset.d; drawBattlemap(); },
  squareRows: () => { const m = curMap(); m.grid.rows = Math.max(1, Math.round(m.grid.cols * m.h / m.w)); save(); render(); pushTable(); },
  addPlayer: () => { const m = curMap(); const n = ($("#newPlayer").value || "").trim() || "Player " + (m.tokens.filter(t => t.kind !== "monster").length + 1);
    const pos = freeCell(m, 1, false);
    m.tokens.push({ id: uid(), kind: "player", name: n, color: TOKEN_COLORS[m.tokens.filter(t => t.kind !== "monster").length % TOKEN_COLORS.length], x: pos.x, y: pos.y, size: 1 }); save(); render(); pushTable(); },
  addMonTok: () => { const m = curMap(), sm = S.scen.monsters.find(x => x.id === $("#newMonTok").value); if (!sm) return; const cnt = Math.max(1, +$("#newMonN").value || 1);
    const base = monName(sm), existing = m.tokens.filter(t => t.mon === sm.id).length, hp = monHp(sm);
    for (let k = 0; k < cnt; k++) { const size = monSize(sm), pos = freeCell(m, size, true);
      m.tokens.push({ id: uid(), kind: "monster", mon: sm.id, name: `${base} ${existing + k + 1}`, color: "#8e1f1f", x: pos.x, y: pos.y, size, hidden: true, hp, maxHp: hp }); }
    save(); render(); pushTable(); },
  tokDel: el => { const m = curMap(); m.tokens = m.tokens.filter(t => t.id !== el.dataset.id); save(); render(); pushTable(); },
  tokHide: el => { const t = curMap().tokens.find(x => x.id === el.dataset.id); t.hidden = !t.hidden; save(); render(); pushTable(); },
  tokHp: el => { const t = curMap().tokens.find(x => x.id === el.dataset.id); t.hp = Math.max(0, (t.hp ?? t.maxHp ?? 0) + +el.dataset.d); save(); render(); },
  share: async () => { const m = curMap(); S.live = { mapId: m.id }; await pushTable(true); S.net = await api("api/net"); S.modal = { type: "qr" }; render(); },
  showQR: async () => { S.net = await api("api/net"); S.modal = { type: "qr" }; renderModal(); },
  stopShare: async () => { await api("api/table/stop", { method: "POST" }); S.live = null; render(); },
  closeModal: () => { S.modal = null; renderModal(); },
  // monsters
  openMon: el => { S.ui.openMon = S.ui.openMon === el.dataset.id ? null : el.dataset.id; render(); },
  openComp: el => { S.ui.openComp = S.ui.openComp === el.dataset.k ? null : el.dataset.k; $("#monlist").innerHTML = monList(); },
  addMon: el => { const e = S.mon.byKey[el.dataset.k]; S.scen.monsters.push({ id: uid(), ref: el.dataset.k, name: e.name, count: 1, group: "", notes: "" }); save(); render(); toast(e.name + " added"); },
  delMon: el => { if (!confirm("Remove this monster from the scenario?")) return; const id = el.dataset.id; S.scen.monsters = S.scen.monsters.filter(m => m.id !== id); S.scen.nodes.forEach(n => n.monsters = (n.monsters || []).filter(x => x.id !== id)); save(); render(); },
  customMon: () => { S.modal = { type: "custom", c: {} }; renderModal(); },
  saveCustom: () => { const c = { name: $("#cm_name").value.trim() || "Custom monster", size: $("#cm_size").value, type: $("#cm_type").value, cr: $("#cm_cr").value, ac: $("#cm_ac").value, hp: $("#cm_hp").value, text: $("#cm_text").value };
    S.scen.monsters.push({ id: uid(), name: c.name, custom: c, count: 1, group: "", notes: "" }); S.modal = null; save(); render(); },
  // notes
  addSecret: () => { const t = ($("#newSecret").value || "").trim(); if (!t) return; S.scen.secrets.push({ id: uid(), text: t, done: false, node: "" }); save(); render(); },
  delSecret: el => { S.scen.secrets.splice(+el.dataset.i, 1); save(); render(); }
});
Object.assign(CHG, {
  encAdd: el => { if (!el.value) return; const nd = S.scen.nodes.find(n => n.id === el.dataset.n); const x = (nd.monsters ||= []).find(k => k.id === el.value); if (x) x.n = (+x.n || 0) + 1; else nd.monsters.push({ id: el.value, n: 1 }); },
  linkMonNode: el => { if (!el.value) return; const nd = S.scen.nodes.find(n => n.id === el.value); const x = (nd.monsters ||= []).find(k => k.id === el.dataset.m); if (x) x.n = (+x.n || 0) + 1; else nd.monsters.push({ id: el.dataset.m, n: 1 }); toast(`Added to #${nd.n}`); },
  monEd: el => { S.ui.monEd = el.value; S.ui.monTypes = []; },
  monSort: el => { S.ui.monSort = el.value; },
  qrIp: el => { S.ui.qrIp = el.value; }
});

async function pollImport() {
  const st = await api("api/monsters/import"); S.ui.imp = st;
  if (S.view === "home") render();
  if (st.running) setTimeout(pollImport, 900); else { await Folder.pull(); await loadMonsters(); if (S.view === "home") render(); if (!st.error) toast("Monsters ready"); }
}

// ---------- events ----------
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  if (["INPUT", "SELECT", "TEXTAREA", "OPTION"].includes(el.tagName)) return;
  const fn = ACT[el.dataset.act]; if (!fn) return;
  if (el.tagName === "A") e.preventDefault();
  fn(el, e);
});
document.addEventListener("change", e => {
  const el = e.target;
  if (el.dataset.path && doc()) {
    let v = el.type === "checkbox" ? el.checked : (el.dataset.num !== undefined || el.type === "number") ? (parseFloat(el.value) || 0) : el.value;
    setPath(doc(), el.dataset.path, v);
    if (/^battlemaps\.\d+\.grid\.(cols|rows)$/.test(el.dataset.path)) setPath(S.scen, el.dataset.path, Math.max(1, Math.round(v) || 1));
    save(); render();
    if (el.dataset.path.startsWith("battlemaps.")) pushTable();
  } else if (el.dataset.act && CHG[el.dataset.act]) { CHG[el.dataset.act](el, e); if (S.scen && ["encAdd", "linkMonNode"].includes(el.dataset.act)) save(); render(); }
});
document.addEventListener("input", e => {
  const el = e.target;
  if (el.dataset.live && doc()) { setPath(doc(), el.dataset.live, el.value); save();
    const mm = el.dataset.live.match(/^nodes\.(\d+)\.text$/); if (mm) S.ui.editNode = doc().nodes[+mm[1]].id;
    if (el.dataset.live === "notes") S.ui.editNotes = true;
    if (el.dataset.live === "synopsis") S.ui.editSyn = true; }
  if (el.dataset.actInput === "monq") { S.ui.monq = el.value; $("#monlist").innerHTML = monList(); }
});
$("#modal").addEventListener("mousedown", e => { if (e.target.id === "modal") { S.modal = null; renderModal(); } });
// battlemap token dragging (DM)
document.addEventListener("pointerdown", e => { if (e.target.closest("#bmmap .tok")) S.ui.dragging = true; }, true);
document.addEventListener("pointerup", () => setTimeout(() => S.ui.dragging = false, 80), true);
let bmBound = false;
function bindBattlemap() {
  if (bmBound) return; bmBound = true;
  // delegate on document so re-rendered #bmmap keeps working
  const proxy = { addEventListener: (type, fn) => document.addEventListener(type, ev => { if (type === "pointerdown" && !ev.target.closest("#bmmap")) return; fn(ev); }) };
  proxy.querySelector = s => { const h = $("#bmmap"); return h ? h.querySelector(s) : null; };
  MapView.bind(proxy, () => ({ map: curMap(), z: S.ui.bmZ }), (id, x, y) => {
    const m = curMap(); const t = m.tokens.find(k => k.id === id); if (t) { t.x = x; t.y = y; }
    save(); drawBattlemap();
    if (S.live && S.live.mapId === m.id) api("api/table/move", { method: "POST", body: { id, x, y } });
  }, id => { S.ui.selTok = S.ui.selTok === id ? null : id; render(); });
}

const APP_VERSION = "2026-10-27";
(async function init() {
  try { const t = localStorage.getItem("dmtheme"); if (t) document.documentElement.dataset.theme = t; } catch (e) { }
  await Sync.init();
  S.server = await detectServer();
  if (S.server) await Folder.pull();          // laptop: bring in scenario files from the scenarios folder
  await Promise.all([loadList(), loadMonsters(), loadWorld()]);
  bindOverview(); bindBattlemap();
  render(); renderSyncChip();
  if (S.server) { const st = await api("api/monsters/import"); if (st.running) { S.ui.imp = st; pollImport(); } dmPoll(); }
  else if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => { });
    let reloaded = false; navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloaded && !document.querySelector("textarea:focus,input:focus")) { reloaded = true; location.reload(); } });
  }
  Sync.soon(800);
})();
