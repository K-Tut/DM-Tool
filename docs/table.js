"use strict";
/* Player view: the shared battlemap (live, everyone can move tokens) and the loot / items the DM hands out. */
const T = { map: null, rev: -1, imageRev: "", z: null, fitMode: true, dragging: false, players: [], offers: [], open: {}, seenOffers: null, imgs: {} };
// online table: the QR code opens …/table.html#peer=<the DM's id> and we connect to the DM Tool over the internet
const PEER = (location.hash.match(/peer=([\w-]+)/) || [])[1] || "";
let CONN = null;
const board = document.getElementById("board"), status = document.getElementById("status");
const RAR_COL = { common: "#6b6b6b", uncommon: "#2f7d4a", rare: "#1f4e8e", "very rare": "#6b2f8e", legendary: "#b8641a", artifact: "#8e1f1f" };
let ME = null; try { ME = JSON.parse(localStorage.getItem("tablePlayer") || "null"); } catch (e) { }

function draw() {
  if (!T.map || !T.map.active) { board.innerHTML = `<div id="wait">${T.map && !T.map.active ? "The DM is not sharing a map right now." : "Waiting for the DM to share a map…"}<br><small style="opacity:.7">Loot and items from the DM appear under 🎁</small></div>`; return; }
  if (T.fitMode || T.z == null) T.z = MapView.fitZoom(board, T.map);
  const sl = board.scrollLeft, st = board.scrollTop;
  board.innerHTML = MapView.html(T.map, T.z, { dm: false, img: t => !t.ref ? "" : PEER ? (T.imgs[t.ref] || "") : "/api/mimg?k=" + encodeURIComponent(t.ref) });
  board.scrollLeft = sl; board.scrollTop = st;
  document.getElementById("tname").textContent = T.map.name || "Battlemap";
}

function applyState(s) {
  const image = s.image !== undefined ? s.image : (T.map ? T.map.image : "");
  if (s.image !== undefined) T.imageRev = s.imageRev;
  if (s.imgs) T.imgs = s.imgs;
  T.rev = s.rev;
  const changedMap = !T.map || T.map.mapId !== s.mapId;
  T.map = { ...s, image };
  T.players = s.players || []; T.offers = s.offers || [];
  if (changedMap) T.fitMode = true;
  status.textContent = s.active ? "● live" : "○ connected"; status.style.color = s.active ? "#7d7" : "#ccc";
  if (!T.dragging) draw();
  lootUpdate();
}
async function poll() {
  if (PEER) return connectOnline();
  for (;;) {
    try {
      const r = await fetch(`/api/table?rev=${T.rev}&img=${T.imageRev}&pid=${ME ? ME.pid : ""}`, { cache: "no-store" });
      applyState(await r.json());
    } catch (e) {
      status.textContent = "reconnecting…"; status.style.color = "#fb6";
      await new Promise(res => setTimeout(res, 1500));
    }
  }
}
// ---------- online table (PeerJS / WebRTC) ----------
function loadPeerJs() { return window.Peer ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
let peer = null, retryT = null;
function retry(msg) { status.textContent = msg || "reconnecting…"; status.style.color = "#fb6"; clearTimeout(retryT); retryT = setTimeout(connectOnline, 3000); }
async function connectOnline() {
  status.textContent = "connecting…"; status.style.color = "#ccc";
  try { await loadPeerJs(); } catch (e) { return retry("no internet?"); }
  if (!peer || peer.destroyed) {
    peer = new Peer({ debug: 1, ...(window.PEER_OPTS || {}) });
    peer.on("error", e => { if (e.type === "peer-unavailable") retry("DM not online — is the DM Tool open?"); else retry(); });
    peer.on("disconnected", () => { try { peer.reconnect(); } catch (e) { } });
    await new Promise(res => { if (peer.open) res(); else peer.on("open", res); setTimeout(res, 8000); });
  }
  try { CONN && CONN.close(); } catch (e) { }
  const c = CONN = peer.connect(PEER, { reliable: true });
  c.on("open", () => { status.textContent = "○ connected"; status.style.color = "#ccc"; if (ME) c.send({ t: "join", p: ME }); c.send({ t: "hello" }); });
  c.on("data", m => { if (m && m.t === "state") { T.lastMsg = Date.now(); applyState(m.s); } });
  c.on("close", () => { if (CONN === c) retry(); });
  c.on("error", () => { if (CONN === c) retry(); });
}
// the DM sends something at least every 15 s; if nothing comes for 40 s, reconnect (DM page reloaded, network hiccup…)
setInterval(() => { if (PEER && T.lastMsg && Date.now() - T.lastMsg > 40000) { T.lastMsg = Date.now(); retry("reconnecting…"); } }, 5000);
function sendOnline(m) { try { if (CONN && CONN.open) { CONN.send(m); return true; } } catch (e) { } return false; }

// ---------- who am I ----------
const COLORS = ["#c92a2a", "#1971c2", "#2f9e44", "#9c36b5", "#e8590c", "#0c8599", "#5c940d", "#495057"];
const pl = pid => T.players.find(p => p.pid === pid) || (ME && pid === ME.pid ? ME : { pid, name: "?", color: "#888" });
const av = (p, title) => `<span class="av" style="background:${esc(p.color || "#888")}" title="${esc(title || p.name || "")}">${p.img ? `<img src="${esc(p.img)}" alt="">` : esc((p.name || "?").slice(0, 1).toUpperCase())}</span>`;
function meBtn() { document.getElementById("mebtn").innerHTML = ME ? av(ME) : "🙂"; }
function showJoin() {
  const w = document.getElementById("joinwin"), cur = ME || { name: "", color: COLORS[Math.floor(Math.random() * COLORS.length)], img: "" };
  w.classList.remove("hidden");
  w.innerHTML = `<div class="lw"><h3>Who are you?</h3><p style="margin:0 0 8px;font-size:14px">Your character's name and colour — they show next to the loot you claim.</p>
    <input id="jname" value="${esc(cur.name)}" placeholder="Character name" style="width:100%;font-size:17px">
    <div style="margin:10px 0">${COLORS.map(c => `<span class="swatch ${c === cur.color ? "on" : ""}" style="background:${c}" data-c="${c}"></span>`).join(" ")}</div>
    <div class="row"><span id="jimg">${cur.img ? `<img src="${cur.img}" style="width:44px;height:44px;border-radius:50%;object-fit:cover">` : ""}</span><button class="ghost" id="jpic">🖼 Picture (optional)</button></div>
    <div class="row" style="margin-top:12px;justify-content:flex-end">${ME ? `<button class="ghost" id="jcancel">Cancel</button>` : ""}<button id="jok">OK</button></div></div>`;
  let color = cur.color, img = cur.img;
  w.querySelectorAll(".swatch").forEach(s => s.onclick = () => { color = s.dataset.c; w.querySelectorAll(".swatch").forEach(x => x.classList.toggle("on", x === s)); });
  w.querySelector("#jpic").onclick = () => { const f = document.createElement("input"); f.type = "file"; f.accept = "image/*"; f.onchange = async () => {
    const bmp = await createImageBitmap(f.files[0]), k = 96 / Math.min(bmp.width, bmp.height), cv = document.createElement("canvas"); cv.width = cv.height = 96;
    cv.getContext("2d").drawImage(bmp, (96 - bmp.width * k) / 2, (96 - bmp.height * k) / 2, bmp.width * k, bmp.height * k); img = cv.toDataURL("image/jpeg", 0.7);
    w.querySelector("#jimg").innerHTML = `<img src="${img}" style="width:44px;height:44px;border-radius:50%;object-fit:cover">`; }; f.click(); };
  if (w.querySelector("#jcancel")) w.querySelector("#jcancel").onclick = () => w.classList.add("hidden");
  w.querySelector("#jok").onclick = async () => {
    const name = w.querySelector("#jname").value.trim(); if (!name) return w.querySelector("#jname").focus();
    ME = { pid: ME?.pid || "p" + Math.random().toString(36).slice(2, 10), name, color, img };
    try { localStorage.setItem("tablePlayer", JSON.stringify(ME)); } catch (e) { }
    await join(); w.classList.add("hidden"); meBtn(); lootUpdate();
  };
}
async function join() { if (!ME) return; if (PEER) return sendOnline({ t: "join", p: ME }); try { await fetch("/api/player/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ME) }); } catch (e) { } }

// ---------- loot window ----------
const mine = o => o.kind === "player" ? ME && o.to === ME.pid : true;
function lootUpdate() {
  const list = T.offers.filter(mine), open = list.filter(o => !o.done);
  const b = document.getElementById("lootbadge"); b.textContent = open.length; b.classList.toggle("hidden", !open.length);
  const ids = list.map(o => o.id).join(",");
  if (T.seenOffers !== null && ids !== T.seenOffers && list.some(o => !T.seenOffers.includes(o.id))) document.getElementById("lootwin").classList.remove("hidden");
  T.seenOffers = ids;
  if (!document.getElementById("lootwin").classList.contains("hidden")) drawLoot();
}
function coinsText(c) { return ["pp", "gp", "ep", "sp", "cp"].filter(k => +(c || {})[k]).map(k => `${c[k]} ${k}`).join(", "); }
function drawLoot() {
  const w = document.getElementById("lootwin"), list = T.offers.filter(mine);
  if (!ME) { w.innerHTML = `<div class="lw"><p>Tell us who you are first.</p><button onclick="showJoin()">OK</button></div>`; return; }
  w.innerHTML = (list.length ? list.map(o => {
    const items = o.items || [], members = o.members || [], myItems = items.filter(it => o.claims[it.id] === ME.pid), share = o.shares ? o.shares[ME.pid] : null;
    return `<div class="lw"><div class="row"><h3 style="flex:1">${o.kind === "player" ? "🎁 For you: " : "💰 "}${esc(o.title || "Loot")}</h3>${o.done ? `<span style="color:#2f9e44;font-weight:700">✔ shared out</span>` : ""}</div>
      ${coinsText(o.coins) ? `<div style="font-size:14px"><b>Coins:</b> ${coinsText(o.coins)}${o.shares ? ` · <b>your share:</b> ${coinsText(share) || "nothing"}${coinsText(o.leftover) ? ` (left over: ${coinsText(o.leftover)})` : ""}` : ""}
        ${o.kind !== "player" && !o.done ? ` <button class="small ghost" data-x="split" data-o="${o.id}">⚖ Split coins evenly</button>` : ""}</div>` : ""}
      ${items.map(it => { const who = o.claims[it.id], op = T.open[o.id + it.id];
        return `<div class="li"><div class="li-h" data-x="tog" data-k="${o.id + it.id}">${it.img ? `<img class="it" src="${esc(it.img)}" alt="">` : `<span style="font-size:26px">${it.kind === "magic" ? "✨" : it.kind === "gem" ? "💎" : it.kind === "art" ? "🏺" : "🎒"}</span>`}
          <div style="flex:1"><b>${esc(it.name)}</b>${+it.qty > 1 ? ` ×${it.qty}` : ""}<div>${it.rarity ? `<span class="rar" style="background:${RAR_COL[it.rarity] || "#555"}">${esc(it.rarity)}</span>` : ""}${it.attune ? ' <small>requires attunement</small>' : ""}${it.value ? ` <small>${it.value} gp</small>` : ""}</div></div>
          ${who ? av(pl(who), pl(who).name + " takes this") : ""}<span>${op ? "▾" : "▸"}</span></div>
          ${op ? `<div class="li-d">${esc(it.desc || "No description.")}</div>${it.cursed ? (it.identified ? `<div class="curse"><b>Cursed!</b> ${esc(it.curse || "")}</div>` : "") : ""}
            ${o.kind !== "player" && !o.done ? `<div class="row" style="margin-top:6px"><button class="small ${who === ME.pid ? "ghost" : ""}" data-x="claim" data-o="${o.id}" data-i="${it.id}">${who === ME.pid ? "Give it back" : who ? "Take it instead" : "I take this"}</button></div>` : ""}
            ${it.magic !== false && !it.identified && it.kind === "magic" ? `<button class="small ghost" data-x="identify" data-o="${o.id}" data-i="${it.id}" title="Use when you cast Identify or study it during a short rest">🔍 Identify</button>` : ""}` : ""}</div>`; }).join("")}
      ${o.kind !== "player" ? `<div class="members"><small>Everybody must press OK:</small>${members.map(p => `<span class="mem ${o.oks[p] ? "ok" : ""}">${av(pl(p))}${esc(pl(p).name)}${o.oks[p] ? " ✓" : ""}</span>`).join("")}</div>` : ""}
      <div class="row" style="margin-top:10px;justify-content:flex-end">
        ${!o.done && o.kind !== "player" ? `<button data-x="ok" data-o="${o.id}">${o.oks[ME.pid] ? "Wait, not yet" : "✔ OK, fine with me"}</button>` : ""}
        ${(o.done || o.kind === "player") && (myItems.length || coinsText(share)) ? `<button data-x="add" data-o="${o.id}">➕ Add ${myItems.length ? myItems.length + " item" + (myItems.length > 1 ? "s" : "") : ""}${myItems.length && coinsText(share) ? " + " : ""}${coinsText(share) ? "coins" : ""} to my character</button>` : ""}
        ${o.done && !myItems.length && !coinsText(share) ? `<small>Nothing for you this time.</small>` : ""}</div></div>`;
  }).join("") : `<div class="lw"><p>No loot or items from the DM right now.</p></div>`) + `<div style="text-align:center"><button class="ghost" style="color:#fff" data-x="close">Close</button></div>`;
}
async function act(o, a, item) { if (PEER) return sendOnline({ t: "act", oid: o, pid: ME.pid, act: a, item }); try { await fetch("/api/offer/act", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ oid: o, pid: ME.pid, act: a, item }) }); } catch (e) { } }
async function gz64(obj) {
  const buf = await new Response(new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
  const b = new Uint8Array(buf); let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function addToCharacter(o) {
  const items = (o.items || []).filter(it => o.claims[it.id] === ME.pid).map(it => ({ name: it.name, qty: it.qty || 1, rarity: it.rarity || "", attune: !!it.attune, desc: it.desc || "", curse: it.identified ? it.curse || "" : "", img: it.img || "", weapon: it.weapon || null, value: it.value || 0 }));
  const data = await gz64({ v: 1, from: "DM", title: o.title || "Loot", items, coins: o.shares ? o.shares[ME.pid] : (o.kind === "player" ? o.coins : null), forName: ME.name });
  window.open(window.BUILDER_URL + "#dmloot=" + data, "_blank");
}
document.addEventListener("click", e => {
  const el = e.target.closest("[data-x]"); if (!el) return;
  const x = el.dataset.x;
  if (x === "tog") { T.open[el.dataset.k] = !T.open[el.dataset.k]; drawLoot(); }
  else if (x === "close") document.getElementById("lootwin").classList.add("hidden");
  else if (x === "add") { const o = T.offers.find(k => k.id === el.dataset.o); if (o) addToCharacter(o); if (o && o.kind === "player" && !o.done) act(o.id, "ok"); }
  else act(el.dataset.o, x, el.dataset.i);
});
document.getElementById("lootbtn").onclick = () => { const w = document.getElementById("lootwin"); w.classList.toggle("hidden"); if (!w.classList.contains("hidden")) drawLoot(); };
document.getElementById("mebtn").onclick = showJoin;

MapView.bind(board, () => ({ map: T.map, z: T.z }), async (id, x, y) => {
  const t = T.map.tokens.find(k => k.id === id); if (t) { t.x = x; t.y = y; } draw();
  if (PEER) return sendOnline({ t: "move", id, x, y });
  try { await fetch("/api/table/move", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, x, y }) }); } catch (e) { }
}, null);
board.addEventListener("pointerdown", e => { if (e.target.closest(".tok")) T.dragging = true; });
window.addEventListener("pointerup", () => { setTimeout(() => { T.dragging = false; }, 50); });
document.getElementById("zin").onclick = () => { T.fitMode = false; T.z = (T.z || 1) * 1.25; draw(); };
document.getElementById("zout").onclick = () => { T.fitMode = false; T.z = (T.z || 1) / 1.25; draw(); };
document.getElementById("zfit").onclick = () => { T.fitMode = true; draw(); };
window.addEventListener("resize", () => { if (T.fitMode) draw(); });
meBtn();
// start the live connection only once the page has finished loading — otherwise phone browsers keep
// showing the loading bar for as long as the connection stays open
function start() { if (ME) join(); else showJoin(); setInterval(join, 45000); setTimeout(poll, 50); }
if (document.readyState === "complete") start(); else window.addEventListener("load", start);
