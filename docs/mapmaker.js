"use strict";
/* ============ MAP MAKER: sketch a dungeon on a grid, classic D&D map style ============
   sketch = { cols, rows, cells: "0/1/2…" per cell (0 rock, 1 floor, 2 water, 3 rubble floor), items: [{t,x,y,r}], labels: [{x,y,text}], style: "blue"|"parch" }
   The drawing is saved with the map (so it stays editable) and rendered to the map image. */
const MM_STYLES = {
  blue: { name: "Classic blue", rock: "#3f7fc4", rockGrid: "rgba(255,255,255,.18)", floor: "#ffffff", grid: "#a9c9ec", wall: "#163f73", water: "#bfe0fb", wave: "#3f7fc4", ink: "#163f73", label: "#163f73", hatch: null },
  parch: { name: "Parchment", rock: "#4a3b2c", rockGrid: null, floor: "#f4e7c8", grid: "#d2bd90", wall: "#2a1f15", water: "#b9d3d6", wave: "#4b6d78", ink: "#2a1f15", label: "#8a1f11", hatch: "rgba(255,240,210,.18)" },
  hand: { name: "Hand-drawn (hatched)", hand: true, rock: "#ffffff", rockGrid: null, floor: "#ffffff", grid: "#b9b9b9", wall: "#111111", water: "#dfe9ef", wave: "#4f6d80", ink: "#111111", label: "#111111", hatch: null },
  gray: { name: "Ink & paper", rock: "#2b2b2b", rockGrid: null, floor: "#ffffff", grid: "#cfcfcf", wall: "#111111", water: "#d6e6f2", wave: "#5d7a90", ink: "#111111", label: "#111111", hatch: "rgba(255,255,255,.12)" }
};
// icon set (drawn as small vector pictures; all rotate in 90° steps)
const MM_ICONS = [
  ["door", "Door"], ["secret", "Secret door"], ["locked", "Locked door"], ["portcullis", "Portcullis / bars"], ["stairs", "Stairs"], ["ladder", "Ladder"],
  ["trap", "Trap"], ["pit", "Pit"], ["chest", "Chest"], ["crate", "Crate"], ["barrel", "Barrel"], ["altar", "Shrine / altar"],
  ["statue", "Statue"], ["pillar", "Pillar"], ["fountain", "Fountain / well"], ["bed", "Bed"], ["table", "Table"], ["throne", "Throne"],
  ["fire", "Fire / brazier"], ["bones", "Bones"], ["web", "Web"], ["rubble", "Rubble"], ["lever", "Lever"], ["coffin", "Sarcophagus"], ["mark", "X marks"]
];
const MM = {
  st: null,   // {target:{kind,id}, sk, tool, rot, cs, undo:[], title}
  blank(cols = 36, rows = 26) { return { cols, rows, cells: "0".repeat(cols * rows), items: [], labels: [], strokes: [], style: "book", deco: { border: true, title: true, compass: true, scale: true, pos: "tl" } }; },
  cell(sk, x, y) { return x < 0 || y < 0 || x >= sk.cols || y >= sk.rows ? "0" : sk.cells[y * sk.cols + x]; },
  setCell(sk, x, y, v) { if (x < 0 || y < 0 || x >= sk.cols || y >= sk.rows) return; const i = y * sk.cols + x; sk.cells = sk.cells.slice(0, i) + v + sk.cells.slice(i + 1); },

  // ---------- drawing ----------
  draw(cx, sk, cs, opt = {}) { return this.useMask(sk) ? this.drawMask(cx, sk, cs, opt) : this.drawGrid(cx, sk, cs, opt); },
  drawGrid(cx, sk, cs, opt = {}) {
    const T = MM_STYLES[sk.style] || MM_STYLES.blue, W = sk.cols * cs, H = sk.rows * cs;
    cx.save(); cx.fillStyle = T.rock; cx.fillRect(0, 0, W, H);
    if (T.hatch) { cx.strokeStyle = T.hatch; cx.lineWidth = Math.max(1, cs / 16); cx.beginPath(); for (let d = -H; d < W; d += cs / 3) { cx.moveTo(d, H); cx.lineTo(d + H, 0); } cx.stroke(); }
    if (T.rockGrid) { cx.strokeStyle = T.rockGrid; cx.lineWidth = 1; cx.beginPath(); for (let x = 0; x <= sk.cols; x++) { cx.moveTo(x * cs + .5, 0); cx.lineTo(x * cs + .5, H); } for (let y = 0; y <= sk.rows; y++) { cx.moveTo(0, y * cs + .5); cx.lineTo(W, y * cs + .5); } cx.stroke(); }
    const open = v => v !== "0";
    if (T.hand) this.hatch(cx, sk, cs);
    for (let y = 0; y < sk.rows; y++) for (let x = 0; x < sk.cols; x++) {
      const v = this.cell(sk, x, y); if (!open(v)) continue;
      cx.fillStyle = v === "2" ? T.water : T.floor; cx.fillRect(x * cs, y * cs, cs, cs);
    }
    if (T.hand) {   // soft shadow inside the walls (top and left), like a hand-inked dungeon
      cx.fillStyle = "rgba(0,0,0,.16)"; const b = cs * .2;
      for (let y = 0; y < sk.rows; y++) for (let x = 0; x < sk.cols; x++) { if (!open(this.cell(sk, x, y))) continue;
        if (!open(this.cell(sk, x, y - 1))) cx.fillRect(x * cs, y * cs, cs, b);
        if (!open(this.cell(sk, x - 1, y))) cx.fillRect(x * cs, y * cs + (open(this.cell(sk, x, y - 1)) ? 0 : b), b, cs - (open(this.cell(sk, x, y - 1)) ? 0 : b)); }
    }
    // grid on open cells
    cx.strokeStyle = T.grid; cx.lineWidth = Math.max(1, cs / 32); cx.beginPath();
    for (let y = 0; y < sk.rows; y++) for (let x = 0; x < sk.cols; x++) { if (!open(this.cell(sk, x, y))) continue; cx.rect(x * cs + .5, y * cs + .5, cs, cs); }
    cx.stroke();
    // water waves + rubble specks
    for (let y = 0; y < sk.rows; y++) for (let x = 0; x < sk.cols; x++) {
      const v = this.cell(sk, x, y), px = x * cs, py = y * cs;
      if (v === "2") { cx.strokeStyle = T.wave; cx.lineWidth = Math.max(1, cs / 22); for (const k of [0.35, 0.68]) { cx.beginPath(); cx.moveTo(px + cs * .15, py + cs * k); cx.quadraticCurveTo(px + cs * .32, py + cs * (k - .12), px + cs * .5, py + cs * k); cx.quadraticCurveTo(px + cs * .68, py + cs * (k + .12), px + cs * .85, py + cs * k); cx.stroke(); } }
      if (v === "3") { cx.fillStyle = T.ink; const r = (a) => ((x * 73 + y * 151 + a * 37) % 100) / 100; for (let k = 0; k < 6; k++) { cx.beginPath(); cx.arc(px + cs * (.15 + .7 * r(k)), py + cs * (.15 + .7 * r(k + 9)), cs * (.04 + .04 * r(k + 3)), 0, 7); cx.fill(); } }
    }
    // walls: edges between open and rock
    cx.strokeStyle = T.wall; cx.lineWidth = Math.max(2, cs / 7); cx.lineCap = "round"; cx.beginPath();
    for (let y = 0; y <= sk.rows; y++) for (let x = 0; x <= sk.cols; x++) {
      const a = open(this.cell(sk, x, y));
      if (x < sk.cols && a !== open(this.cell(sk, x, y - 1))) { cx.moveTo(x * cs, y * cs); cx.lineTo((x + 1) * cs, y * cs); }
      if (y < sk.rows && a !== open(this.cell(sk, x - 1, y))) { cx.moveTo(x * cs, y * cs); cx.lineTo(x * cs, (y + 1) * cs); }
    }
    cx.stroke();
    (sk.items || []).forEach(it => this.icon(cx, it.t, (it.x + .5) * cs, (it.y + .5) * cs, cs, it.r || 0, T));
    cx.textAlign = "center"; cx.textBaseline = "middle";
    (sk.labels || []).forEach(l => { const big = /^\d{1,3}$/.test(l.text); cx.font = `${big ? 800 : 700} ${cs * (big ? .62 : .42)}px Georgia, serif`;
      cx.lineWidth = cs / 8; cx.strokeStyle = open(this.cell(sk, l.x, l.y)) ? T.floor : T.rock; cx.strokeText(l.text, (l.x + .5) * cs, (l.y + .52) * cs);
      cx.fillStyle = T.label; cx.fillText(l.text, (l.x + .5) * cs, (l.y + .52) * cs); });
    if (opt.preview) { const p = opt.preview; cx.strokeStyle = "#e0a100"; cx.lineWidth = 3; cx.setLineDash([6, 4]); cx.strokeRect(p.x * cs, p.y * cs, p.w * cs, p.h * cs); cx.setLineDash([]); }
    cx.restore();
  },
  // Dyson-style cross-hatching in the rock next to rooms, stippling a little further out
  hatch(cx, sk, cs) {
    const open = (x, y) => this.cell(sk, x, y) !== "0";
    const rnd = (x, y, k) => { const v = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453; return v - Math.floor(v); };
    const near = (x, y, d) => { for (let j = -d; j <= d; j++) for (let i = -d; i <= d; i++) if (open(x + i, y + j)) return true; return false; };
    cx.save(); cx.strokeStyle = "#1a1a1a"; cx.fillStyle = "#1a1a1a"; cx.lineCap = "round";
    for (let y = 0; y < sk.rows; y++) for (let x = 0; x < sk.cols; x++) {
      if (open(x, y)) continue;
      const px = x * cs, py = y * cs;
      if (near(x, y, 1)) {
        cx.save(); cx.beginPath(); cx.rect(px, py, cs, cs); cx.clip(); cx.lineWidth = Math.max(.8, cs / 26);
        for (let k = 0; k < 3; k++) {   // three little bundles of parallel strokes per square
          const cxk = px + cs * (.2 + .6 * rnd(x, y, k)), cyk = py + cs * (.2 + .6 * rnd(x, y, k + 5)), a = rnd(x, y, k + 9) * Math.PI, L = cs * .42;
          const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
          for (let j = -2; j <= 2; j++) { const o = j * cs * .09; cx.beginPath(); cx.moveTo(cxk + nx * o - dx * L / 2, cyk + ny * o - dy * L / 2); cx.lineTo(cxk + nx * o + dx * L / 2, cyk + ny * o + dy * L / 2); cx.stroke(); }
        }
        cx.restore();
      } else if (near(x, y, 2)) {
        for (let k = 0; k < 14; k++) { cx.beginPath(); cx.arc(px + cs * rnd(x, y, k + 20), py + cs * rnd(x, y, k + 40), Math.max(.6, cs / 40), 0, 7); cx.fill(); }
      }
    }
    cx.restore();
  },
  icon(cx, t, X, Y, s, r, T) {
    const ink = T.ink, paper = T.floor;
    cx.save(); cx.translate(X, Y); cx.rotate((r || 0) * Math.PI / 2);
    cx.strokeStyle = ink; cx.fillStyle = ink; cx.lineWidth = Math.max(1.2, s / 16); cx.lineJoin = "round"; cx.lineCap = "round";
    const h = s / 2, P = (...pts) => { cx.beginPath(); pts.forEach(([a, b], i) => i ? cx.lineTo(a * h, b * h) : cx.moveTo(a * h, b * h)); };
    const box = (x, y, w, hh, fill) => { cx.beginPath(); cx.rect(x * h, y * h, w * h, hh * h); if (fill === true) cx.fill(); else { cx.fillStyle = fill || paper; cx.fill(); cx.fillStyle = ink; } cx.stroke(); };
    const circ = (x, y, rr, fill) => { cx.beginPath(); cx.arc(x * h, y * h, rr * h, 0, 7); if (fill === true) cx.fill(); else { cx.fillStyle = fill || paper; cx.fill(); cx.fillStyle = ink; } cx.stroke(); };
    switch (t) {
      case "door": box(-.85, -.28, 1.7, .56); break;
      case "locked": box(-.85, -.28, 1.7, .56); circ(0, 0, .14, true); break;
      case "secret": cx.font = `900 ${s * .62}px Georgia, serif`; cx.textAlign = "center"; cx.textBaseline = "middle"; P([-1, 0], [1, 0]); cx.setLineDash([s / 10, s / 12]); cx.stroke(); cx.setLineDash([]); cx.fillText("S", 0, s * .03); break;
      case "portcullis": P([-.95, 0], [.95, 0]); cx.stroke(); for (let k = -3; k <= 3; k++) { circ(k * .27, 0, .08, true); } break;
      case "stairs": for (let k = 0; k < 6; k++) { const y = -.85 + k * .34, w = .9 - k * .1; P([-w, y], [w, y]); cx.stroke(); } P([-.9, -.85], [-.4, .85]); cx.stroke(); P([.9, -.85], [.4, .85]); cx.stroke(); break;
      case "ladder": P([-.35, -.95], [-.35, .95]); cx.stroke(); P([.35, -.95], [.35, .95]); cx.stroke(); for (let k = -3; k <= 3; k++) { P([-.35, k * .27], [.35, k * .27]); cx.stroke(); } break;
      case "trap": box(-.7, -.7, 1.4, 1.4); cx.font = `900 ${s * .62}px Georgia, serif`; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.fillText("T", 0, s * .04); break;
      case "pit": box(-.75, -.75, 1.5, 1.5); P([-.75, -.75], [.75, .75]); cx.stroke(); P([.75, -.75], [-.75, .75]); cx.stroke(); P([0, -.75], [.75, 0]); cx.stroke(); P([-.75, 0], [0, .75]); cx.stroke(); P([0, -.75], [-.75, 0]); cx.stroke(); P([.75, 0], [0, .75]); cx.stroke(); break;
      case "chest": box(-.7, -.45, 1.4, .9); P([-.7, -.12], [.7, -.12]); cx.stroke(); box(-.12, -.22, .24, .26, true); break;
      case "crate": box(-.65, -.65, 1.3, 1.3); P([-.65, -.65], [.65, .65]); cx.stroke(); box(-.65, -.65, 1.3, 1.3, "transparent"); break;
      case "barrel": circ(0, 0, .62); circ(0, 0, .4, "transparent"); circ(0, 0, .1, true); break;
      case "altar": box(-.8, -.42, 1.6, .84); P([0, -.28], [0, .28]); cx.stroke(); P([-.2, -.08], [.2, -.08]); cx.stroke(); circ(-.58, 0, .09, true); circ(.58, 0, .09, true); break;
      case "statue": { circ(0, 0, .78); cx.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = (k % 2 ? .24 : .55) * h; cx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } cx.closePath(); cx.fill(); break; }
      case "pillar": circ(0, 0, .55, true); break;
      case "fountain": circ(0, 0, .8); circ(0, 0, .5, "transparent"); circ(0, 0, .16, true); break;
      case "bed": box(-.5, -.85, 1, 1.7); box(-.38, -.75, .76, .35); P([-.5, -.25], [.5, -.25]); cx.stroke(); break;
      case "table": box(-.75, -.5, 1.5, 1); break;
      case "throne": P([-.55, .6], [-.55, -.7], [.55, -.7], [.55, .6]); cx.stroke(); box(-.55, -.2, 1.1, .8); box(-.55, -.85, 1.1, .3, true); break;
      case "fire": cx.beginPath(); cx.moveTo(0, -.85 * h); cx.bezierCurveTo(.15 * h, -.4 * h, .7 * h, -.2 * h, .6 * h, .3 * h); cx.bezierCurveTo(.5 * h, .85 * h, -.5 * h, .85 * h, -.6 * h, .3 * h); cx.bezierCurveTo(-.65 * h, -.05 * h, -.3 * h, -.2 * h, -.25 * h, -.45 * h); cx.bezierCurveTo(-.05 * h, -.3 * h, 0, -.55 * h, 0, -.85 * h); cx.fill(); break;
      case "bones": P([-.6, -.6], [.6, .6]); cx.stroke(); P([.6, -.6], [-.6, .6]); cx.stroke(); [[-.6, -.6], [.6, .6], [.6, -.6], [-.6, .6]].forEach(([a, b]) => circ(a, b, .12, true)); circ(0, -.05, .28); break;
      case "web": for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; P([0, 0], [Math.cos(a) * .95, Math.sin(a) * .95]); cx.stroke(); } [.35, .65, .92].forEach(rr => { cx.beginPath(); for (let k = 0; k <= 8; k++) { const a = k * Math.PI / 4; cx.lineTo(Math.cos(a) * rr * h, Math.sin(a) * rr * h); } cx.stroke(); }); break;
      case "rubble": [[-.5, -.4, .22], [.3, -.5, .17], [.45, .3, .25], [-.35, .45, .18], [0, 0, .14], [-.7, .05, .1], [.7, -.1, .1]].forEach(([a, b, rr]) => { cx.beginPath(); for (let k = 0; k < 5; k++) { const an = k * 1.3 + a * 3; cx.lineTo((a + Math.cos(an) * rr) * h, (b + Math.sin(an) * rr) * h); } cx.closePath(); cx.fill(); }); break;
      case "lever": box(-.45, .25, .9, .35); P([0, .3], [.45, -.7]); cx.stroke(); circ(.45, -.7, .14, true); break;
      case "coffin": cx.beginPath(); [[-.25, -.9], [.25, -.9], [.45, -.45], [.3, .9], [-.3, .9], [-.45, -.45]].forEach(([a, b], i) => i ? cx.lineTo(a * h, b * h) : cx.moveTo(a * h, b * h)); cx.closePath(); cx.fillStyle = paper; cx.fill(); cx.stroke(); cx.fillStyle = ink; P([0, -.55], [0, .4]); cx.stroke(); P([-.18, -.25], [.18, -.25]); cx.stroke(); break;
      case "mark": cx.lineWidth = s / 8; P([-.55, -.55], [.55, .55]); cx.stroke(); P([.55, -.55], [-.55, .55]); cx.stroke(); break;
    }
    cx.restore();
  },
  iconImg(t, style) { const c = document.createElement("canvas"); c.width = c.height = 34; const cx = c.getContext("2d"); const T = MM_STYLES[style] || MM_STYLES.blue; cx.fillStyle = T.floor; cx.fillRect(0, 0, 34, 34); this.icon(cx, t, 17, 17, 30, 0, T); return c.toDataURL(); },
  render(sk, cs = 40, title) { const Mg = this.margin(sk), c = document.createElement("canvas"); c.width = (sk.cols + 2 * Mg) * cs; c.height = (sk.rows + 2 * Mg) * cs; this.draw(c.getContext("2d"), sk, cs, { title }); return c; },

  // ---------- editor ----------
  open(target, sk, title) {
    const k = clone(sk); k.strokes ||= [];
    this.st = { target, sk: k, tool: "room", rot: 0, brush: 1, cs: Math.max(18, Math.min(34, Math.floor((Math.min(window.innerWidth, 1400) - 40) / (sk.cols + 4)))), undo: [], redo: [], title: title || "" };
    try { document.fonts && document.fonts.load(`700 40px ${MM_FONT}`).then(() => this.st && this.paint()); } catch (e) { }
    let el = document.getElementById("mm"); if (!el) { el = document.createElement("div"); el.id = "mm"; document.body.appendChild(el); }
    el.classList.remove("hidden"); document.body.classList.add("mm-open"); this.ui();
  },
  ui() {
    const st = this.st, sk = st.sk, el = document.getElementById("mm");
    const tools = [["room", "▭", "Room (drag a rectangle)"], ["floor", "🖌", "Floor / corridor (paint)"], ["cave", "🪨", "Cave brush (free shapes)"], ["wbrush", "🌊", "Water brush (rivers, pools)"], ["erase", '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M14.5 3.5l6 6-9.5 9.5H6l-3-3z"/><path d="M9.5 8.5l6 6" /><path d="M3 16l3 3" /><path d="M11 19h9" stroke-linecap="round"/><path d="M14.5 3.5l6 6-5 5-6-6z" fill="currentColor" opacity=".35"/></svg>', "Eraser (back to rock, removes icons)"], ["water", "≈", "Water squares"], ["rubble", "∴", "Rubble floor"], ["label", "1", "Number or text"], ["pan", "✋", "Scroll / move around"]];
    el.innerHTML = `<div class="mm-top"><b>✏ Map maker</b><input id="mm_title" value="${esc(st.title)}" placeholder="Map name" style="width:160px">
        <label class="small">Style <select id="mm_style">${Object.entries(MM_STYLES).map(([k, v]) => `<option value="${k}" ${sk.style === k ? "selected" : ""}>${v.name}</option>`).join("")}</select></label>
        <label class="small">Size <input id="mm_cols" type="number" value="${sk.cols}" min="5" max="120" style="width:52px">×<input id="mm_rows" type="number" value="${sk.rows}" min="5" max="120" style="width:52px"><button class="small ghost" data-act="mmResize">Apply</button></label>
        <label class="small">Brush <select id="mm_brush">${[[0.5, "1 square"], [0.75, "1½ squares"], [1, "2 squares"], [1.5, "3 squares"], [2, "4 squares"], [3, "6 squares"]].map(([v, l]) => `<option value="${v}" ${+st.brush === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="small">Zoom <input id="mm_zoom" type="range" min="10" max="60" value="${st.cs}" style="width:90px"></label>
        <button class="small ghost" data-act="mmUndo" ${st.undo.length ? "" : "disabled"} title="Undo (Ctrl+Z)">↶ Undo</button><button class="small ghost" data-act="mmRedo" ${st.redo.length ? "" : "disabled"} title="Redo (Ctrl+Y)">↷ Redo</button><button class="small ghost" data-act="mmClear">Clear</button>
        <span class="right row"><button class="ghost" data-act="mmCancel">Cancel</button><button data-act="mmSave">✔ Save map</button></span></div>
      ${MM_STYLES[sk.style]?.book ? `<div class="mm-top mm-deco small"><b>On the map:</b>${[["title", "Title (the map name)"], ["compass", "Compass rose"], ["scale", "Scale"], ["border", "Paper border"]].map(([k, l]) => `<label><input type="checkbox" data-deco="${k}" ${(sk.deco?.[k] ?? true) ? "checked" : ""}> ${l}</label>`).join("")}
        <label>Title in the <select id="mm_pos">${[["tl", "top left"], ["tr", "top right"], ["bl", "bottom left"], ["br", "bottom right"]].map(([v, l]) => `<option value="${v}" ${(sk.deco?.pos || "tl") === v ? "selected" : ""}>${l}</option>`).join("")}</select> corner</label></div>` : ""}
      <div class="mm-body"><div class="mm-tools">${tools.map(([k, i, l]) => `<button class="mmt ${st.tool === k ? "on" : ""}" data-act="mmTool" data-k="${k}" title="${l}"><span>${i}</span><small>${l.split(" (")[0]}</small></button>`).join("")}
          <button class="mmt" data-act="mmRot" title="Rotate the next icon (tap a placed icon with the same tool to turn it)"><span style="display:inline-block;transform:rotate(${st.rot * 90}deg)">➜</span><small>Rotate ${st.rot * 90}°</small></button>
          <div class="mm-sep">Icons</div>${MM_ICONS.map(([k, l]) => `<button class="mmt ico ${st.tool === "i:" + k ? "on" : ""}" data-act="mmTool" data-k="i:${k}" title="${l}"><img src="${this.iconImg(k, sk.style)}" alt=""><small>${l}</small></button>`).join("")}</div>
        <div class="mm-canvas" id="mm_wrap"><canvas id="mm_cv"></canvas></div></div>
      <div class="mm-hint small">${st.tool === "pan" ? "Drag to look around." : st.tool.startsWith("i:") ? "Tap a square to place the icon · tap it again to turn it · ⌫ Erase removes it." : st.tool === "label" ? "Tap a square to write a room number or text · tap a label to change or delete it." : st.tool === "room" ? "Drag a rectangle to carve out a room." : st.tool === "cave" ? "Paint freely to carve out caves with natural, uneven walls (brush size at the top)." : st.tool === "wbrush" ? "Paint rivers, streams and pools — the water flows in the direction you paint." : st.tool === "erase" ? "Drag to turn floor back into rock (squares and brush shapes); tap an icon or label to remove it." : "Drag over squares to paint."}</div>`;
    this.paint();
  },
  paint(preview) {
    const st = this.st, cv = document.getElementById("mm_cv"); if (!cv) return;
    const Mg = this.margin(st.sk); cv.width = (st.sk.cols + 2 * Mg) * st.cs; cv.height = (st.sk.rows + 2 * Mg) * st.cs;
    cv.style.touchAction = st.tool === "pan" ? "auto" : "none";
    this.draw(cv.getContext("2d"), st.sk, st.cs, { preview, title: st.title, brush: st.hover && this.isBrush() ? { ...st.hover, r: st.brush } : null });
  },
  snap() { const st = this.st; st.undo.push(JSON.stringify(st.sk)); if (st.undo.length > 500) st.undo.shift(); st.redo = []; },
  undo() { const st = this.st, u = st.undo.pop(); if (!u) return; st.redo.push(JSON.stringify(st.sk)); st.sk = JSON.parse(u); this.ui(); },
  redo() { const st = this.st, r = st.redo.pop(); if (!r) return; st.undo.push(JSON.stringify(st.sk)); st.sk = JSON.parse(r); this.ui(); },
  atF(e) { const r = document.getElementById("mm_cv").getBoundingClientRect(), Mg = this.margin(this.st.sk); return { x: (e.clientX - r.left) / this.st.cs - Mg, y: (e.clientY - r.top) / this.st.cs - Mg }; },
  at(e) { const p = this.atF(e); return { x: Math.floor(p.x), y: Math.floor(p.y) }; },
  isBrush() { const t = this.st.tool; return t === "cave" || t === "wbrush" || (t === "erase" && (this.st.sk.strokes || []).length); },
  brushStart(k, p) { const s = { k, r: +this.st.brush || 1, seed: Math.floor(Math.random() * 1e6), pts: [[+p.x.toFixed(2), +p.y.toFixed(2)]] }; (this.st.sk.strokes ||= []).push(s); this.drag.stroke = s; },
  brushTo(p) { const s = this.drag.stroke; if (!s) return; const l = s.pts[s.pts.length - 1]; if (Math.hypot(p.x - l[0], p.y - l[1]) < 0.18) return; s.pts.push([+p.x.toFixed(2), +p.y.toFixed(2)]); },
  apply(p) {
    const st = this.st, sk = st.sk, t = st.tool;
    if (t === "floor") this.setCell(sk, p.x, p.y, "1");
    else if (t === "water") this.setCell(sk, p.x, p.y, "2");
    else if (t === "rubble") this.setCell(sk, p.x, p.y, "3");
    else if (t === "erase") {
      const had = sk.items.length + sk.labels.length;
      sk.items = sk.items.filter(i => !(i.x === p.x && i.y === p.y)); sk.labels = sk.labels.filter(l => !(l.x === p.x && l.y === p.y));
      if (had === sk.items.length + sk.labels.length) this.setCell(sk, p.x, p.y, "0");
    }
  },
  down(e) {
    const st = this.st; if (!st || st.tool === "pan") return;
    const p = this.at(e), pf = this.atF(e);
    const brush = st.tool === "cave" || st.tool === "wbrush";
    if (!brush && (p.x < 0 || p.y < 0 || p.x >= st.sk.cols || p.y >= st.sk.rows)) return;
    e.preventDefault(); e.target.setPointerCapture?.(e.pointerId);
    this.snap();
    if (brush) { this.drag = { start: p, last: p }; this.brushStart(st.tool === "cave" ? "cave" : "water", pf); this.paint(); return; }
    if (st.tool.startsWith("i:")) {
      const t = st.tool.slice(2), ex = st.sk.items.find(i => i.x === p.x && i.y === p.y);
      if (ex && ex.t === t) ex.r = ((ex.r || 0) + 1) % 4; else { st.sk.items = st.sk.items.filter(i => i !== ex); let r = st.rot;
        if (!r && ["door", "secret", "locked", "portcullis"].includes(t)) { const o = (dx, dy) => this.cell(st.sk, p.x + dx, p.y + dy) !== "0"; if (o(-1, 0) && o(1, 0) && !(o(0, -1) && o(0, 1))) r = 1; }   // a door crosses the corridor
        st.sk.items.push({ t, x: p.x, y: p.y, r }); if (this.cell(st.sk, p.x, p.y) === "0") this.setCell(st.sk, p.x, p.y, "1"); }
      this.paint(); this.ui(); return;
    }
    if (st.tool === "label") {
      const ex = st.sk.labels.find(l => l.x === p.x && l.y === p.y);
      const next = String(1 + st.sk.labels.filter(l => /^\d+$/.test(l.text)).reduce((m, l) => Math.max(m, +l.text), 0));
      const txt = prompt(ex ? "Change the text (empty = delete):" : "Room number or text:", ex ? ex.text : next);
      if (txt === null) { st.undo.pop(); return; }
      if (ex) { if (txt.trim()) ex.text = txt.trim(); else st.sk.labels = st.sk.labels.filter(l => l !== ex); } else if (txt.trim()) st.sk.labels.push({ x: p.x, y: p.y, text: txt.trim() });
      this.ui(); return;
    }
    this.drag = { start: p, last: p };
    if (st.tool === "erase" && (st.sk.strokes || []).some(s => s.k !== "erase")) this.brushStart("erase", pf);
    if (st.tool !== "room") { this.apply(p); this.paint(); }
    else this.paint({ x: p.x, y: p.y, w: 1, h: 1 });
  },
  move(e) {
    const d = this.drag; if (!d) return; const st = this.st;
    if (d.stroke) { this.brushTo(this.atF(e)); st.hover = this.atF(e); if (st.tool !== "erase") return this.paintSoon(); }
    const p = this.at(e); if (p.x === d.last.x && p.y === d.last.y) return d.stroke && this.paintSoon();
    if (st.tool === "room") { const x = Math.min(d.start.x, p.x), y = Math.min(d.start.y, p.y); this.paint({ x, y, w: Math.abs(p.x - d.start.x) + 1, h: Math.abs(p.y - d.start.y) + 1 }); }
    else { // fill the gap between pointer samples
      const n = Math.max(Math.abs(p.x - d.last.x), Math.abs(p.y - d.last.y));
      for (let k = 1; k <= n; k++) this.apply({ x: Math.round(d.last.x + (p.x - d.last.x) * k / n), y: Math.round(d.last.y + (p.y - d.last.y) * k / n) });
      this.paintSoon();
    }
    d.last = p;
  },
  up(e) {
    const d = this.drag; if (!d) return; this.drag = null; const st = this.st;
    if (st.tool === "room") { const p = this.at(e); const x0 = Math.max(0, Math.min(d.start.x, p.x)), y0 = Math.max(0, Math.min(d.start.y, p.y)), x1 = Math.min(st.sk.cols - 1, Math.max(d.start.x, p.x)), y1 = Math.min(st.sk.rows - 1, Math.max(d.start.y, p.y));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.cell(st.sk, x, y) === "0") this.setCell(st.sk, x, y, "1"); }
    this.ui();
  },
  paintSoon() { if (this._raf) return; this._raf = requestAnimationFrame(() => { this._raf = null; this.paint(); }); },
  close() { this.st = null; document.getElementById("mm")?.classList.add("hidden"); document.body.classList.remove("mm-open"); }
};
document.addEventListener("pointerdown", e => { if (e.target.id === "mm_cv") MM.down(e); });
document.addEventListener("pointermove", e => { if (MM.drag) return MM.move(e); if (MM.st && e.target.id === "mm_cv" && MM.isBrush()) { MM.st.hover = MM.atF(e); MM.paintSoon(); } });
document.addEventListener("pointerup", e => { if (MM.drag) MM.up(e); });
document.addEventListener("change", e => {
  if (!MM.st) return;
  if (e.target.id === "mm_style") { MM.st.sk.style = e.target.value; MM.st.sk.deco ||= { border: true, title: true, compass: true, scale: true, pos: "tl" }; MM.ui(); }
  if (e.target.id === "mm_brush") { MM.st.brush = +e.target.value; }
  if (e.target.dataset.deco) { MM.snap(); (MM.st.sk.deco ||= {})[e.target.dataset.deco] = e.target.checked; MM.ui(); }
  if (e.target.id === "mm_pos") { MM.snap(); (MM.st.sk.deco ||= {}).pos = e.target.value; MM.ui(); }
  if (e.target.id === "mm_title") { MM.st.title = e.target.value; MM.paint(); }
});
// Ctrl+Z undo, Ctrl+Y (or Ctrl+Shift+Z) redo while the map maker is open
document.addEventListener("keydown", e => {
  if (!MM.st || !(e.ctrlKey || e.metaKey) || (e.target.matches("input[type=text], input:not([type]), textarea") && e.target.id !== "mm_zoom")) return;
  const k = e.key.toLowerCase();
  if (k === "z" && !e.shiftKey) { e.preventDefault(); MM.undo(); } else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); MM.redo(); }
});
document.addEventListener("input", e => { if (MM.st && e.target.id === "mm_zoom") { MM.st.cs = +e.target.value; MM.paint(); } });

// where the drawing goes: an overview map block or a battlemap
function mmTarget(t) { return t.kind === "block" ? S.scen.blocks.find(b => b.id === t.id) : S.scen.battlemaps.find(b => b.id === t.id); }
function mmThumb(cv) { const k = 320 / Math.max(cv.width, cv.height), t = document.createElement("canvas"); t.width = Math.round(cv.width * k); t.height = Math.round(cv.height * k); t.getContext("2d").drawImage(cv, 0, 0, t.width, t.height); return t.toDataURL("image/jpeg", 0.75); }
Object.assign(ACT, {
  mmTool: el => { MM.st.tool = el.dataset.k; MM.ui(); },
  mmRot: () => { MM.st.rot = (MM.st.rot + 1) % 4; MM.ui(); },
  mmUndo: () => MM.undo(),
  mmRedo: () => MM.redo(),
  mmClear: () => { if (!confirm("Clear the whole drawing?")) return; MM.snap(); const s = MM.st.sk; Object.assign(s, MM.blank(s.cols, s.rows), { style: s.style, deco: s.deco }); MM.ui(); },
  mmResize: () => { const s = MM.st.sk, c = Math.max(5, Math.min(120, +$("#mm_cols").value || s.cols)), r = Math.max(5, Math.min(120, +$("#mm_rows").value || s.rows)); MM.snap();
    let cells = ""; for (let y = 0; y < r; y++) for (let x = 0; x < c; x++) cells += MM.cell(s, x, y);
    Object.assign(s, { cols: c, rows: r, cells, items: s.items.filter(i => i.x < c && i.y < r), labels: s.labels.filter(l => l.x < c && l.y < r) }); MM.ui(); },
  mmCancel: () => { const st = MM.st; if (st.undo.length && !confirm("Close without saving the changes?")) return;
    if (st.isNew) { if (st.target.kind === "block") S.scen.blocks = S.scen.blocks.filter(b => b.id !== st.target.id); else S.scen.battlemaps = S.scen.battlemaps.filter(b => b.id !== st.target.id); }
    MM.close(); render(); },
  mmSave: async () => {
    const st = MM.st; st.title = $("#mm_title")?.value || st.title;
    try { await Promise.race([document.fonts.load(`700 40px ${MM_FONT}`), new Promise(r => setTimeout(r, 1500))]); } catch (e) { }
    (st.sk.deco ||= {}).text = st.title;
    const book = MM_STYLES[st.sk.style]?.book, cs = st.target.kind === "map" ? (book ? 60 : 70) : 40, cv = MM.render(st.sk, cs, st.title), image = book ? cv.toDataURL("image/webp", 0.9) : cv.toDataURL("image/png"), thumb = mmThumb(cv);
    const Mg = MM.margin(st.sk);
    const t = mmTarget(st.target); if (!t) return MM.close();
    if (st.target.kind === "block") { t.sketch = st.sk; t.map = { image, w: cv.width, h: cv.height }; t.thumb = thumb; if (st.title) t.title = st.title; (S.ui.z ||= {})[t.id] = null; }
    else { t.sketch = st.sk; Object.assign(t, { image, thumb, w: cv.width, h: cv.height }); if (st.title) t.name = st.title;
      t.grid = { ...(t.grid || {}), cols: st.sk.cols + 2 * Mg, rows: st.sk.rows + 2 * Mg, ox: 0, oy: 0, show: false }; S.ui.bmZ = null; }
    MM.close(); save(); render(); if (st.target.kind === "map") pushTable?.(true); toast("Map saved");
  },
  drawBlock: el => { const at = +el.dataset.at, b = { id: "m" + uid(), type: "map", title: "", map: null, sketch: MM.blank() };
    S.scen.blocks.splice(at, 0, b); MM.open({ kind: "block", id: b.id }, b.sketch, ""); MM.st.isNew = true; },
  drawMap: () => { const sk = MM.blank(30, 22), b = { id: uid(), name: "Drawn map", image: "", thumb: "", w: 0, h: 0, grid: { cols: 34, rows: 26, ox: 0, oy: 0, show: false, color: "#000000", opacity: 0.35 }, tokens: [], sketch: sk };
    S.scen.battlemaps.push(b); MM.open({ kind: "map", id: b.id }, sk, "Drawn map"); MM.st.isNew = true; },
  editDrawing: el => { const kind = el.dataset.k, t = kind === "block" ? S.scen.blocks.find(b => b.id === el.dataset.id) : S.scen.battlemaps.find(b => b.id === el.dataset.id); if (!t?.sketch) return;
    MM.open({ kind, id: t.id }, t.sketch, t.title || t.name || ""); }
});
