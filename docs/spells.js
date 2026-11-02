"use strict";
/* ============ Spell list (from the Character Builder's rules text) + "Edit monster as copy" ============ */
const MODALS = window.MODALS || (window.MODALS = {});

// ---------- spell library ----------
async function loadSpells() { S.spells = (await DDB.get("spells")) || { list: [] }; indexSpells(); }
function indexSpells() { S.spellIdx = {}; (S.spells.list || []).forEach(s => S.spellIdx[norm(s.name)] = s); }
async function setSpells(o) {
  const list = (o.list || []).filter(s => s && s.name).map(s => ({ name: s.name, level: +s.level || 0, school: s.school || "", time: s.time || "", range: s.range || "", comp: s.comp || "", dur: s.dur || "", text: s.text || "", classes: s.classes || [], conc: !!s.conc, ritual: !!s.ritual }))
    .sort((a, b) => a.name.localeCompare(b.name));
  S.spells = { list, imported: o.imported || new Date().toISOString().slice(0, 10), source: o.source || "" };
  await DDB.set("spells", S.spells); indexSpells();
}
function spellInfo(name) { return S.spellIdx?.[norm(name)] || null; }
const SpellLock = {   // same encryption as the Character Builder's wiki.enc
  unb64(s) { const bin = atob(s); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b; },
  async decrypt(enc, pw) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: this.unb64(enc.salt), iterations: enc.iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    let gz; try { gz = await crypto.subtle.decrypt({ name: "AES-GCM", iv: this.unb64(enc.iv) }, key, this.unb64(enc.data)); } catch (e) { throw new Error("Wrong password"); }
    return JSON.parse(await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"))).text());
  }
};
async function spellsFromAny(j) {
  if (j && j.format === "dnd-builder-wiki-v1") {
    let pw = null; try { pw = localStorage.getItem("wikiPw"); } catch (e) { }
    let w = null;
    if (pw) { try { w = await SpellLock.decrypt(j, pw); } catch (e) { } }
    if (!w) { pw = prompt("Password of the rules text (the same one you use in the Character Builder):"); if (!pw) return null; w = await SpellLock.decrypt(j, pw); }
    j = w;
  }
  const sp = j?.spells; if (!sp) throw new Error("No spells in this file");
  return { list: Array.isArray(sp) ? sp : Object.values(sp), imported: j.imported || "" };
}
function spellsCard() {
  const n = (S.spells.list || []).length;
  return `<div class="card"><h3>Spell list</h3>
    <p class="small">${n ? `<b>${n}</b> spells (from the Character Builder's rules text${S.spells.imported ? ", " + esc(String(S.spells.imported).slice(0, 10)) : ""}).` : "No spells on this device yet."} Used when you edit a monster and give it spells, and to read spell descriptions.</p>
    <div class="row"><button class="small" data-act="spLoadBuilder">${n ? "Reload" : "Load"} spells from the Character Builder</button><button class="small ghost" data-act="spLoadFile">Load wiki.json / wiki.enc file</button></div>
    <p class="small muted" style="margin:6px 0 0">${S.server ? "On the laptop this reads <code>dnd-builder/data/wiki.json</code> (the DM Tool folder must sit next to the dnd-builder folder, or copy wiki.json into the DM Tool's <code>data</code> folder)." : "On the phone this opens the Character Builder's <code>wiki.enc</code> from GitHub with the password you use there."} The spells also travel in the backup file.</p></div>`;
}
MODALS.spell = () => {
  const s = spellInfo(S.modal.name);
  if (!s) return `<h2>${esc(S.modal.name)}</h2><p class="muted">This spell is not in the spell list on this device. Load the spell list on the start page.</p><div class="foot"><button data-act="closeModal">Close</button></div>`;
  return `<div class="statblock aidedd"><h1>${esc(s.name)}</h1><div class="type">${s.level ? "Level " + s.level + " " : ""}${esc(s.school)}${s.level ? "" : " cantrip"}${s.conc ? " · Concentration" : ""}${s.ritual ? " · Ritual" : ""}</div>
    <div class="red small">${[s.time && "<strong>Casting time</strong> " + esc(s.time), s.range && "<strong>Range</strong> " + esc(s.range), s.comp && "<strong>Components</strong> " + esc(s.comp), s.dur && "<strong>Duration</strong> " + esc(s.dur)].filter(Boolean).join("<br>")}</div><hr>
    ${sbLinks(para(s.text), s.name)}</div><div class="foot">${S.modal.back ? `<button class="ghost" data-act="modalBack">← Back</button>` : ""}<button data-act="closeModal">Close</button></div>`;
};

// ---------- monster -> editable text ----------
function blockToText(sm) {
  const e = monEntry(sm), blk = e ? S.mon.blocks[sm.ref] : null;
  if (typeof blk !== "string") return Array.isArray(blk) ? blk.join("\n") : (sm.custom?.text || "");
  const d = document.createElement("div"); d.innerHTML = blk.replace(/<br\s*\/?>/gi, "\n");
  const lines = [];
  const add = t => String(t).split("\n").map(x => x.replace(/\s+/g, " ").trim()).filter(Boolean).forEach(x => lines.push(x));
  let abil = [];
  const flush = () => { if (abil.length) { lines.push(abil.join("  ")); abil = []; } };
  d.childNodes.forEach(n => {
    if (n.nodeType === 1 && n.matches(".carac")) { abil.push(n.textContent.replace(/\s+/g, " ").trim()); return; }
    if (n.nodeType === 3 && !n.nodeValue.trim()) return;
    flush();
    if (n.nodeType === 3) return add(n.nodeValue);
    if (n.nodeType !== 1 || n.matches("h1, .type, script, style")) return;
    if (n.matches(".red")) { add(n.textContent.split("\n").filter(l => /initiative/i.test(l)).map(l => (l.match(/Initiative.*/i) || [l])[0]).join("\n")); return; }
    if (n.matches("table") || n.querySelector?.("table")) { add(spacedText(n).replace(/\b(MOD|SAVE)\b/g, "")); return; }
    add(n.textContent);
  });
  flush();
  return lines.join("\n");
}
function monFields(sm) {
  const e = monEntry(sm), c = sm.custom || {};
  const blk = e ? S.mon.blocks[sm.ref] : null; let txt = "";
  if (typeof blk === "string") { const d = document.createElement("div"); d.innerHTML = blk.replace(/<br\s*\/?>/gi, "\n"); txt = d.textContent; }
  const pick = rx => (txt.match(rx) || [])[1] || "";
  return { name: monName(sm), size: c.size || e?.size || "", type: c.type || [e?.type, e?.align].filter(Boolean).join(", "), cr: monCr(sm), ac: c.ac || e?.ac || pick(/\bAC\s+(\d+[^\n]*?)(?:\s+Initiative|\n|$)/), hp: c.hp || e?.hp || pick(/\bHP\s+([^\n]+)/), speed: c.speed || e?.speed || pick(/\bSpeed\s+([^\n]+)/) };
}
MODALS.editmon = () => {
  const d = S.modal.d, sp = S.spells.list || [], q = norm(S.ui.spEdQ || "");
  const res = q ? sp.filter(s => norm(s.name).includes(q)).slice(0, 40) : [];
  const groups = {}; (d.spells || []).forEach((s, i) => (groups[s.freq] ||= []).push([s, i]));
  return `<h2>${S.modal.copy ? "Edit monster (saved as a copy)" : "Edit custom monster"}</h2>
    <div class="grid g2"><label>Name<br><input id="em_name" value="${esc(d.name)}" style="width:100%"></label><label>Size<br><input id="em_size" value="${esc(d.size || "")}"></label>
      <label>Type<br><input id="em_type" value="${esc(d.type || "")}"></label><label>CR<br><input id="em_cr" value="${esc(d.cr || "")}"></label>
      <label>AC<br><input id="em_ac" value="${esc(d.ac || "")}"></label><label>HP<br><input id="em_hp" value="${esc(d.hp || "")}" placeholder="e.g. 136 (16d10 + 48)"></label>
      <label>Speed<br><input id="em_speed" value="${esc(d.speed || "")}"></label></div>
    <div class="row" style="margin:8px 0">${d.image || (d.imgRef && S.mon.byKey[d.imgRef]?.img) ? `<img src="${esc(d.image || monImgSrc({ ref: d.imgRef }))}" referrerpolicy="no-referrer" style="width:72px;height:72px;object-fit:cover;object-position:top;border-radius:10px">` : `<span class="small muted">No picture</span>`}
      <button class="small ghost" data-act="emImg">🖼 Change picture</button>${d.image || d.imgRef ? `<button class="small ghost" data-act="emImgDel">Remove</button>` : ""}<span class="small muted">or copy a picture and press Ctrl+V</span></div>
    <label>Stat block (one line per entry; headings like <i>Actions</i> on their own line; “Name. text” for traits and actions)<br><textarea id="em_text" style="min-height:240px;font-size:13px">${esc(d.text || "")}</textarea></label>
    <h3 style="margin-top:12px">Spells</h3>
    <div class="row small"><label>Spell save DC <input id="em_dc" type="number" value="${esc(d.spellDc || "")}" style="width:60px"></label><label>Spell attack + <input id="em_atk" type="number" value="${esc(d.spellAtk || "")}" style="width:60px"></label></div>
    ${Object.entries(groups).map(([f, arr]) => `<div class="small" style="margin-top:4px"><b>${esc(f)}:</b> ${arr.map(([s, i]) => `<span class="chip">${esc(s.name)} <a href="#" data-act="emSpDel" data-i="${i}">✕</a></span>`).join("")}</div>`).join("") || '<p class="small muted">No spells yet.</p>'}
    <div class="row small" style="margin-top:6px"><input id="em_spq" placeholder="${sp.length ? "🔍 Search ${sp.length} spells…" : "Spell name (load the spell list on the start page to search)"}" value="${esc(S.ui.spEdQ || "")}" data-act-input="spEdQ" style="flex:1;min-width:160px">
      <select id="em_freq">${["At will", "1/day each", "2/day each", "3/day each", "Cantrips", "1st level", "2nd level", "3rd level", "4th level", "5th level", "6th level", "7th level", "8th level", "9th level"].map(f => `<option ${f === (S.ui.spFreq || "At will") ? "selected" : ""}>${f}</option>`).join("")}</select>
      ${sp.length ? "" : `<button class="small" data-act="emSpAddTyped">Add</button>`}</div>
    <div id="em_spres" class="spres">${spResults(res, d)}</div>
    <div class="foot"><button class="ghost" data-act="closeModal">Cancel</button>${S.modal.copy ? "" : `<button class="ghost" data-act="emSave" data-copy="1">Save as copy</button>`}<button data-act="emSave">${S.modal.copy ? "Save as new monster" : "Save"}</button></div>`;
};
function spResults(res, d) {
  return res.map(s => `<div class="spr"><a href="#" data-act="spellPeek" data-n="${esc(s.name)}">${esc(s.name)}</a> <span class="small muted">${s.level ? "lvl " + s.level : "cantrip"} · ${esc(s.school)}</span><button class="small ghost right" data-act="emSpAdd" data-n="${esc(s.name)}" ${(d.spells || []).some(x => x.name === s.name) ? "disabled" : ""}>＋ add</button></div>`).join("");
}
function readEditMon() {
  const d = S.modal.d, v = id => document.getElementById(id)?.value ?? "";
  Object.assign(d, { name: v("em_name").trim() || "Monster", size: v("em_size"), type: v("em_type"), cr: v("em_cr"), ac: v("em_ac"), hp: v("em_hp"), speed: v("em_speed"), text: v("em_text"), spellDc: v("em_dc"), spellAtk: v("em_atk") });
  S.ui.spFreq = v("em_freq") || S.ui.spFreq;
}
function openEditMon(sm) {
  const copy = !!sm.ref || !sm.custom;
  const d = copy ? { ...monFields(sm), text: blockToText(sm), spells: [], imgRef: monImgRef(sm) } : clone(sm.custom);
  if (copy) d.name = monName(sm) + " (edited)";
  d.spells ||= [];
  S.ui.spEdQ = ""; S.modal = { type: "editmon", d, copy, id: sm.id }; renderModal();
}
// spells of a custom monster, shown at the end of its stat block
function monSpellsHtml(c) {
  if (!c || !(c.spells || []).length) return "";
  const groups = {}; c.spells.forEach(s => (groups[s.freq] ||= []).push(s.name));
  const head = [c.spellDc && "spell save DC " + c.spellDc, c.spellAtk && sgn(+c.spellAtk) + " to hit with spell attacks"].filter(Boolean).join(", ");
  return `<div class="rub">Spells</div>${head ? `<p><em>${esc(cap(head))}.</em>${c.spellAtk ? ` <a href="#" class="dicelink" data-act="roll" data-k="d20" data-m="${+c.spellAtk}" data-t="Spell attack">🎲${sgn(+c.spellAtk)}</a>` : ""}</p>` : ""}
    ${Object.entries(groups).map(([f, ns]) => `<p><strong><em>${esc(f)}:</em></strong> ${ns.map(n => `<a href="#" class="spelllink" data-act="spellPeek" data-n="${esc(n)}">${esc(n)}</a>`).join(", ")}</p>`).join("")}`;
}

Object.assign(ACT, {
  modalBack: () => { S.modal = S.modal?.back || null; renderModal(); },
  spellPeek: (el, e) => { e.stopPropagation(); const back = S.modal && S.modal.type !== "spell" ? S.modal : S.modal?.back; if (S.modal?.type === "editmon") readEditMon(); S.modal = { type: "spell", name: el.dataset.n, back }; renderModal(); },
  spLoadBuilder: async () => {
    try {
      let o;
      if (S.server) { const j = await api("api/spells"); if (!(j.list || []).length) return toast(j.error || "No spells found"); o = { list: j.list, imported: j.imported }; }
      else {
        let j = null;
        for (const u of ["../Character-Builder/wiki.enc", "/Character-Builder/wiki.enc"]) { try { const r = await fetch(u, { cache: "no-store" }); if (r.ok) { j = await r.json(); break; } } catch (e) { } }
        if (!j) return toast("Could not reach the Character Builder's wiki.enc — use “Load file” instead");
        o = await spellsFromAny(j); if (!o) return;
      }
      await setSpells(o); render(); toast(S.spells.list.length + " spells loaded");
    } catch (e) { toast(e.message || "Could not load the spells"); }
  },
  spLoadFile: () => { const f = document.createElement("input"); f.type = "file"; f.accept = ".json,.enc,application/json"; f.onchange = async () => {
    try { const o = await spellsFromAny(JSON.parse(await f.files[0].text())); if (!o) return; await setSpells(o); render(); toast(S.spells.list.length + " spells loaded"); } catch (e) { toast(e.message || "Not a wiki file"); } }; f.click(); },
  editMon: (el, e) => { e?.stopPropagation?.(); const sm = S.scen.monsters.find(m => m.id === el.dataset.id); if (sm) openEditMon(sm); },
  emImg: async () => { readEditMon(); const f = await pickFile(); if (!f) return; S.modal.d.image = await smallImage(f, 600, 0.8); renderModal(); },
  emImgDel: () => { readEditMon(); delete S.modal.d.image; delete S.modal.d.imgRef; renderModal(); },
  emSpAdd: el => { readEditMon(); const d = S.modal.d; if (!d.spells.some(s => s.name === el.dataset.n)) d.spells.push({ name: el.dataset.n, freq: S.ui.spFreq || "At will" }); renderModal(); },
  emSpAddTyped: () => { readEditMon(); const n = ($("#em_spq").value || "").trim(); if (!n) return; S.modal.d.spells.push({ name: n, freq: S.ui.spFreq || "At will" }); S.ui.spEdQ = ""; renderModal(); },
  emSpDel: el => { readEditMon(); S.modal.d.spells.splice(+el.dataset.i, 1); renderModal(); },
  emSave: el => {
    readEditMon(); const d = clone(S.modal.d), asCopy = S.modal.copy || el.dataset.copy;
    const orig = S.scen.monsters.find(m => m.id === S.modal.id);
    if (asCopy) { const nm = { id: uid(), name: d.name, custom: d, count: 1, group: orig?.group || "", notes: orig?.notes || "" }; S.scen.monsters.push(nm); S.ui.openMon = nm.id; toast("Saved as " + d.name); }
    else if (orig) { orig.custom = d; orig.name = d.name; toast("Saved"); }
    SB_CACHE.clear(); S.modal = null; save(); render();
  }
});
document.addEventListener("input", e => {
  if (e.target.dataset.actInput === "spEdQ" && S.modal?.type === "editmon") { S.ui.spEdQ = e.target.value; const q = norm(e.target.value);
    $("#em_spres").innerHTML = spResults(q ? (S.spells.list || []).filter(s => norm(s.name).includes(q)).slice(0, 40) : [], S.modal.d); }
});
