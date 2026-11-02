"use strict";
/* ============ DICE: roll dialog, animated results, dice tray ============ */
const DIE_SHAPES = {
  4: "50,6 95,90 5,90",
  6: "12,12 88,12 88,88 12,88",
  8: "50,3 95,50 50,97 5,50",
  10: "50,3 92,42 50,97 8,42",
  12: "50,4 95,37 78,93 22,93 5,37",
  20: "50,3 93,27 93,73 50,97 7,73 7,27",
  100: "50,3 92,42 50,97 8,42"
};
const DICE_COLORS = ["#8e1f1f", "#1f4e8e", "#2f7d4a", "#6b2f8e", "#c27c0e", "#222222", "#e8e2d6", "#0f8a8a"];

// ---------- damage types: pictograms + dice colours ----------
const DMG_TYPES = ["Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning", "Necrotic", "Piercing", "Poison", "Psychic", "Radiant", "Slashing", "Thunder"];
const DT_ICON = {
  acid: '<path d="M12 2.5 1.8 20.5h20.4z" fill="none" stroke-width="1.8"/><path d="M12 8.5c-2.2 3.2-2.8 4.4-2.8 5.9a2.8 2.8 0 0 0 5.6 0c0-1.5-.6-2.7-2.8-5.9z" stroke="none"/>',
  bludgeoning: '<path d="M4 4.5h11l1.5 1.5v3L15 10.5H4z" stroke="none"/><path d="M9.5 10.5V22" stroke-width="2.6" fill="none"/><path d="M18 4l3-1.5M18.5 7.5H22M18 11l3 1.5" fill="none" stroke-width="1.4"/>',
  cold: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5M3 10.5l3.3-.9-.9-3.3M21 13.5l-3.3.9.9 3.3M3 13.5l3.3.9-.9 3.3M21 10.5l-3.3-.9.9-3.3" fill="none" stroke-width="1.5"/>',
  fire: '<path d="M12 1.8c.9 3.6 5.6 5.6 5.6 11.4a5.6 5.6 0 0 1-11.2 0c0-2.9 1.6-4.5 2.3-6.8 1 1.1 1.4 2.5 1.4 3.9 1.3-2.4 1.9-5.2 1.9-8.5zM12 15c-.9 1.3-1.6 2.2-1.6 3.4a1.6 1.6 0 0 0 3.2 0c0-1.2-.7-2.1-1.6-3.4z" fill-rule="evenodd" stroke="none"/>',
  force: '<path d="M12 1.5l1.9 6.1 5.7-2.9-2.9 5.7 6.1 1.9-6.1 1.9 2.9 5.7-5.7-2.9-1.9 6.1-1.9-6.1-5.7 2.9 2.9-5.7-6.1-1.9 6.1-1.9-2.9-5.7 5.7 2.9z" stroke="none"/>',
  lightning: '<path d="M14 1.5 4 13.5h6.5L9 22.5l11-13h-6.8z" stroke="none"/>',
  necrotic: '<path d="M12 2.5a7.5 7.5 0 0 0-7.5 7.5c0 2.7 1.3 4.5 3 5.6V19h9v-3.4c1.7-1.1 3-2.9 3-5.6A7.5 7.5 0 0 0 12 2.5z" stroke="none"/><circle cx="9" cy="10.5" r="1.9" fill="#fff" stroke="none" class="hole"/><circle cx="15" cy="10.5" r="1.9" fill="#fff" stroke="none" class="hole"/><path d="M12 13l-1.1 2h2.2z" fill="#fff" stroke="none" class="hole"/><path d="M9.5 19v2.5M12 19v2.5M14.5 19v2.5" fill="none" stroke-width="1.6"/>',
  piercing: '<path d="M12 1.5 16.5 9 13.2 10v12h-2.4V10L7.5 9z" stroke="none"/>',
  poison: '<path d="M9.5 2.5h5M10.5 2.5v5.2L5.6 15.3a4.3 4.3 0 0 0 3.7 6.2h5.4a4.3 4.3 0 0 0 3.7-6.2l-4.9-7.6V2.5" fill="none" stroke-width="1.7"/><path d="M7.2 14h9.6l1 1.6a3.1 3.1 0 0 1-2.6 4.6H8.8a3.1 3.1 0 0 1-2.6-4.6z" stroke="none"/>',
  psychic: '<path d="M1.5 13s4-6.2 10.5-6.2S22.5 13 22.5 13s-4 6.2-10.5 6.2S1.5 13 1.5 13z" fill="none" stroke-width="1.7"/><circle cx="12" cy="13" r="3" stroke="none"/><path d="M12 1.5v3M5.5 3.5l1.6 2.4M18.5 3.5l-1.6 2.4" fill="none" stroke-width="1.6"/>',
  radiant: '<circle cx="12" cy="4" r="2.4" fill="none" stroke-width="1.5"/><path d="M12 9.5c-2.5-1.2-6.5-1.6-10.5-.3 1.2 2.5 3 3.4 5 3.6-1.4.6-2.4 1.3-3 2.4 2.2.6 4.1.4 5.6-.4-.6 1.2-.8 2.6-.4 4.4 2-1 3-2.9 3.3-4.9.3 2 1.3 3.9 3.3 4.9.4-1.8.2-3.2-.4-4.4 1.5.8 3.4 1 5.6.4-.6-1.1-1.6-1.8-3-2.4 2-.2 3.8-1.1 5-3.6-4-1.3-8-.9-10.5.3z" stroke="none"/>',
  slashing: '<path d="M12 1.5l2 2.8V15h-4V4.3z" stroke="none"/><path d="M6.5 15.8h11" fill="none" stroke-width="2.2"/><path d="M12 16v4" fill="none" stroke-width="2.2"/><circle cx="12" cy="21.3" r="1.4" stroke="none"/>',
  thunder: '<circle cx="12" cy="12" r="2" stroke="none"/><path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.2 5.2a9.6 9.6 0 0 0 0 13.6M18.8 5.2a9.6 9.6 0 0 1 0 13.6" fill="none" stroke-width="1.8"/>'
};
const DT_COLOR = { acid: "#9db21b", cold: "#2f8fc9", fire: "#d4471c", force: "#7a3fd1", lightning: "#e0ad12", necrotic: "#3b2a47", poison: "#3d8c38", psychic: "#c93f95", radiant: "#ecc94b", thunder: "#4e5c94" };
const dtKey = t => String(t || "").toLowerCase().trim();
function dtIcon(t, cls = "") { const k = dtKey(t); return DT_ICON[k] ? `<svg class="dti ${cls}" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-label="${esc(k)}"><title>${esc(t)}</title>${DT_ICON[k]}</svg>` : ""; }
// "1d8 fire" / "Fire" -> "fire"
function dtFrom(s) { const m = String(s || "").toLowerCase().match(new RegExp("\\b(" + DMG_TYPES.join("|").toLowerCase() + ")\\b")); return m ? m[1] : ""; }
function dtSelect(id, v) { return `<select id="${id}" class="dtsel"><option value="">type…</option>${DMG_TYPES.map(t => `<option value="${t.toLowerCase()}" ${dtKey(v) === t.toLowerCase() ? "selected" : ""}>${t}</option>`).join("")}</select>`; }
// a damage part as readable text with its pictogram: "2d6+3 🗡"
function partText(p) { return `${esc(p.f)}${p.type ? " " + dtIcon(p.type, "inl") : ""}`; }

const Dice = {
  color: (() => { try { return localStorage.getItem("diceColor") || "#8e1f1f"; } catch (e) { return "#8e1f1f"; } })(),
  history: [], cur: null, next: null, tray: { pool: {}, mod: 0, open: false },
  ink(hex) { const h = hex.replace("#", ""); const r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16); return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? "#1a1a1a" : "#ffffff"; },
  dieColor(type) { return DT_COLOR[dtKey(type)] || this.color; },
  svg(s, val, cls = "", color) {
    const pts = DIE_SHAPES[s] || DIE_SHAPES[20], col = color || this.color;
    const fs = String(val).length > 2 ? 26 : String(val).length > 1 ? 32 : 38;
    return `<span class="die ${cls}" data-s="${s}"><svg viewBox="0 0 100 100"><polygon points="${pts}" fill="${col}" stroke="rgba(0,0,0,.35)" stroke-width="3" stroke-linejoin="round"/>
      <text x="50" y="${s === 4 ? 70 : 58}" text-anchor="middle" dominant-baseline="middle" font-size="${fs}" font-weight="800" fill="${this.ink(col)}">${val}</text></svg></span>`;
  },
  // "2d6+3", "1d8 + 1d6 + 2", "4" -> {dice:[{n,s,sign,type}], flat}
  parse(f, type = "") {
    const out = { dice: [], flat: 0 };
    String(f || "").replace(/−/g, "-").replace(/\s+/g, "").replace(/([+-]?)(\d*)d(\d+)|([+-]?)(\d+)/gi, (m, sg, n, s, sg2, flat) => {
      if (s) out.dice.push({ n: +(n || 1), s: +s, sign: sg === "-" ? -1 : 1, type: dtKey(type) });
      else if (flat) out.flat += (sg2 === "-" ? -1 : 1) * +flat;
      return "";
    });
    return out;
  },
  exhaustion() { return S.char && S.char.play ? 2 * (+S.char.play.exhaustion || 0) : 0; },

  // ---------- roll dialog ----------
  // o: {kind:"d20"|"dmg", title, mod, formula, dtype, parts:[{f,type}], riders:[…], then:{…damage dialog…}, crit}
  ask(o) {
    this.cur = { ...o, extras: [], bonus: 0, riders: o.riders || [] };
    if (o.kind === "dmg" && !o.parts) this.cur.parts = [{ f: o.formula || "", type: dtKey(o.dtype || "") }];
    (this.cur.riders || []).forEach((r, i) => { if (r.auto) this.addRider(i); });
    this.renderAsk();
  },
  addRider(i, lvlSel) {
    const c = this.cur, r = c.riders[i]; if (!r) return;
    let n = r.n, spend = null, lbl = r.name;
    if (r.spell) {
      const v = lvlSel || "";
      if (v.startsWith("res:")) { spend = { kind: "res", key: v.slice(4) }; lbl += " (free)"; }
      else if (v === "pact") { const L = r.pactLvl || r.lvl; n += (r.per || 0) * (L - r.lvl); spend = { kind: "pact" }; lbl += ` (pact ${L})`; }
      else if (v.startsWith("slot:")) { const L = +v.slice(5); n += (r.per || 0) * (L - r.lvl); spend = { kind: "slot", lvl: L }; lbl += ` (lvl ${L})`; }
    }
    if (r.flat) c.extras.push({ flat: r.flat, type: r.type, label: lbl, rider: i });
    else c.extras.push({ n, s: r.s, sign: 1, type: r.type, label: lbl, spend, rider: i });
  },
  renderAsk() {
    const c = this.cur, box = document.getElementById("dicebox");
    if (!c) { box.classList.add("hidden"); return; }
    box.classList.remove("hidden");
    const d20 = c.kind === "d20";
    const base = d20 ? esc(`1d20 ${sgn(c.mod)}`) : c.parts.map(partText).join(" + ");
    const ex = c.extras.map((e, i) => `<span class="chip acc">${e.label ? esc(e.label) + " " : ""}${e.flat ? sgn(e.flat) : (e.sign < 0 ? "−" : "+") + e.n + "d" + e.s}${e.type ? " " + dtIcon(e.type, "inl") : ""} <a href="#" data-act="diceExDel" data-i="${i}">✕</a></span>`).join("");
    const exh = d20 ? this.exhaustion() : 0;
    const P = S.char?.play || { slots: {}, used: {} }, D = S.char ? derive(S.char) : null;
    const riders = (c.riders || []).map((r, i) => {
      if (c.extras.some(e => e.rider === i)) return "";
      let opts = "";
      if (r.spell && D) {
        const o = [];
        if (r.freeKey) { const res = D.resources.find(x => x.key === r.freeKey); if (res) { const left = res.max - (P.used[r.freeKey] || 0); o.push(`<option value="res:${r.freeKey}" ${left > 0 ? "" : "disabled"}>free cast (${left} left)</option>`); } }
        if (!r.pactOnly) D.slots.forEach((nS, j) => { const L = j + 1; if (L < r.lvl) return; const left = nS - (P.slots[L] || 0); o.push(`<option value="slot:${L}" ${left > 0 ? "" : "disabled"}>level ${L} slot (${left} left)</option>`); });
        if (D.pact && D.pact.lvl >= r.lvl) { const left = D.pact.n - (+P.pact || 0); o.push(`<option value="pact" ${left > 0 ? "" : "disabled"}>pact slot, level ${D.pact.lvl} (${left} left)</option>`); }
        o.push(`<option value="">don't use a slot</option>`);
        const first = o.findIndex(x => !x.includes("disabled"));
        opts = `<select id="rsl${i}" class="small">${o.map((x, k) => k === first ? x.replace("<option", "<option selected") : x).join("")}</select>`;
      }
      return `<div class="rider"><button class="small ghost" data-act="diceRider" data-i="${i}">+ ${esc(r.name)}</button><span class="small muted">${r.flat ? sgn(r.flat) : r.n + "d" + r.s}${r.per ? ` +${r.per}d${r.s}/level` : ""} ${dtIcon(r.type, "inl")}${r.note ? " · " + esc(r.note) : ""}</span>${opts}</div>`;
    }).join("");
    box.innerHTML = `<div class="dicecard">
      <div class="row"><b style="font-size:17px">${esc(c.title)}</b><a href="#" class="right" data-act="diceClose" style="font-size:20px;text-decoration:none">✕</a></div>
      ${c.crit ? `<div class="chip warn" style="font-weight:700">Critical hit — dice are doubled</div>` : ""}
      <div class="diceformula">${base}${ex ? " " + ex : ""}${c.bonus ? ` <span class="chip acc">${sgn(+c.bonus)}</span>` : ""}${exh ? ` <span class="chip warn">exhaustion −${exh}</span>` : ""}</div>
      ${c.note ? `<div class="small" style="margin:-2px 0 6px">📝 ${esc(c.note)}</div>` : ""}
      ${riders ? `<div class="riders"><div class="small muted">Add to this hit:</div>${riders}</div>` : ""}
      <div class="row small" style="margin:6px 0">${d20 ? `<button class="ghost small" data-act="diceEx" data-n="1" data-s="4" data-g="1">+1d4 Bless/Guidance</button><button class="ghost small" data-act="diceEx" data-n="1" data-s="4" data-g="-1">−1d4 Bane</button>` : `<button class="ghost small" data-act="diceEx" data-n="1" data-s="6" data-g="1">+1d6</button><button class="ghost small" data-act="diceEx" data-n="2" data-s="6" data-g="1">+2d6</button>`}</div>
      <div class="row small">Add <select id="dxn">${[1, 2, 3, 4, 5, 6, 8, 10].map(n => `<option>${n}</option>`).join("")}</select>
        <select id="dxs">${[4, 6, 8, 10, 12, 20].map(s => `<option value="${s}">d${s}</option>`).join("")}</select>${d20 ? "" : dtSelect("dxt", "")}
        <button class="ghost small" data-act="diceExAdd" data-g="1">+ add</button><button class="ghost small" data-act="diceExAdd" data-g="-1">− subtract</button>
        <label class="right">Bonus <input id="dxb" type="number" value="${+c.bonus || 0}" style="width:64px" data-act-input="diceBonus"></label></div>
      <div class="dicebtns">${d20 ? `<button class="ghost" data-act="diceGo" data-m="dis">Disadvantage</button><button data-act="diceGo" data-m="normal">Normal</button><button class="ghost" data-act="diceGo" data-m="adv">Advantage</button>`
        : c.crit ? `<button data-act="diceGo" data-m="crit">Roll critical damage</button><button class="ghost" data-act="diceGo" data-m="normal">Roll normal</button>`
        : `<button data-act="diceGo" data-m="normal">Roll</button><button class="ghost" data-act="diceGo" data-m="crit">Critical hit (double dice)</button>`}</div></div>`;
  },
  go(mode) {
    const c = this.cur; this.cur.bonus = +(document.getElementById("dxb")?.value || 0);
    let dice = [], flat = +c.bonus || 0; const tflat = {};
    const T0 = c.kind === "dmg" ? dtKey(c.parts[0]?.type) : "";
    if (c.kind === "d20") {
      dice.push({ n: mode === "normal" ? 1 : 2, s: 20, sign: 1, keep: mode === "adv" ? "high" : mode === "dis" ? "low" : null });
      flat += c.mod - this.exhaustion();
    } else {
      c.parts.forEach(p => { const q = this.parse(p.f, p.type); dice = dice.concat(q.dice); if (q.flat) tflat[dtKey(p.type)] = (tflat[dtKey(p.type)] || 0) + q.flat; });
      if (flat) tflat[T0] = (tflat[T0] || 0) + flat;
      flat = 0;
    }
    c.extras.forEach(e => { if (e.flat) { if (c.kind === "dmg") tflat[dtKey(e.type) || T0] = (tflat[dtKey(e.type) || T0] || 0) + e.flat; else flat += e.flat; } else dice.push({ n: e.n, s: e.s, sign: e.sign, type: dtKey(e.type) || T0 }); });
    if (mode === "crit") dice = dice.map(d => ({ ...d, n: d.n * 2 }));
    // spend slots / free casts used by smites etc.
    const spends = c.extras.filter(e => e.spend);
    if (spends.length && S.char) {
      const P = S.char.play;
      spends.forEach(e => { const s = e.spend; if (s.kind === "slot") P.slots[s.lvl] = (P.slots[s.lvl] || 0) + 1; else if (s.kind === "pact") P.pact = (+P.pact || 0) + 1; else if (s.kind === "res") P.used[s.key] = (P.used[s.key] || 0) + 1; });
      save(); render();
    }
    const tag = { adv: "Advantage", dis: "Disadvantage", crit: "Critical" }[mode] || "";
    this.next = c.then || null;
    this.cur = null; this.renderAsk();
    if (c.kind === "dmg") flat = Object.values(tflat).reduce((a, b) => a + b, 0);
    this.roll(c.title + (tag ? ` (${tag})` : ""), dice, flat, c.kind === "d20", c.kind === "dmg" ? tflat : null);
  },

  // ---------- roll + animation ----------
  roll(title, groups, flat, isD20, tflat) {
    const res = [];
    for (const g of groups) {
      const vals = Array.from({ length: g.n }, () => rollDie(g.s));
      let keepIdx = null;
      if (g.keep && vals.length === 2) keepIdx = g.keep === "high" ? (vals[0] >= vals[1] ? 0 : 1) : (vals[0] <= vals[1] ? 0 : 1);
      vals.forEach((v, i) => res.push({ s: g.s, v, sign: g.sign, type: g.type || "", dropped: keepIdx !== null && i !== keepIdx, d20: g.s === 20 && isD20 }));
    }
    const total = res.filter(r => !r.dropped).reduce((t, r) => t + r.sign * r.v, 0) + flat;
    const nat = res.find(r => r.d20 && !r.dropped);
    const crit = nat && nat.v === 20, fumble = nat && nat.v === 1;
    const parts = res.map((r, i) => `${i ? (r.sign < 0 ? " − " : " + ") : r.sign < 0 ? "−" : ""}${r.dropped ? `<s>${r.v}</s>` : r.v}<small> (d${r.s}${r.dropped ? " dropped" : ""})</small>`).join("");
    const breakdown = parts + (flat ? ` ${flat < 0 ? "−" : "+"} ${Math.abs(flat)}` : "");
    // damage by type
    let split = null;
    if (tflat) {
      const by = {}; res.forEach(r => { if (!r.dropped) by[r.type] = (by[r.type] || 0) + r.sign * r.v; });
      for (const k in tflat) by[k] = (by[k] || 0) + tflat[k];
      split = Object.entries(by).map(([type, v]) => ({ type, v: Math.max(0, v) }));
    }
    this.history.unshift({ title, total, breakdown, crit, fumble, split, t: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
    this.history = this.history.slice(0, 25);
    this.lastRoll = { title, res, groups, flat, isD20, tflat };
    this.show(title, res, total, breakdown, crit, fumble, split);
  },
  show(title, res, total, breakdown, crit, fumble, split) {
    const el = document.getElementById("diceres");
    el.classList.remove("hidden");
    const typed = split && split.some(p => p.type);
    const splitHtml = !typed ? "" : split.length > 1
      ? `<div class="dmgsplit">(${split.map(p => `<span class="dpart"><b>${p.v}</b><span>${dtIcon(p.type) || '<span class="small">—</span>'}<small>${esc(p.type || "untyped")}</small></span></span>`).join('<span class="dplus">+</span>')})</div>`
      : `<div class="dmgsplit one"><span class="dpart"><span>${dtIcon(split[0].type)}<small>${esc(split[0].type)}</small></span></span></div>`;
    const nx = this.next;
    el.innerHTML = `<div class="dicestage"><div class="dicetitle">${esc(title)}</div>
      <div class="dicerow">${res.map((r, i) => this.svg(r.s, 1 + Math.floor(Math.random() * r.s), "rolling" + (r.sign < 0 ? " neg" : ""), r.type ? this.dieColor(r.type) : null)).join("")}</div>
      <div class="dicetotal hidden">${total}</div><div class="dicesplit hidden">${splitHtml}</div><div class="dicebd hidden">${breakdown}</div>
      <div class="dicenat hidden">${crit ? "NATURAL 20!" : fumble ? "Natural 1…" : ""}</div>
      <div class="hidden dicefoot" style="margin-top:12px"><div class="row" style="justify-content:center"><button class="ghost" data-act="diceAgain">Roll again</button><button data-act="diceResClose">OK</button></div>
        ${res.some(r => r.d20) && S.char?.play?.inspiration ? `<div class="row" style="justify-content:center;margin-top:10px"><button class="inspbtn" data-act="diceInsp" title="Heroic Inspiration: reroll and use the new roll">★ Use Heroic Inspiration (reroll)</button></div>` : ""}
        ${nx ? `<div class="row" style="justify-content:center;margin-top:10px"><button class="hitbtn ${crit ? "crit" : ""}" data-act="diceNext">${crit ? "⚔ Critical hit → damage" : "⚔ Hit → damage"}</button></div>` : ""}</div></div>`;
    const dies = [...el.querySelectorAll(".die")];
    const t0 = Date.now();
    const tick = setInterval(() => {
      const t = Date.now() - t0; let all = true;
      dies.forEach((d, i) => {
        const r = res[i]; const end = 650 + i * 110;
        if (t < end) { all = false; d.querySelector("text").textContent = 1 + Math.floor(Math.random() * r.s); }
        else if (!d.classList.contains("landed")) {
          d.querySelector("text").textContent = r.v; d.classList.remove("rolling"); d.classList.add("landed");
          if (r.dropped) d.classList.add("dropped");
          if (r.d20 && !r.dropped && (r.v === 20 || r.v === 1)) d.classList.add(r.v === 20 ? "nat20" : "nat1");
        }
      });
      if (all) {
        clearInterval(tick);
        ["dicetotal", "dicebd", "dicefoot", "dicesplit"].forEach(k => el.querySelector("." + k).classList.remove("hidden"));
        if (crit || fumble) el.querySelector(".dicenat").classList.remove("hidden");
        el.querySelector(".dicetotal").classList.toggle("crit", !!crit); el.querySelector(".dicetotal").classList.toggle("fumble", !!fumble);
        try { navigator.vibrate && navigator.vibrate(crit ? [40, 60, 40] : 25); } catch (e) { }
        if (this.tray.open) this.renderTray();
      }
    }, 55);
  },

  // ---------- tray ----------
  sync() {
    const fab = document.getElementById("dicefab"); if (!fab) return;
    const on = !!S.diceAlways || S.view === "sheet";
    fab.classList.toggle("hidden", !on);
    fab.innerHTML = this.svg(20, 20, "fabdie");
    if (!on) { this.tray.open = false; }
    document.getElementById("dicetray").classList.toggle("hidden", !this.tray.open || !on);
    if (this.tray.open && on) this.renderTray();
  },
  renderTray() {
    const T = this.tray, el = document.getElementById("dicetray");
    const pool = Object.entries(T.pool).filter(([s, n]) => n > 0);
    const formula = pool.map(([s, n]) => `${n}d${s}`).join(" + ") + (T.mod ? ` ${T.mod < 0 ? "−" : "+"} ${Math.abs(T.mod)}` : "");
    el.innerHTML = `<div class="row"><b>Dice</b><span class="small muted">tap dice to add, then Roll</span><a href="#" class="right" data-act="trayToggle" style="font-size:18px;text-decoration:none">✕</a></div>
      <div class="traydice">${[4, 6, 8, 10, 12, 20, 100].map(s => `<button class="traydie" data-act="trayAdd" data-s="${s}">${this.svg(s, s === 100 ? "%" : s)}${T.pool[s] ? `<span class="badge">${T.pool[s]}</span>` : ""}</button>`).join("")}</div>
      <div class="row"><span class="diceformula" style="flex:1">${formula || '<span class="muted">nothing selected</span>'}</span>
        <label class="small">Mod <input type="number" id="traymod" value="${T.mod || 0}" style="width:56px" data-act-input="trayMod"></label></div>
      <div class="row" style="margin-top:6px"><button data-act="trayRoll" ${pool.length ? "" : "disabled"} style="flex:1">Roll</button><button class="ghost" data-act="trayClear">Clear</button></div>
      <div class="row small" style="margin-top:8px">Dice color: ${DICE_COLORS.map(col => `<span class="swatch ${col === this.color ? "on" : ""}" style="background:${col}" data-act="diceColor" data-c="${col}"></span>`).join("")}<input type="color" value="${this.color}" data-act="diceColorPick" title="Custom color"></div>
      ${this.history.length ? `<div class="trayhist">${this.history.map(h => h.who ? `<div class="phist" style="--c:${esc(h.color || "#888")}"><span class="muted small">${h.t}</span> <b class="pwho">${esc(h.who)}</b>: <b class="${h.crit ? "good" : h.fumble ? "warn" : ""}" style="font-size:15px">${h.total}</b> ${esc(h.title)} <span class="small muted">→ ${esc(h.detail)}${h.note ? ` (${esc(h.note)})` : ""}</span>${h.split && h.split.length > 1 ? ` <span class="small">(${h.split.map(p => p.v + (p.type ? " " + dtIcon(p.type, "inl") : "")).join(" + ")})</span>` : h.split && h.split[0]?.type ? " " + dtIcon(h.split[0].type, "inl") : ""}</div>` : `<div><span class="muted small">${h.t}</span> ${esc(h.title)}: <b class="${h.crit ? "good" : h.fumble ? "warn" : ""}">${h.total}</b>${h.split && h.split.length > 1 ? ` <span class="small">(${h.split.map(p => p.v + (p.type ? " " + dtIcon(p.type, "inl") : "")).join(" + ")})</span>` : h.split && h.split[0]?.type ? " " + dtIcon(h.split[0].type, "inl") : ""} <span class="small muted">(${h.breakdown})</span></div>`).join("")}</div>` : ""}`;
  }
};

// ---------- clickable dice in rules text ----------
function diceLinks(html, title) {
  return html.replace(/(^|[^\w])(\d+)d(\d+)(?:\s*([+−-])\s*(\d+)(?![\w]))?/g, (m, pre, n, s, sg, fl, off, all) => {
    const f = `${n}d${s}${sg ? (sg === "+" ? "+" : "-") + fl : ""}`;
    const after = all.slice(off + m.length, off + m.length + 40).match(/^\)?\s+(\w+)\s+damage/i);
    const dt = after && DMG_TYPES.some(t => t.toLowerCase() === after[1].toLowerCase()) ? after[1].toLowerCase() : "";
    return `${pre}<a href="#" class="dicelink" data-act="roll" data-k="dmg" data-f="${f}" data-dt="${dt}" data-t="${esc(title)}">🎲${n}d${s}${sg ? ` ${sg} ${fl}` : ""}</a>`;
  });
}

// ---------- actions ----------
Object.assign(ACT, {
  roll: (el, e) => { e.stopPropagation(); Dice.ask({ title: el.dataset.t || "Roll", kind: el.dataset.k === "dmg" ? "dmg" : "d20", mod: +(el.dataset.m || 0), formula: el.dataset.f || "", dtype: el.dataset.dt || "" }); },
  diceClose: () => { Dice.cur = null; Dice.next = null; Dice.renderAsk(); },
  diceEx: el => { Dice.cur.bonus = +(document.getElementById("dxb")?.value || 0); Dice.cur.extras.push({ n: +el.dataset.n, s: +el.dataset.s, sign: +el.dataset.g }); Dice.renderAsk(); },
  diceExAdd: el => { Dice.cur.bonus = +(document.getElementById("dxb")?.value || 0); Dice.cur.extras.push({ n: +$("#dxn").value, s: +$("#dxs").value, sign: +el.dataset.g, type: document.getElementById("dxt")?.value || "" }); Dice.renderAsk(); },
  diceExDel: el => { Dice.cur.extras.splice(+el.dataset.i, 1); Dice.renderAsk(); },
  diceGo: el => Dice.go(el.dataset.m),
  diceResClose: () => { Dice.next = null; document.getElementById("diceres").classList.add("hidden"); },
  diceAgain: () => { const l = Dice.lastRoll; if (!l) return; Dice.roll(l.title, l.groups, l.flat, l.isD20, l.tflat); },
  diceInsp: () => { const l = Dice.lastRoll; if (!l || !S.char) return; S.char.play.inspiration = false; save(); render();
    Dice.roll(l.title.replace(/ — rerolled.*$/, "") + " — rerolled (Heroic Inspiration)", l.groups, l.flat, l.isD20, l.tflat); },
  // attack: roll to hit first, then "Hit → damage" (critical on a natural 20); data-p = JSON damage parts [{f,type}]
  atk: (el, e) => { e.stopPropagation(); let parts = null; try { parts = JSON.parse(el.dataset.p || "null"); } catch (x) { }
    if (!parts && el.dataset.f) parts = [{ f: el.dataset.f, type: el.dataset.dt || "" }];
    Dice.ask({ title: el.dataset.t + " — attack", kind: "d20", mod: +(el.dataset.m || 0), formula: "", then: parts && parts.length ? { title: el.dataset.t + " — damage", parts, onRoll: el.dataset.on || "" } : null }); },
  // damage with typed parts (combat summary)
  dmgp: (el, e) => { e.stopPropagation(); let parts = []; try { parts = JSON.parse(el.dataset.p || "[]"); } catch (x) { }
    if (el.dataset.on && typeof onDamageRolled === "function") onDamageRolled(el.dataset.on);
    Dice.ask({ title: el.dataset.t, kind: "dmg", parts, note: el.dataset.note || "" }); },
  diceNext: () => { const n = Dice.next, crit = (Dice.history[0] || {}).crit; Dice.next = null; if (!n) return;
    document.getElementById("diceres").classList.add("hidden"); Dice.ask({ ...n, kind: "dmg", crit: !!crit }); },
  diceRider: el => { const i = +el.dataset.i; Dice.cur.bonus = +(document.getElementById("dxb")?.value || 0); Dice.addRider(i, document.getElementById("rsl" + i)?.value); Dice.renderAsk(); },
  trayToggle: () => { Dice.tray.open = !Dice.tray.open; document.getElementById("dicefab")?.classList.remove("ping"); Dice.sync(); },
  trayAdd: el => { const s = +el.dataset.s; Dice.tray.pool[s] = (Dice.tray.pool[s] || 0) + 1; Dice.renderTray(); },
  trayClear: () => { Dice.tray.pool = {}; Dice.tray.mod = 0; Dice.renderTray(); },
  trayRoll: () => { const g = Object.entries(Dice.tray.pool).filter(([s, n]) => n > 0).map(([s, n]) => ({ n, s: +s, sign: 1 }));
    const f = g.map(x => `${x.n}d${x.s}`).join(" + "); Dice.roll(f, g, +Dice.tray.mod || 0, false); },
  diceColor: el => { Dice.color = el.dataset.c; try { localStorage.setItem("diceColor", Dice.color); } catch (e) { } Dice.sync(); }
});
Object.assign(CHG, { diceColorPick: el => { Dice.color = el.value; try { localStorage.setItem("diceColor", Dice.color); } catch (e) { } Dice.sync(); } });
document.addEventListener("input", e => {
  const el = e.target;
  if (el.dataset.actInput === "trayMod") Dice.tray.mod = +el.value || 0;
  if (el.dataset.actInput === "diceBonus" && Dice.cur) Dice.cur.bonus = +el.value || 0;
});
document.getElementById("diceres").addEventListener("click", e => { if (e.target.id === "diceres" || e.target.closest(".dicestage") && !e.target.closest("button")) { if (!document.querySelector("#diceres .dicefoot.hidden")) document.getElementById("diceres").classList.add("hidden"); } });
document.getElementById("dicebox").addEventListener("mousedown", e => { if (e.target.id === "dicebox") ACT.diceClose(); });
document.getElementById("dicefab").addEventListener("click", () => ACT.trayToggle());
