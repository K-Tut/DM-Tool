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

const Dice = {
  color: (() => { try { return localStorage.getItem("diceColor") || "#8e1f1f"; } catch (e) { return "#8e1f1f"; } })(),
  history: [], cur: null, tray: { pool: {}, mod: 0, open: false },
  ink(hex) { const h = hex.replace("#", ""); const r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16); return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? "#1a1a1a" : "#ffffff"; },
  svg(s, val, cls = "") {
    const pts = DIE_SHAPES[s] || DIE_SHAPES[20];
    const fs = String(val).length > 2 ? 26 : String(val).length > 1 ? 32 : 38;
    return `<span class="die ${cls}" data-s="${s}"><svg viewBox="0 0 100 100"><polygon points="${pts}" fill="${this.color}" stroke="rgba(0,0,0,.35)" stroke-width="3" stroke-linejoin="round"/>
      <text x="50" y="${s === 4 ? 70 : 58}" text-anchor="middle" dominant-baseline="middle" font-size="${fs}" font-weight="800" fill="${this.ink(this.color)}">${val}</text></svg></span>`;
  },
  // "2d6+3", "1d8 + 1d6 + 2", "4" -> {dice:[{n,s,sign}], flat}
  parse(f) {
    const out = { dice: [], flat: 0 };
    String(f || "").replace(/−/g, "-").replace(/\s+/g, "").replace(/([+-]?)(\d*)d(\d+)|([+-]?)(\d+)/gi, (m, sg, n, s, sg2, flat) => {
      if (s) out.dice.push({ n: +(n || 1), s: +s, sign: sg === "-" ? -1 : 1 });
      else if (flat) out.flat += (sg2 === "-" ? -1 : 1) * +flat;
      return "";
    });
    return out;
  },
  exhaustion() { return S.char && S.char.play ? 2 * (+S.char.play.exhaustion || 0) : 0; },

  // ---------- roll dialog ----------
  ask(o) { this.cur = { ...o, extras: [], bonus: 0 }; this.renderAsk(); },
  renderAsk() {
    const c = this.cur, box = document.getElementById("dicebox");
    if (!c) { box.classList.add("hidden"); return; }
    box.classList.remove("hidden");
    const d20 = c.kind === "d20";
    const base = d20 ? `1d20 ${sgn(c.mod)}` : c.formula;
    const ex = c.extras.map((e, i) => `<span class="chip acc">${e.sign < 0 ? "−" : "+"}${e.n}d${e.s} <a href="#" data-act="diceExDel" data-i="${i}">✕</a></span>`).join("");
    const exh = d20 ? this.exhaustion() : 0;
    box.innerHTML = `<div class="dicecard">
      <div class="row"><b style="font-size:17px">${esc(c.title)}</b><a href="#" class="right" data-act="diceClose" style="font-size:20px;text-decoration:none">✕</a></div>
      <div class="diceformula">${esc(base)}${ex ? " " + ex : ""}${c.bonus ? ` <span class="chip acc">${sgn(+c.bonus)}</span>` : ""}${exh ? ` <span class="chip warn">exhaustion −${exh}</span>` : ""}</div>
      <div class="row small" style="margin:6px 0">${d20 ? `<button class="ghost small" data-act="diceEx" data-n="1" data-s="4" data-g="1">+1d4 Bless/Guidance</button><button class="ghost small" data-act="diceEx" data-n="1" data-s="4" data-g="-1">−1d4 Bane</button>` : `<button class="ghost small" data-act="diceEx" data-n="1" data-s="6" data-g="1">+1d6</button><button class="ghost small" data-act="diceEx" data-n="2" data-s="6" data-g="1">+2d6</button>`}</div>
      <div class="row small">Add <select id="dxn">${[1, 2, 3, 4, 5, 6, 8, 10].map(n => `<option>${n}</option>`).join("")}</select>
        <select id="dxs">${[4, 6, 8, 10, 12, 20].map(s => `<option value="${s}">d${s}</option>`).join("")}</select>
        <button class="ghost small" data-act="diceExAdd" data-g="1">+ add</button><button class="ghost small" data-act="diceExAdd" data-g="-1">− subtract</button>
        <label class="right">Bonus <input id="dxb" type="number" value="${+c.bonus || 0}" style="width:64px" data-act-input="diceBonus"></label></div>
      <div class="dicebtns">${d20 ? `<button class="ghost" data-act="diceGo" data-m="dis">Disadvantage</button><button data-act="diceGo" data-m="normal">Normal</button><button class="ghost" data-act="diceGo" data-m="adv">Advantage</button>`
        : `<button data-act="diceGo" data-m="normal">Roll</button><button class="ghost" data-act="diceGo" data-m="crit">Critical hit (double dice)</button>`}</div></div>`;
  },
  go(mode) {
    const c = this.cur; this.cur.bonus = +(document.getElementById("dxb")?.value || 0);
    let dice = [], flat = +c.bonus || 0, labels = [];
    if (c.kind === "d20") {
      dice.push({ n: mode === "normal" ? 1 : 2, s: 20, sign: 1, keep: mode === "adv" ? "high" : mode === "dis" ? "low" : null });
      flat += c.mod - this.exhaustion();
    } else {
      const p = this.parse(c.formula); dice = p.dice; flat += p.flat;
    }
    dice = dice.concat(c.extras);
    if (mode === "crit") dice = dice.map(d => ({ ...d, n: d.n * 2 }));
    const tag = { adv: "Advantage", dis: "Disadvantage", crit: "Critical" }[mode] || "";
    this.cur = null; this.renderAsk();
    this.roll(c.title + (tag ? ` (${tag})` : ""), dice, flat, c.kind === "d20");
  },

  // ---------- roll + animation ----------
  roll(title, groups, flat, isD20) {
    const res = [];
    for (const g of groups) {
      const vals = Array.from({ length: g.n }, () => rollDie(g.s));
      let keepIdx = null;
      if (g.keep && vals.length === 2) keepIdx = g.keep === "high" ? (vals[0] >= vals[1] ? 0 : 1) : (vals[0] <= vals[1] ? 0 : 1);
      vals.forEach((v, i) => res.push({ s: g.s, v, sign: g.sign, dropped: keepIdx !== null && i !== keepIdx, d20: g.s === 20 && isD20 }));
    }
    const total = res.filter(r => !r.dropped).reduce((t, r) => t + r.sign * r.v, 0) + flat;
    const nat = res.find(r => r.d20 && !r.dropped);
    const crit = nat && nat.v === 20, fumble = nat && nat.v === 1;
    const parts = res.map((r, i) => `${i ? (r.sign < 0 ? " − " : " + ") : r.sign < 0 ? "−" : ""}${r.dropped ? `<s>${r.v}</s>` : r.v}<small> (d${r.s}${r.dropped ? " dropped" : ""})</small>`).join("");
    const breakdown = parts + (flat ? ` ${flat < 0 ? "−" : "+"} ${Math.abs(flat)}` : "");
    this.history.unshift({ title, total, breakdown, crit, fumble, t: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
    this.history = this.history.slice(0, 25);
    this.show(title, res, total, breakdown, crit, fumble);
  },
  show(title, res, total, breakdown, crit, fumble) {
    const el = document.getElementById("diceres");
    el.classList.remove("hidden");
    el.innerHTML = `<div class="dicestage"><div class="dicetitle">${esc(title)}</div>
      <div class="dicerow">${res.map((r, i) => this.svg(r.s, 1 + Math.floor(Math.random() * r.s), "rolling" + (r.sign < 0 ? " neg" : ""))).join("")}</div>
      <div class="dicetotal hidden">${total}</div><div class="dicebd hidden">${breakdown}</div>
      <div class="dicenat hidden">${crit ? "NATURAL 20!" : fumble ? "Natural 1…" : ""}</div>
      <div class="row hidden dicefoot" style="justify-content:center;margin-top:12px"><button class="ghost" data-act="diceAgain">Roll again</button><button data-act="diceResClose">OK</button></div></div>`;
    this.lastRoll = { title, res };
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
        el.querySelector(".dicetotal").classList.remove("hidden"); el.querySelector(".dicebd").classList.remove("hidden"); el.querySelector(".dicefoot").classList.remove("hidden");
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
      ${this.history.length ? `<div class="trayhist">${this.history.map(h => `<div><span class="muted small">${h.t}</span> ${esc(h.title)}: <b class="${h.crit ? "good" : h.fumble ? "warn" : ""}">${h.total}</b> <span class="small muted">(${h.breakdown})</span></div>`).join("")}</div>` : ""}`;
  }
};

// ---------- clickable dice in rules text ----------
function diceLinks(html, title) {
  return html.replace(/(^|[^\w])(\d+)d(\d+)(?:\s*([+−-])\s*(\d+)(?![\w]))?/g, (m, pre, n, s, sg, fl) => {
    const f = `${n}d${s}${sg ? (sg === "+" ? "+" : "-") + fl : ""}`;
    return `${pre}<a href="#" class="dicelink" data-act="roll" data-k="dmg" data-f="${f}" data-t="${esc(title)}">🎲${n}d${s}${sg ? ` ${sg} ${fl}` : ""}</a>`;
  });
}

// ---------- actions ----------
Object.assign(ACT, {
  roll: (el, e) => { e.stopPropagation(); Dice.ask({ title: el.dataset.t || "Roll", kind: el.dataset.k === "dmg" ? "dmg" : "d20", mod: +(el.dataset.m || 0), formula: el.dataset.f || "" }); },
  diceClose: () => { Dice.cur = null; Dice.renderAsk(); },
  diceEx: el => { Dice.cur.bonus = +(document.getElementById("dxb")?.value || 0); Dice.cur.extras.push({ n: +el.dataset.n, s: +el.dataset.s, sign: +el.dataset.g }); Dice.renderAsk(); },
  diceExAdd: el => { Dice.cur.bonus = +(document.getElementById("dxb")?.value || 0); Dice.cur.extras.push({ n: +$("#dxn").value, s: +$("#dxs").value, sign: +el.dataset.g }); Dice.renderAsk(); },
  diceExDel: el => { Dice.cur.extras.splice(+el.dataset.i, 1); Dice.renderAsk(); },
  diceGo: el => Dice.go(el.dataset.m),
  diceResClose: () => { document.getElementById("diceres").classList.add("hidden"); },
  diceAgain: () => { const h = Dice.history[0]; const l = Dice.lastRoll; if (!l) return; const groups = {}; l.res.forEach(r => { const k = r.s + "|" + r.sign; groups[k] = groups[k] || { n: 0, s: r.s, sign: r.sign }; groups[k].n++; });
    const g = Object.values(groups); const d20 = l.res.find(r => r.d20); const adv = d20 && l.res.filter(r => r.d20).length === 2;
    if (adv) { const dz = g.find(x => x.s === 20); dz.keep = /Disadvantage/.test(l.title) ? "low" : "high"; }
    const flatM = h.breakdown.match(/ ([+−]) (\d+)$/); const flat = flatM ? (flatM[1] === "−" ? -1 : 1) * +flatM[2] : 0;
    Dice.roll(l.title, g, flat, !!d20); },
  trayToggle: () => { Dice.tray.open = !Dice.tray.open; Dice.sync(); },
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
