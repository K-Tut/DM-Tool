"use strict";
/* ============ COMBAT: monsters in the fight with HP and an action summary, initiative list on the right ============
   S.scen.combat = { list: [ {id, kind:"mon", mid, name, init, hp, max, ac, used:{}, uses:{}} | {id, kind:"pc", name, init} ] } */
const ABIL_RX = "(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)";
const ABIL_SHORT = { strength: "Str", dexterity: "Dex", constitution: "Con", intelligence: "Int", wisdom: "Wis", charisma: "Cha" };
const ACT_CACHE = new Map();
function cbState() { return S.scen.combat ||= { list: [] }; }
const signed = s => { const n = parseInt(String(s).replace(/[−–]/, "-").replace(/\s/g, "")); return isNaN(n) ? 0 : n; };

// ---------- read a stat block into a short summary ----------
function monSummary(sm) {
  const html = statBlock(sm), key = sm.id + "\u0000" + html.length + "\u0000" + html.slice(0, 200);
  if (ACT_CACHE.has(key)) return ACT_CACHE.get(key);
  const root = document.createElement("div"); root.innerHTML = html;
  root.querySelectorAll("a.dicelink, a.sbroll").forEach(a => { a.textContent = a.textContent.replace(/🎲/g, ""); });
  const all = root.textContent.replace(/🎲/g, "").replace(/\s+/g, " ");
  const out = { init: 0, ac: "", hp: monHp(sm), sections: [], spells: (sm.custom?.spells || []).map(s => s.name), legendary: 0 };
  const im = all.match(/Initiative\s*([+−–-]\s?\d+)/i); const dm = all.match(/\bDex(?:terity)?\b\s*(\d+)\s*\(?\s*([+−–-]\s?\d+)/i);
  out.init = im ? signed(im[1]) : dm ? signed(dm[2]) : 0;
  const e = monEntry(sm); out.ac = sm.custom?.ac || e?.ac || (all.match(/\b(?:AC|Armor Class)\s*(\d+)/) || [])[1] || "";
  if (out.hp == null) { const h = all.match(/\b(?:HP|Hit Points)\s*(\d+)/); out.hp = h ? +h[1] : 10; }
  out.ac = String(out.ac).match(/\d+/)?.[0] || out.ac;
  let sec = "Traits";
  root.querySelectorAll(".rub, p").forEach(el => {
    if (el.classList.contains("rub")) { sec = el.textContent.trim(); return; }
    const t = el.textContent.replace(/🎲/g, "").replace(/\s+/g, " ").trim(); if (!t) return;
    const lm = t.match(/(?:Legendary Action Uses:\s*(\d+)|can take (\d+) legendary actions)/i); if (lm) { out.legendary = +(lm[1] || lm[2]); }
    if (!/^(actions|bonus actions|reactions|legendary actions|traits|spells)$/i.test(sec)) return;
    const nameEl = el.querySelector("strong, b"); if (!nameEl) return;
    let name = nameEl.textContent.replace(/\s+/g, " ").trim().replace(/[.:]\s*$/, ""); if (!name || t.indexOf(nameEl.textContent.trim()) > 3) return;
    const body = t.slice(t.indexOf(nameEl.textContent.trim()) + nameEl.textContent.trim().length).replace(/^[.:]\s*/, "");
    const a = { sec, name, text: body, key: norm(sec + " " + name).replace(/ /g, "_") };
    const rc = (name + " " + body.slice(0, 40)).match(/\(Recharge (\d)(?:\s*[–-]\s*\d)?\)/i); if (rc) a.recharge = +rc[1];
    else if (/\(Recharges? after a (?:Short|Long)/i.test(name + body.slice(0, 60))) a.recharge = "rest";
    const pd = (name + " " + body.slice(0, 30)).match(/\((\d+)\/Day(?: each)?\)/i); if (pd) a.perDay = +pd[1];
    a.short = name.replace(/\s*\((?:Recharge[^)]*|\d+\/Day[^)]*|Recharges[^)]*)\)/i, "").trim();
    const hit = body.match(/(?:Attack Roll|Weapon Attack|Spell Attack)[^:]{0,20}:\s*([+−–-]\s?\d+)/i) || body.match(/([+−–-]\s?\d+)\s*to hit(?! with spell)/i);
    const sv = body.match(new RegExp(ABIL_RX + " Saving Throw:\\s*DC\\s*(\\d+)", "i")) || (m => m ? [m[0], m[2], m[1]] : null)(body.match(new RegExp("DC\\s*(\\d+)\\s+" + ABIL_RX + " saving throw", "i")));
    if (/^multiattack/i.test(name)) a.kind = "multi";
    else if (/^(innate )?spellcasting/i.test(name)) a.kind = "other";
    else if (hit) { a.kind = "atk"; a.hit = signed(hit[1]); const hi = body.search(/\bHit\s*:/); a.parts = hi >= 0 ? dmgParts(body.slice(hi)) : []; }
    else if (sv) { a.kind = "save"; a.dc = +sv[2]; a.abil = ABIL_SHORT[sv[1].toLowerCase()]; const fi = body.search(/Failure:|failed save|takes|taking/i); a.parts = dmgParts(fi >= 0 ? body.slice(fi) : body); a.half = /Success:\s*Half|half as much damage/i.test(body); }
    else { a.kind = "other"; const dd = dmgParts(body); if (dd.length && /damage/i.test(body)) a.parts = dd; }
    const rr = body.match(/\b(reach \d+ ft\.?|range [\d/]+ ft\.?)/i); if (rr) a.reach = rr[1];
    const ar = body.match(/(\d+-foot[- ](?:Cone|Line|Sphere|Cube|Emanation|Cylinder|radius|line)[^,.;]{0,30})/i); if (ar) a.area = ar[1];
    if (a.kind === "other" && sec === "Traits" && !a.perDay && !a.recharge) return;   // plain traits stay in the full stat block
    (out.sections.find(s => s.name === sec) || (out.sections.push({ name: sec, acts: [] }), out.sections[out.sections.length - 1])).acts.push(a);
  });
  ACT_CACHE.set(key, out); return out;
}
// spell names in a text become links (when the spell list is loaded)
function spellLinkify(text) {
  let h = esc(text); const idx = S.spellIdx || {}; if (!Object.keys(idx).length) return h;
  return h.replace(/([A-Z][A-Za-z'’]+(?:\s(?:of|the|and|[A-Z][A-Za-z'’]+))*)/g, m => { for (let k = m.split(" ").length; k > 0; k--) { const sub = m.split(" ").slice(0, k).join(" "); const s = idx[norm(sub)];
      if (s) return `<a href="#" class="spelllink" data-act="spellPeek" data-n="${esc(s.name)}">${sub}</a>${m.slice(sub.length)}`; } return m; });
}
const dmgHtml = parts => parts.map(p => `${esc(p.f)}${p.type ? " " + dtIcon(p.type, "inl") : ""}`).join(" + ");

// ---------- view ----------
function vCombat() {
  const cb = cbState(), sc = S.scen;
  const order = cb.list.slice().sort((a, b) => (b.init - a.init) || ((b.kind === "pc") - (a.kind === "pc")));
  const mons = order.filter(f => f.kind === "mon");
  const cards = mons.map(cbCard).join("");
  const side = `<aside class="cbside card"><h3>Initiative</h3>
    ${order.map(f => { const dead = f.kind === "mon" && f.hp <= 0; return `<div class="cbi ${f.kind} ${dead ? "dead" : ""}"><input type="number" value="${f.init}" data-act="cbInit" data-id="${f.id}" title="Initiative">
      <span class="grow" ${f.kind === "mon" ? `data-act="cbGo" data-id="${f.id}" style="cursor:pointer"` : ""}>${f.kind === "pc" ? "🧝 " : dead ? "💀 " : ""}${esc(f.name)}</span>
      ${f.kind === "mon" ? `<small class="${f.hp <= f.max / 4 ? "warn" : "muted"}">${Math.max(0, f.hp)}/${f.max}</small>` : ""}<a href="#" data-act="cbDel" data-id="${f.id}" title="Remove">✕</a></div>`; }).join("") || '<p class="small muted">Nobody yet. Drag monsters in from below and add the players here.</p>'}
    ${(() => { const enc = cbEncounter(), dd = difficulty(enc); return dd ? `<div class="cbxp"><div class="row small"><b>${dd.base.toLocaleString()} XP</b><span class="muted">(${dd.count} monsters · adjusted ${dd.adj.toLocaleString()})</span></div>
      <div class="row small" style="margin-top:4px">${diffBadge(dd)}<span class="muted">for ${party().size} players at level ${party().level}</span></div>
      <div class="xpbar">${["easy", "medium", "hard", "deadly"].map((k, i) => `<span class="${dd.adj >= dd.t[i] ? "on" : ""}" style="--c:${DIFF[k][1]}" title="${DIFF[k][0]}: ${dd.t[i]} XP">${DIFF[k][0]}</span>`).join("")}</div>
      <div class="small muted" style="margin-top:3px">per player: ${Math.round(dd.base / party().size).toLocaleString()} XP when they win · thresholds as in donjon's calculator (party size &amp; level at the top)</div></div>` : ""; })()}
    <div class="cbaddpc"><input id="cbpn" placeholder="Player" list="cbplayers"><input id="cbpi" type="number" placeholder="Init" style="width:58px"><button class="small" data-act="cbAddPc">＋</button></div>
    <datalist id="cbplayers">${(sc.players || []).map(p => `<option value="${esc(p)}">`).join("")}</datalist>
    ${(sc.players || []).filter(p => !cb.list.some(f => f.kind === "pc" && f.name === p)).length ? `<div class="small" style="margin-top:6px"><span class="muted">Party:</span> ${(sc.players || []).filter(p => !cb.list.some(f => f.kind === "pc" && f.name === p)).map(p => `<a href="#" class="chip" data-act="cbPcQuick" data-n="${esc(p)}">＋ ${esc(p)}</a>`).join("")}</div>` : ""}
    <div class="row small" style="margin-top:10px;gap:4px">${mons.length ? `<button class="small ghost" data-act="cbReroll">🎲 Re-roll monsters</button><button class="small ghost" data-act="cbClear" data-k="mon">Clear monsters</button>` : ""}${cb.list.length ? `<button class="small ghost" data-act="cbClear" data-k="all">Clear all</button>` : ""}</div></aside>`;
  const tray = `<div class="cbtray"><span class="small muted">Drag into the fight (or tap):</span>${sc.monsters.map(m => `<span class="cbchip" data-mid="${m.id}">${monThumb(m)}${esc(monName(m))}</span>`).join("") || '<span class="small muted">Add monsters in the 👹 Monsters tab first.</span>'}
    ${sc.nodes.some(nd => (nd.monsters || []).length) ? `<select data-act="cbEnc"><option value="">＋ whole encounter of a node…</option>${sc.nodes.filter(nd => (nd.monsters || []).length).sort((a, b) => a.n - b.n).map(nd => `<option value="${nd.id}">#${nd.n} ${esc(nd.title || "")} (${encounterOf(nd).map(x => x.n + "× " + monName(x.sm)).join(", ")})</option>`).join("")}</select>` : ""}</div>`;
  const cm = cbMap(); if (cm) cbSyncTokens(cm);
  const mapPart = `<div class="card cbmapcard"><div class="row small"><b>🗺 Map</b><select data-act="cbMapPick"><option value="">— no map (paper / theatre of the mind) —</option>${sc.battlemaps.filter(b => b.image).map(b => `<option value="${b.id}" ${cb.mapId === b.id ? "selected" : ""}>${esc(b.name)}</option>`).join("")}</select>
      ${cm ? `<button class="ghost small" data-act="cbZoom" data-d="0.8">−</button><button class="ghost small" data-act="cbZoom" data-d="fit">Fit</button><button class="ghost small" data-act="cbZoom" data-d="1.25">+</button><button class="ghost small" data-act="cbMapFold">${S.ui.cbMapHide ? "▸ show" : "▾ hide"}</button><span class="muted">tap a monster token for its card · drag tokens to move them</span>` : (sc.battlemaps.length ? "" : '<span class="muted">add battlemaps in the ▦ Battlemaps tab</span>')}</div>
    ${cm && !S.ui.cbMapHide ? `${mapTools("cb")}<div class="cbmapwrap maphost">${trashHtml()}<div id="cbmap" class="mapbox" data-sk="cbmap"></div>${S.ui.cbPop && cb.list.some(f => f.id === S.ui.cbPop) ? `<div class="cbpop"><a href="#" class="cbpopx" data-act="cbPopClose" title="Close">✕</a>${cbCard(cb.list.find(f => f.id === S.ui.cbPop))}</div>` : ""}</div>` : ""}</div>`;
  return `${mapPart}<div class="cbwrap"><div class="cbmain" id="cbzone">${cards || `<div class="card cbempty">⚔ Drag monsters from the bar at the bottom into this area — their initiative is rolled and they appear in the list on the right.</div>`}</div>${side}</div>${tray}`;
}
function monThumb(sm) { const src = sm.custom?.image || monImgSrc(sm); return src ? `<img src="${esc(src)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : `<span class="ph">👹</span>`; }
function cbCard(f) {
  const sm = S.scen.monsters.find(m => m.id === f.mid); if (!sm) return "";
  const s = monSummary(sm), open = (S.ui.cbOpen || {})[f.id], dead = f.hp <= 0, pct = Math.max(0, Math.min(100, 100 * f.hp / (f.max || 1)));
  const line = a => {
    const used = a.recharge && f.used[a.key], k = f.id + "|" + a.key, lbl = esc(a.short);
    let h = "";
    if (a.kind === "multi") return `<div class="cba multi"><b>${lbl}:</b> <span>${spellLinkify(a.text.length > 170 ? a.text.slice(0, 167) + "…" : a.text)}</span></div>`;
    if (a.kind === "atk") h = `<b>${lbl}</b> <a href="#" class="cbroll" data-act="atk" data-m="${a.hit}" data-p="${esc(JSON.stringify(a.parts))}" data-t="${esc(f.name)}: ${lbl}" title="Roll to hit">🎲 ${sgn(a.hit)}</a>${a.reach ? ` <span class="small muted">${esc(a.reach)}</span>` : ""}${a.parts.length ? ` · <a href="#" class="cbdmg" data-act="dmgp" data-p="${esc(JSON.stringify(a.parts))}" data-t="${esc(f.name)}: ${lbl} damage" ${a.recharge ? `data-on="${k}"` : ""}>${dmgHtml(a.parts)}</a>` : ""}`;
    else if (a.kind === "save") h = `<b>${lbl}</b> <span class="chip">DC ${a.dc} ${a.abil}</span>${a.area ? ` <span class="small muted">${esc(a.area)}</span>` : ""}${a.parts.length ? ` · <a href="#" class="cbdmg" data-act="dmgp" data-p="${esc(JSON.stringify(a.parts))}" data-t="${esc(f.name)}: ${lbl}" data-note="${a.half ? "Half damage on a successful save" : ""}" ${a.recharge ? `data-on="${k}"` : ""}>${dmgHtml(a.parts)}</a>${a.half ? ' <span class="small muted">½ on save</span>' : ""}` : ""}`;
    else h = `<b class="cbother" data-act="cbTxt" data-k="${k}" title="Show the text">${lbl} ${(S.ui.cbTxt || {})[k] ? "▾" : "▸"}</b>${a.parts?.length ? ` · <a href="#" class="cbdmg" data-act="dmgp" data-p="${esc(JSON.stringify(a.parts))}" data-t="${esc(f.name)}: ${lbl}" ${a.recharge ? `data-on="${k}"` : ""}>${dmgHtml(a.parts)}</a>` : ""}`;
    if (a.recharge) h += a.recharge === "rest" ? ` <button class="small ghost rch" data-act="cbUsed" data-k="${k}">${used ? "used — tap to reset" : "mark used"}</button>`
      : used ? ` <button class="small rch" data-act="cbRecharge" data-k="${k}" data-r="${a.recharge}">🎲 Recharge ${a.recharge}–6</button>` : ` <button class="small ghost rch" data-act="cbUsed" data-k="${k}" title="Rolling its damage marks it as used">ready · mark used</button>`;
    if (a.perDay) h += ` <span class="cbpips">${Array.from({ length: a.perDay }, (_, i) => `<span class="pip ${i < (f.uses[a.key] || 0) ? "used" : ""}" data-act="cbUse" data-k="${k}" data-i="${i}" data-n="${a.perDay}"></span>`).join("")}</span>`;
    const txt = (S.ui.cbTxt || {})[k] ? `<div class="small cbtxt">${sbLinks(spellLinkify(a.text), f.name + ": " + a.short)}</div>` : "";
    return `<div class="cba ${used ? "used" : ""}">${h}${txt}</div>`;
  };
  return `<div class="card cbcard ${dead ? "dead" : ""}" id="cb-${f.id}">
    <div class="cbhead"><span class="cbimg" data-act="cbOpen" data-id="${f.id}" title="Show the full stat block">${monThumb(sm)}</span>
      <div class="grow"><b class="cbname" data-act="cbOpen" data-id="${f.id}">${dead ? "💀 " : ""}${esc(f.name)} <span class="small muted">${open ? "▾" : "▸"}</span></b>
        <div class="small muted">AC <b>${esc(f.ac || s.ac || "?")}</b> · Init ${f.init} (${sgn(s.init)})${monCr(sm) ? " · CR " + esc(monCr(sm)) : ""}</div></div>
      <div class="cbhp"><div class="row" style="gap:4px;justify-content:flex-end"><span class="small">HP</span><input type="number" class="hpnow" value="${f.hp}" data-act="cbHpSet" data-id="${f.id}"><span class="small muted">/ ${f.max}</span></div>
        <div class="hpbar"><div style="width:${pct}%;background:${pct < 25 ? "#b33" : pct < 55 ? "var(--warn)" : "var(--good)"}"></div></div>
        <div class="row" style="gap:4px;justify-content:flex-end"><input type="number" id="cbd-${f.id}" placeholder="amount" style="width:68px" min="0"><button class="small danger" data-act="cbHp" data-id="${f.id}" data-m="-1">Damage</button><button class="small" style="background:var(--good)" data-act="cbHp" data-id="${f.id}" data-m="1">Heal</button></div></div>
      <a href="#" data-act="cbDel" data-id="${f.id}" title="Remove from the fight" class="cbx">✕</a></div>
    <div class="cbacts">${s.legendary ? `<div class="small"><b>Legendary actions</b> <span class="cbpips">${Array.from({ length: s.legendary }, (_, i) => `<span class="pip ${i < (f.uses._leg || 0) ? "used" : ""}" data-act="cbUse" data-k="${f.id}|_leg" data-i="${i}" data-n="${s.legendary}"></span>`).join("")}</span></div>` : ""}
      ${s.sections.map(sec => `<div class="cbsec"><div class="cbsech">${esc(sec.name)}</div>${sec.acts.map(line).join("")}</div>`).join("") || '<p class="small muted">No actions found — open the stat block.</p>'}
      ${s.spells.length ? `<div class="cbsec"><div class="cbsech">Spells</div><div class="cba">${s.spells.map(n => `<a href="#" class="chip spelllink" data-act="spellPeek" data-n="${esc(n)}">${esc(n)}</a>`).join("")}</div></div>` : ""}</div>
    ${cbMap() && !cbMap().tokens.some(t => t.cf === f.id) ? `<div class="row small" style="margin-top:6px"><button class="small ghost" data-act="cbTokAdd" data-id="${f.id}">＋ Token on the map</button><span class="muted">not on the map right now</span></div>` : ""}
    ${open ? `<div class="cbsb">${statBlock(sm)}<div class="row"><button class="small ghost" data-act="editMon" data-id="${sm.id}">✎ ${sm.custom && !sm.ref ? "Edit" : "Edit as copy"}</button></div></div>` : ""}</div>`;
}

// ---------- changing the fight ----------
function addFighter(sm, quiet) {
  const cb = cbState(), s = monSummary(sm), base = monName(sm);
  const same = cb.list.filter(f => f.kind === "mon" && f.mid === sm.id);
  if (same.length === 1 && same[0].name === base) same[0].name = base + " 1";
  const used = new Set(same.map(f => f.name));
  let n = same.length + 1; while (used.has(base + " " + n)) n++;
  const r = rollDie(20), f = { id: uid(), kind: "mon", mid: sm.id, name: same.length ? base + " " + n : base, init: r + s.init, hp: s.hp, max: s.hp, ac: s.ac, used: {}, uses: {} };
  cb.list.push(f);
  if (!quiet) toast(`${f.name}: initiative ${f.init} (rolled ${r} ${sgn(s.init)})`);
  return f;
}
function findF(k) { const [id, key] = String(k).split("|"); return { f: cbState().list.find(x => x.id === id), key }; }
function onDamageRolled(k) { const { f, key } = findF(k); if (f && key) { f.used[key] = true; save(); render(); } }
Object.assign(ACT, {
  cbOpen: el => { const o = S.ui.cbOpen ||= {}; o[el.dataset.id] = !o[el.dataset.id]; render(); },
  cbTxt: el => { const o = S.ui.cbTxt ||= {}; o[el.dataset.k] = !o[el.dataset.k]; render(); },
  cbGo: el => { document.getElementById("cb-" + el.dataset.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); },
  cbDel: el => { const cb = cbState(); cb.list = cb.list.filter(f => f.id !== el.dataset.id); save(); render(); },
  cbHp: el => { const f = cbState().list.find(x => x.id === el.dataset.id), v = Math.abs(parseInt(el.closest(".cbhp").querySelector("input:not(.hpnow)").value) || 0); if (!v) return toast("Type an amount first");
    f.hp = Math.max(0, Math.min(f.max, f.hp + v * +el.dataset.m)); save(); render(); if (f.hp <= 0) toast(f.name + " is down"); },
  cbUsed: el => { const { f, key } = findF(el.dataset.k); f.used[key] = !f.used[key]; save(); render(); },
  cbRecharge: el => { const { f, key } = findF(el.dataset.k), r = rollDie(6), ok = r >= +el.dataset.r;
    if (ok) delete f.used[key]; save(); render(); toast(`Recharge: rolled ${r} — ${ok ? "ready again!" : "not yet"}`); },
  cbUse: el => { const { f, key } = findF(el.dataset.k), i = +el.dataset.i, cur = f.uses[key] || 0; f.uses[key] = i < cur ? i : i + 1; save(); render(); },
  cbAddPc: () => { const n = ($("#cbpn").value || "").trim(); if (!n) return toast("Type the player's name"); const init = parseInt($("#cbpi").value);
    cbState().list.push({ id: uid(), kind: "pc", name: n, init: isNaN(init) ? 0 : init }); const P = S.scen.players ||= []; if (!P.includes(n)) P.push(n); save(); render(); setTimeout(() => $("#cbpn")?.focus(), 30); },
  cbPcQuick: el => { const v = prompt(`Initiative for ${el.dataset.n}:`); if (v === null) return; cbState().list.push({ id: uid(), kind: "pc", name: el.dataset.n, init: parseInt(v) || 0 }); save(); render(); },
  cbReroll: () => { cbState().list.filter(f => f.kind === "mon").forEach(f => { const sm = S.scen.monsters.find(m => m.id === f.mid); f.init = rollDie(20) + (sm ? monSummary(sm).init : 0); }); save(); render(); toast("New initiative rolled for the monsters"); },
  cbClear: el => { if (!confirm(el.dataset.k === "all" ? "Remove everybody from the fight?" : "Remove all monsters from the fight (players stay)?")) return; const cb = cbState(); cb.list = el.dataset.k === "all" ? [] : cb.list.filter(f => f.kind === "pc"); save(); render(); }
});
Object.assign(CHG, {
  cbInit: el => { const f = cbState().list.find(x => x.id === el.dataset.id); if (f) f.init = parseInt(el.value) || 0; save(); },
  cbHpSet: el => { const f = cbState().list.find(x => x.id === el.dataset.id); if (f) f.hp = Math.max(0, Math.min(f.max, parseInt(el.value) || 0)); save(); },
  cbEnc: el => { const nd = S.scen.nodes.find(n => n.id === el.value); if (!nd) return; const added = []; encounterOf(nd).forEach(x => { for (let i = 0; i < x.n; i++) added.push(addFighter(x.sm, true)); }); save();
    toast(added.map(f => `${f.name} ${f.init}`).join(" · ")); }
});

// ---------- drag a monster from the bar into the fight (mouse and touch) ----------
(() => {
  let d = null;
  document.addEventListener("pointerdown", e => { const c = e.target.closest(".cbchip"); if (!c) return; d = { c, x: e.clientX, y: e.clientY, on: false, id: e.pointerId }; });
  document.addEventListener("pointermove", e => {
    if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.on) { if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { d.on = true; d.g = d.c.cloneNode(true); d.g.classList.add("cbghost"); document.body.appendChild(d.g); try { d.c.setPointerCapture(e.pointerId); } catch (x) { } } else if (Math.abs(dx) > 10) { d = null; return; } }
    if (d.on) { e.preventDefault(); d.g.style.left = e.clientX - 30 + "px"; d.g.style.top = e.clientY - 18 + "px"; const z = document.getElementById("cbzone"); z?.classList.toggle("over", !!document.elementsFromPoint(e.clientX, e.clientY).find(x => x.id === "cbzone" || x.classList?.contains("cbside"))); }
  }, { passive: false });
  const end = e => {
    if (!d) return; const x = d; d = null; x.g?.remove(); document.getElementById("cbzone")?.classList.remove("over");
    const sm = S.scen?.monsters.find(m => m.id === x.c.dataset.mid); if (!sm) return;
    const inZone = !x.on || document.elementsFromPoint(e.clientX, e.clientY).some(el => el.id === "cbzone" || el.classList?.contains("cbside"));
    if (inZone && e.type === "pointerup") { const f = addFighter(sm); save(); render(); setTimeout(() => document.getElementById("cb-" + f.id)?.classList.add("flash"), 30); }
  };
  document.addEventListener("pointerup", end); document.addEventListener("pointercancel", end);
})();

// ---------- the fight on a battlemap (optional) ----------
function cbMap() { const id = cbState().mapId; return id ? S.scen.battlemaps.find(b => b.id === id && b.image) : null; }
function cbSyncTokens(m) {
  const cb = cbState(); let changed = false;
  cb.list.filter(f => f.kind === "mon").forEach(f => {
    let t = m.tokens.find(x => x.cf === f.id);
    if (!t && (f.noToken || []).includes(m.id)) return;
    const sm = S.scen.monsters.find(x => x.id === f.mid);
    if (!t) { const size = sm ? monSize(sm) : 1, pos = freeCell(m, size, true); t = { id: uid(), cf: f.id, kind: "monster", mon: f.mid, name: f.name, color: "#8e1f1f", x: pos.x, y: pos.y, size, hidden: false, hp: f.hp, maxHp: f.max }; m.tokens.push(t); changed = true; }
    if (t.hp !== f.hp || t.maxHp !== f.max || t.name !== f.name) { Object.assign(t, { hp: f.hp, maxHp: f.max, name: f.name }); changed = true; }
  });
  const before = m.tokens.length; m.tokens = m.tokens.filter(t => !t.cf || cb.list.some(f => f.id === t.cf)); if (m.tokens.length !== before) changed = true;
  if (changed) { save(); if (S.live && S.live.mapId === m.id) pushTable(); }
}
function drawCbMap() {
  const m = cbMap(), host = document.getElementById("cbmap"); if (!m || !host) return;
  if (S.ui.cbZ == null) S.ui.cbZ = MapView.fitZoom(host, m);
  const t = m.tokens.find(x => x.cf === S.ui.cbPop);
  host.innerHTML = MapView.html(m, S.ui.cbZ, { dm: true, sel: t ? t.id : null, img: tokImg, tplEdit: true });
}
let cbBound = false;
function bindCbMap() {
  if (cbBound) return; cbBound = true;
  const proxy = { addEventListener: (type, fn) => document.addEventListener(type, ev => { if (type === "pointerdown" && !ev.target.closest("#cbmap")) return; fn(ev); }) };
  proxy.querySelector = s => { const h = document.getElementById("cbmap"); return h ? h.querySelector(s) : null; };
  MapView.bind(proxy, () => ({ map: cbMap(), z: S.ui.cbZ }), (id, x, y) => {
    const m = cbMap(), t = m && m.tokens.find(k => k.id === id); if (t) { t.x = x; t.y = y; }
    save(); drawCbMap(); if (S.live && S.live.mapId === m.id) liveApi("api/table/move", { id, x, y });
  }, id => { const m = cbMap(), t = m && m.tokens.find(k => k.id === id); S.ui.cbPop = t && t.cf ? (S.ui.cbPop === t.cf ? null : t.cf) : null; render(); }, mapExtras(() => cbMap(), () => drawCbMap()));
}
Object.assign(ACT, {
  cbZoom: el => { const m = cbMap(); S.ui.cbZ = el.dataset.d === "fit" ? MapView.fitZoom(document.getElementById("cbmap"), m) : S.ui.cbZ * +el.dataset.d; drawCbMap(); },
  cbMapFold: () => { S.ui.cbMapHide = !S.ui.cbMapHide; render(); },
  cbPopClose: () => { S.ui.cbPop = null; render(); }
});
Object.assign(CHG, { cbMapPick: el => { cbState().mapId = el.value || null; S.ui.cbZ = null; S.ui.cbPop = null; save(); } });

// monsters still standing, grouped like an encounter (for XP and difficulty)
function cbEncounter() {
  const by = {}; cbState().list.filter(f => f.kind === "mon").forEach(f => { by[f.mid] = (by[f.mid] || 0) + 1; });
  return Object.entries(by).map(([id, n]) => ({ sm: S.scen.monsters.find(m => m.id === id), n })).filter(x => x.sm);
}
Object.assign(ACT, {
  cbTokAdd: el => { const f = cbState().list.find(x => x.id === el.dataset.id), m = cbMap(); if (!f || !m) return; f.noToken = (f.noToken || []).filter(id => id !== m.id); cbSyncTokens(m); save(); render(); }
});
