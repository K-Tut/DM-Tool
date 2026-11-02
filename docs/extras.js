"use strict";
/* ============ Overview extras: node pictures (paste with Ctrl+V), monsters per map, floating secrets / monsters window,
   NPC stat blocks ============ */

// ---------- small pictures ----------
async function smallImage(blob, max = 480, q = 0.65) {
  const bmp = await createImageBitmap(blob); const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(bmp, 0, 0, cv.width, cv.height);
  return cv.toDataURL("image/jpeg", q);
}
function pickFile(accept = "image/*") { return new Promise(res => { const f = document.createElement("input"); f.type = "file"; f.accept = accept; f.onchange = () => res(f.files[0] || null); f.click(); }); }
const nodeById = id => (doc()?.nodes || []).find(n => n.id === id);
MODALS.img = () => `<div style="text-align:center"><img src="${S.modal.src}" style="max-width:100%;max-height:78vh;border-radius:8px"></div><div class="foot"><button data-act="closeModal">Close</button></div>`;
// Ctrl+V: a copied picture goes to the open node (or the monster being edited)
document.addEventListener("paste", async e => {
  if (typeof MM !== "undefined" && MM.st) return;
  const it = [...(e.clipboardData?.items || [])].find(x => x.type.startsWith("image/")); if (!it) return;
  const blob = it.getAsFile(); if (!blob) return;
  if (S.modal?.type === "myitem") { e.preventDefault(); S.modal.d.img = await smallImage(blob, 520, 0.8); renderModal(); return toast("Picture set"); }
  if (S.modal?.type === "editmon") { e.preventDefault(); readEditMon(); S.modal.d.image = await smallImage(blob, 600, 0.8); renderModal(); return toast("Picture set"); }
  const nd = S.view === "scen" && S.tab === "overview" || S.view === "home" ? nodeById(S.ui.popEditing || S.ui.openNode || S.ui.popNode) : null;
  if (!nd) return toast("Open a node first, then paste the picture");
  e.preventDefault(); (nd.images ||= []).push(await smallImage(blob)); save(); render(); toast("Picture added to #" + nd.n);
});

// ---------- monsters next to a map ----------
function blockMonsters(b) {
  const sc = S.scen, list = (b.monsters || []).map(id => sc.monsters.find(m => m.id === id)).filter(Boolean), q = norm((S.ui.bmonQ || {})[b.id] || "");
  return `<div class="bmons"><div class="row"><b>👹 Monsters here</b><a href="#" class="right small" data-act="blockMons" data-id="${b.id}">hide</a></div>
    ${list.map(m => `<div class="bmon">${monThumb(m)}<a href="#" class="monlink grow" data-act="monPeek" data-id="${m.id}">${esc(monName(m))}</a><span class="small muted">${monCr(m) ? "CR " + esc(monCr(m)) : ""}</span><a href="#" class="small" data-act="bmonDel" data-b="${b.id}" data-m="${m.id}" title="Remove from this map">✕</a></div>`).join("") || '<p class="small muted">No monsters listed for this map yet.</p>'}
    ${sc.monsters.filter(m => !(b.monsters || []).includes(m.id)).length ? `<select data-act="bmonPick" data-b="${b.id}"><option value="">＋ from this scenario…</option>${sc.monsters.filter(m => !(b.monsters || []).includes(m.id)).map(m => `<option value="${m.id}">${esc(monName(m))}</option>`).join("")}</select>` : ""}
    ${(S.mon.list || []).length ? `<input placeholder="🔍 add from the compendium…" value="${esc((S.ui.bmonQ || {})[b.id] || "")}" data-act-input="bmonQ" data-b="${b.id}" style="width:100%;margin-top:6px"><div id="bmonres-${b.id}">${bmonResults(b, q)}</div>` : ""}</div>`;
}
function bmonResults(b, q) {
  if (!q) return "";
  return (S.mon.list || []).filter(m => norm(m.name).includes(q)).sort((a, c) => (a.ed === "2024" ? 0 : 1) - (c.ed === "2024" ? 0 : 1) || a.name.localeCompare(c.name)).slice(0, 12)
    .map(m => `<div class="bmonres"><span class="grow">${esc(m.name)} <span class="small muted">${m.cr ? "CR " + esc(m.cr) : ""} · ${esc(m.ed || "")}</span></span><button class="small ghost" data-act="bmonComp" data-b="${b.id}" data-k="${esc(monKey(m))}">＋</button></div>`).join("") || '<p class="small muted">Nothing found.</p>';
}
// add a compendium monster to the scenario (once) and return it
function scenMonFor(key) { let sm = S.scen.monsters.find(m => m.ref === key); if (!sm) { const e = S.mon.byKey[key]; sm = { id: uid(), ref: key, name: e.name, count: 1, group: "", notes: "" }; S.scen.monsters.push(sm); } return sm; }

// ---------- floating window: secrets & clues / all monsters (overview page) ----------
function panelPrefs() { if (!S.ui.panel) { let p = null; try { p = JSON.parse(localStorage.getItem("dmPanel") || "null"); } catch (e) { } S.ui.panel = p || { open: true, pin: "screen", x: null, y: 120, tab: "secrets", min: window.innerWidth < 800 }; } return S.ui.panel; }
function savePanel() { try { localStorage.setItem("dmPanel", JSON.stringify(S.ui.panel)); } catch (e) { } }
function secretRow(s, i, compact) {
  const it = s.item ? (S.items.byKey?.[s.item] || { name: s.itemName || "Magic item" }) : null;
  return `<div class="secret ${s.done ? "done" : ""}"><input type="checkbox" data-act="secTick" data-i="${i}" ${s.done ? "checked" : ""}>
    <div class="grow">${it ? `<a href="#" data-act="secItem" data-k="${esc(s.item)}">💎 ${esc(it.name)}</a>${s.text && s.text !== it.name ? " — " : ""}` : ""}${s.text && (!it || s.text !== it.name) ? richText(s.text).replace(/<p style="margin:0 0 5px">/g, "<span>").replace(/<\/p>/g, "</span><br>").replace(/<br>$/, "") : ""}</div>
    ${compact ? "" : `<a href="#" data-act="secEdit" data-i="${i}" title="Edit">✎</a>`}<a href="#" data-act="delSecret" data-i="${i}" title="Delete">✕</a></div>`;
}
function vPanel() {
  const P = panelPrefs(), sc = S.scen; if (!sc || S.view !== "scen" || S.tab !== "overview") return "";
  if (!P.open) return `<button class="panelfab" data-act="panelOpen" title="Secrets & monsters">📜</button>`;
  const left = P.x == null ? "calc(100% - 330px)" : P.x + "px";
  const body = P.min ? "" : P.tab === "secrets"
    ? `<div class="pbody">${sc.secrets.map((s, i) => secretRow(s, i, true)).join("") || '<p class="small muted">No secrets yet.</p>'}
        <div class="row" style="margin-top:6px;gap:4px"><input id="panSecret" placeholder="New secret or clue…" style="flex:1;min-width:0"><button class="small" data-act="addSecret" data-src="panSecret">＋</button></div></div>`
    : `<div class="pbody">${sc.monsters.map(m => `<div class="bmon">${monThumb(m)}<a href="#" class="monlink grow" data-act="monPeek" data-id="${m.id}">${esc(monName(m))}</a><span class="small muted">${monCr(m) ? "CR " + esc(monCr(m)) : ""}</span></div>`).join("") || '<p class="small muted">No monsters in this scenario yet.</p>'}</div>`;
  return `<div id="dmpanel" class="dmpanel ${P.pin}" style="left:${left};top:${P.y}px">
    <div class="phead" data-drag="panel"><span class="ptabs"><button class="${P.tab === "secrets" ? "on" : ""}" data-act="panelTab" data-k="secrets">📜 Secrets (${sc.secrets.filter(s => !s.done).length})</button><button class="${P.tab === "mons" ? "on" : ""}" data-act="panelTab" data-k="mons">👹 Monsters</button></span>
      <span class="pbtns"><button data-act="panelPin" title="${P.pin === "screen" ? "Pinned to the screen (stays when you scroll) — click to pin it to the page" : "Pinned to the page (scrolls away) — click to pin it to the screen"}">${P.pin === "screen" ? "📌" : "📄"}</button><button data-act="panelMin" title="${P.min ? "Expand" : "Minimise"}">${P.min ? "▢" : "–"}</button><button data-act="panelClose" title="Hide">✕</button></span></div>${body}</div>`;
}
function drawPanel() {
  let host = document.getElementById("panelhost"); if (!host) { host = document.createElement("div"); host.id = "panelhost"; document.body.appendChild(host); }
  host.innerHTML = vPanel();
}
(() => {   // drag the window by its title bar
  let d = null;
  document.addEventListener("pointerdown", e => { const h = e.target.closest("[data-drag=panel]"); if (!h || e.target.closest("button")) return; const el = document.getElementById("dmpanel"), r = el.getBoundingClientRect();
    d = { dx: e.clientX - r.left, dy: e.clientY - r.top }; e.preventDefault(); });
  document.addEventListener("pointermove", e => { if (!d) return; const el = document.getElementById("dmpanel"), P = panelPrefs(), sy = P.pin === "page" ? window.scrollY : 0;
    P.x = Math.max(0, Math.min(window.innerWidth - 120, e.clientX - d.dx)); P.y = Math.max(0, e.clientY - d.dy + sy); el.style.left = P.x + "px"; el.style.top = P.y + "px"; });
  document.addEventListener("pointerup", () => { if (d) { d = null; savePanel(); } });
})();

// ---------- NPC stat block ----------
function npcStatBox(n, i) {
  const sm = S.scen.monsters.find(m => m.id === n.mon), q = norm(S.ui.npcMonQ || "");
  return `<div class="npcstat"><div class="row small"><b>⚔ Stat block</b>${sm ? `<span>${esc(monName(sm))}</span><button class="small ghost" data-act="npcCombat" data-id="${n.id}">⚔ Add to combat</button><button class="small ghost" data-act="editMon" data-id="${sm.id}">✎ Edit as copy</button><a href="#" data-act="npcMonDel" data-id="${n.id}">remove</a>` : '<span class="muted">none yet — choose one so they are ready if it comes to a fight</span>'}</div>
    ${sm ? `<details ${S.ui.npcSbOpen === n.id ? "open" : ""}><summary class="small">show stat block</summary>${statBlock(sm)}</details>` : `<div class="row small">${S.scen.monsters.length ? `<select data-act="npcMonPick" data-id="${n.id}"><option value="">from this scenario…</option>${S.scen.monsters.map(m => `<option value="${m.id}">${esc(monName(m))}</option>`).join("")}</select>` : ""}
      ${(S.mon.list || []).length ? `<input placeholder="🔍 or search the compendium (e.g. Noble, Mage, Veteran)" value="${esc(S.ui.npcMonQ || "")}" data-act-input="npcMonQ" data-id="${n.id}" style="flex:1;min-width:180px">` : ""}</div><div id="npcmonres-${n.id}">${npcMonResults(n, q)}</div>`}</div>`;
}
function npcMonResults(n, q) {
  if (!q) return "";
  return (S.mon.list || []).filter(m => norm(m.name).includes(q)).sort((a, c) => (a.ed === "2024" ? 0 : 1) - (c.ed === "2024" ? 0 : 1) || a.name.localeCompare(c.name)).slice(0, 10)
    .map(m => `<div class="bmonres"><span class="grow">${esc(m.name)} <span class="small muted">${m.cr ? "CR " + esc(m.cr) : ""} · ${esc(m.ed || "")}</span></span><button class="small ghost" data-act="npcMonComp" data-id="${n.id}" data-k="${esc(monKey(m))}">use</button></div>`).join("") || '<p class="small muted">Nothing found.</p>';
}

Object.assign(ACT, {
  nodeImgAdd: async el => { const f = await pickFile(); if (!f) return; const nd = nodeById(el.dataset.id); (nd.images ||= []).push(await smallImage(f)); save(); render(); },
  nodeImgDel: (el, e) => { e.stopPropagation(); const nd = nodeById(el.dataset.id); nd.images.splice(+el.dataset.k, 1); save(); render(); },
  nodeImgView: (el, e) => { e.stopPropagation(); const nd = nodeById(el.dataset.id); S.modal = { type: "img", src: nd.images[+el.dataset.k] }; renderModal(); },
  blockFold: el => { const b = S.scen.blocks.find(x => x.id === el.dataset.id); b.closed = !b.closed; if (!b.closed && b.type === "map") (S.ui.z ||= {})[b.id] = null; save(); render(); },
  blockMons: (el, e) => { e?.preventDefault?.(); const o = S.ui.bmons ||= {}; o[el.dataset.id] = !o[el.dataset.id]; render(); },
  bmonDel: el => { const b = S.scen.blocks.find(x => x.id === el.dataset.b); b.monsters = (b.monsters || []).filter(id => id !== el.dataset.m); save(); render(); },
  bmonComp: el => { const b = S.scen.blocks.find(x => x.id === el.dataset.b), sm = scenMonFor(el.dataset.k); b.monsters ||= []; if (!b.monsters.includes(sm.id)) b.monsters.push(sm.id); save(); render(); toast(monName(sm) + " added"); },
  panelOpen: () => { panelPrefs().open = true; savePanel(); drawPanel(); },
  panelClose: () => { panelPrefs().open = false; savePanel(); drawPanel(); },
  panelMin: () => { const P = panelPrefs(); P.min = !P.min; savePanel(); drawPanel(); },
  panelTab: el => { const P = panelPrefs(); P.tab = el.dataset.k; P.min = false; savePanel(); drawPanel(); },
  panelPin: () => { const P = panelPrefs(), el = document.getElementById("dmpanel"), r = el.getBoundingClientRect();
    P.pin = P.pin === "screen" ? "page" : "screen"; P.x = r.left; P.y = P.pin === "page" ? r.top + window.scrollY : r.top; savePanel(); drawPanel();
    toast(P.pin === "screen" ? "Pinned to the screen: it stays put when you scroll" : "Pinned to the page: it scrolls with the page"); },
  secEdit: el => { S.ui.secEdit = S.ui.secEdit === +el.dataset.i ? null : +el.dataset.i; render(); },
  secItem: (el, e) => { e.stopPropagation(); S.modal = { type: "secitem", k: el.dataset.k }; renderModal(); },
  secItemAdd: el => { const it = S.items.byKey?.[el.dataset.k]; if (!it) return; S.scen.secrets.push({ id: uid(), text: "", item: el.dataset.k, itemName: it.name, done: false }); S.ui.secItemQ = ""; save(); render(); toast(it.name + " added to the secrets"); },
  npcMonDel: el => { const n = S.scen.npcs.find(x => x.id === el.dataset.id); delete n.mon; save(); render(); },
  npcMonComp: el => { const n = S.scen.npcs.find(x => x.id === el.dataset.id), sm = scenMonFor(el.dataset.k); sm.group ||= "NPCs"; n.mon = sm.id; S.ui.npcMonQ = ""; save(); render(); },
  npcCombat: el => { const n = S.scen.npcs.find(x => x.id === el.dataset.id), sm = S.scen.monsters.find(m => m.id === n.mon); if (!sm) return;
    const f = addFighter(sm); f.name = n.name; f.npc = n.id; save(); render(); toast(`${n.name} joins the fight — initiative ${f.init}`); }
});
MODALS.secitem = () => `${S.items.byKey?.[S.modal.k] ? itemBlock(S.modal.k) : '<p class="muted">This item’s description is not on this device (import the magic items, or load a backup that has them).</p>'}<div class="foot">${S.modal.back ? `<button class="ghost" data-act="modalBack">← Back</button>` : ""}<button data-act="closeModal">Close</button></div>`;
Object.assign(CHG, {
  secTick: el => { const s = S.scen.secrets[+el.dataset.i]; s.done = el.checked; save(); },
  bmonPick: el => { if (!el.value) return; const b = S.scen.blocks.find(x => x.id === el.dataset.b); (b.monsters ||= []).push(el.value); save(); },
  npcMonPick: el => { if (!el.value) return; const n = S.scen.npcs.find(x => x.id === el.dataset.id); n.mon = el.value; save(); }
});
document.addEventListener("input", e => {
  const el = e.target, a = el.dataset.actInput;
  if (a === "bmonQ") { (S.ui.bmonQ ||= {})[el.dataset.b] = el.value; const b = S.scen.blocks.find(x => x.id === el.dataset.b); document.getElementById("bmonres-" + b.id).innerHTML = bmonResults(b, norm(el.value)); }
  if (a === "npcMonQ") { S.ui.npcMonQ = el.value; const n = S.scen.npcs.find(x => x.id === el.dataset.id); document.getElementById("npcmonres-" + n.id).innerHTML = npcMonResults(n, norm(el.value)); }
  if (a === "secItemQ") { S.ui.secItemQ = el.value; document.getElementById("secitemres").innerHTML = secItemResults(norm(el.value)); }
});
function secItemResults(q) {
  if (!q) return "";
  const all = [...(S.items.list || []).map(it => ({ k: itemKey(it), name: it.name, sub: [it.type, it.rarity].filter(Boolean).join(", ") }))];
  return all.filter(x => norm(x.name).includes(q)).slice(0, 12).map(x => `<div class="bmonres"><span class="grow">💎 ${esc(x.name)} <span class="small muted">${esc(x.sub)}</span></span><button class="small ghost" data-act="secItemAdd" data-k="${esc(x.k)}">＋ add</button></div>`).join("") || '<p class="small muted">Nothing found.</p>';
}
