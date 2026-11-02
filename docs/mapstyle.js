"use strict";
/* ============ Map maker: "stone & water" look (like the dungeon maps in the books) + free cave / water brushes ============
   The map is built from a mask: grid squares + brush strokes (cave, water, eraser). Walls are drawn by growing the
   mask a little in black, floors and water are textured, and the whole map gets a torn paper border, a title,
   a compass rose and the scale. Strokes are stored in the sketch: sk.strokes = [{k:"cave"|"water"|"erase", r, seed, pts:[[x,y],…]}] (in squares). */
MM_STYLES.book = { name: "Dungeon book (stone & water)", book: true, rock: "#4a5260", floor: "#d4d2cd", grid: "rgba(38,42,50,.30)", wall: "#141414", water: "#6f97bf", wave: "#eaf3fb", ink: "#1e1e1e", label: "#1e1e1e" };
const MM_FONT = "Cinzel, 'Cinzel Decorative', Georgia, 'Times New Roman', serif";
// fonts for the title and labels (free Google fonts; plain serif when offline)
const MM_FONTS = {
  pirata: { name: "Blackletter (old map)", css: "'Pirata One', 'UnifrakturMaguntia', Georgia, serif", w: 400, sx: 1, caps: false },
  grenze: { name: "Gothic, bold", css: "'Grenze Gotisch', 'Pirata One', Georgia, serif", w: 700, sx: 1, caps: false },
  fraktur: { name: "Fraktur (ornate)", css: "'UnifrakturMaguntia', 'Pirata One', Georgia, serif", w: 400, sx: 1, caps: false },
  medieval: { name: "Medieval hand", css: "'MedievalSharp', Georgia, serif", w: 400, sx: 1, caps: false },
  cinzel: { name: "Book capitals", css: MM_FONT, w: 700, sx: 0.78, caps: true }
};
function mmFont(sk) { return MM_FONTS[sk.deco?.font] || MM_FONTS.pirata; }
const MM_TEX = new Map();
function mmRand(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
function mmCanvas(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
Object.assign(MM, {
  margin(sk) { return MM_STYLES[sk.style]?.book && (sk.deco?.border ?? true) ? 2 : 0; },
  useMask(sk) { return MM_STYLES[sk.style]?.book || (sk.strokes || []).some(s => s.k !== "erase"); },
  // brush stroke as overlapping circles; caves get lumpy edges, water stays smooth
  stamp(cx, s, cs, off) {
    const r = mmRand(s.seed || 7), pts = s.pts || [], R = (+s.r || 1) * cs, lumpy = s.k === "cave" || s.k === "pit";
    const dot = (x, y, rr) => { cx.moveTo(x + rr, y); cx.arc(x, y, Math.max(1, rr), 0, Math.PI * 2); };
    const rock = (x, y, rr) => { const pit = s.k === "pit", n = (pit ? 11 : 7) + Math.floor(r() * 4), a0 = r() * 6.3; for (let k = 0; k <= n; k++) { const a = a0 + k / n * Math.PI * 2, q = rr * (pit ? 0.86 + 0.22 * r() : 0.72 + 0.42 * r()); k ? cx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q) : cx.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } cx.closePath(); };
    cx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[i + 1] || a, d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(d / 0.2));
      for (let k = 0; k < n; k++) {
        if (lumpy && k % 2 && s.k !== "pit") continue;
        const t = k / n, x = off + (a[0] + (b[0] - a[0]) * t) * cs, y = off + (a[1] + (b[1] - a[1]) * t) * cs;
        if (lumpy) { rock(x, y, R * (0.85 + 0.2 * r())); if (r() < 0.35) { const ang = r() * Math.PI * 2, dd = R * (0.6 + 0.35 * r()); rock(x + Math.cos(ang) * dd, y + Math.sin(ang) * dd, R * (0.22 + 0.25 * r())); } }
        else dot(x, y, R * (s.k === "water" ? 0.94 + 0.1 * r() : 1));
      }
    }
    cx.fill();
  },
  buildMasks(sk, cs, W, H, off) {
    const M = mmCanvas(W, H), Wm = mmCanvas(W, H), Pm = mmCanvas(W, H), m = M.getContext("2d"), w = Wm.getContext("2d"), p = Pm.getContext("2d");
    m.fillStyle = w.fillStyle = p.fillStyle = "#000";
    for (let y = 0; y < sk.rows; y++) for (let x = 0; x < sk.cols; x++) { const v = this.cell(sk, x, y); if (v === "0") continue;
      m.fillRect(off + x * cs - 0.5, off + y * cs - 0.5, cs + 1, cs + 1); if (v === "2") w.fillRect(off + x * cs - 0.5, off + y * cs - 0.5, cs + 1, cs + 1); }
    for (const s of sk.strokes || []) {
      if (s.k === "erase") { m.globalCompositeOperation = w.globalCompositeOperation = p.globalCompositeOperation = "destination-out"; this.stamp(m, s, cs, off); this.stamp(w, s, cs, off); this.stamp(p, s, cs, off); m.globalCompositeOperation = w.globalCompositeOperation = p.globalCompositeOperation = "source-over"; }
      else { this.stamp(m, s, cs, off); if (s.k === "water" || s.k === "foam") this.stamp(w, s, cs, off); if (s.k === "pit") this.stamp(p, s, cs, off); }
    }
    w.globalCompositeOperation = "destination-in"; w.drawImage(M, 0, 0); w.globalCompositeOperation = "source-over";
    return { M, Wm, Pm };
  },
  tint(src, color) { const c = mmCanvas(src.width, src.height), x = c.getContext("2d"); x.drawImage(src, 0, 0); x.globalCompositeOperation = "source-in"; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height); return c; },
  dilate(cx, src, rad) { const n = 16; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; cx.drawImage(src, Math.cos(a) * rad, Math.sin(a) * rad); } cx.drawImage(src, 0, 0); },
  canBlur: (() => { try { const c = document.createElement("canvas").getContext("2d"); return "filter" in c; } catch (e) { return false; } })(),
  rockTex(W, H, cs, T) {
    const key = ["rock", W, H, cs, T.rock].join("|"); if (MM_TEX.has(key)) return MM_TEX.get(key);
    const c = mmCanvas(W, H), x = c.getContext("2d"), r = mmRand(W * 7 + H);
    x.fillStyle = T.rock; x.fillRect(0, 0, W, H);
    if (T.book) {
      for (let i = 0; i < W * H / (cs * cs) * 1.2; i++) { const px = r() * W, py = r() * H, rad = cs * (0.8 + r() * 3.5), lt = r() < 0.5;
        const g = x.createRadialGradient(px, py, 0, px, py, rad); g.addColorStop(0, lt ? "rgba(120,130,146,.22)" : "rgba(28,32,40,.25)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(px - rad, py - rad, rad * 2, rad * 2); }
      x.fillStyle = "rgba(255,255,255,.05)"; for (let i = 0; i < W * H / 60; i++) x.fillRect(r() * W, r() * H, 1, 1);
      x.fillStyle = "rgba(0,0,0,.10)"; for (let i = 0; i < W * H / 60; i++) x.fillRect(r() * W, r() * H, 1, 1);
    }
    MM_TEX.set(key, c); return c;
  },
  floorTex(W, H, cs, T, off) {
    const key = ["floor", W, H, cs, T.floor, off].join("|"); if (MM_TEX.has(key)) return MM_TEX.get(key);
    const c = mmCanvas(W, H), x = c.getContext("2d"), r = mmRand(H * 13 + W);
    x.fillStyle = T.floor; x.fillRect(0, 0, W, H);
    if (T.book) {
      for (let py = off % cs - cs; py < H; py += cs) for (let px = off % cs - cs; px < W; px += cs) {   // one flagstone per square
        const v = Math.round((r() - 0.5) * 18); x.fillStyle = v > 0 ? `rgba(255,255,255,${v / 90})` : `rgba(40,40,46,${-v / 90})`; x.fillRect(px, py, cs, cs);
        x.fillStyle = "rgba(30,30,36,.07)"; for (let k = 0; k < 5; k++) x.fillRect(px + r() * cs, py + r() * cs, 1.5, 1.5);
        if (r() < 0.16) { x.strokeStyle = "rgba(40,40,46,.28)"; x.lineWidth = Math.max(0.6, cs / 60); x.beginPath(); let qx = px + r() * cs, qy = py + r() * cs; x.moveTo(qx, qy);
          for (let k = 0; k < 3; k++) { qx += (r() - 0.5) * cs * 0.5; qy += (r() - 0.5) * cs * 0.5; x.lineTo(qx, qy); } x.stroke(); }
      }
      for (let i = 0; i < W * H / (cs * cs) * 0.5; i++) { const px = r() * W, py = r() * H, rad = cs * (1 + r() * 3); const g = x.createRadialGradient(px, py, 0, px, py, rad);
        g.addColorStop(0, r() < 0.5 ? "rgba(70,74,84,.10)" : "rgba(255,255,255,.12)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(px - rad, py - rad, rad * 2, rad * 2); }
    }
    MM_TEX.set(key, c); return c;
  },
  // ---------- the whole picture ----------
  drawMask(cx, sk, cs, opt = {}) {
    const T = MM_STYLES[sk.style] || MM_STYLES.book, Mg = this.margin(sk), off = Mg * cs, W = (sk.cols + 2 * Mg) * cs, H = (sk.rows + 2 * Mg) * cs;
    const { M, Wm, Pm } = this.buildMasks(sk, cs, W, H, off), wallW = Math.max(2, cs * 0.13);
    cx.save(); cx.clearRect(0, 0, W, H);
    cx.drawImage(this.rockTex(W, H, cs, T), 0, 0);
    // walls: the floor shape grown a little, in black (works for squares and free shapes alike)
    const Mw = this.tint(M, T.wall); this.dilate(cx, Mw, wallW);
    // floor layer
    const L = mmCanvas(W, H), l = L.getContext("2d");
    l.drawImage(this.floorTex(W, H, cs, T, off), 0, 0);
    // rubble squares
    const rr = mmRand(99); l.fillStyle = T.book ? "rgba(70,66,60,.55)" : T.ink;
    for (let y = 0; y < sk.rows; y++) for (let x = 0; x < sk.cols; x++) if (this.cell(sk, x, y) === "3") for (let k = 0; k < 7; k++) { l.beginPath(); l.arc(off + (x + 0.12 + 0.76 * rr()) * cs, off + (y + 0.12 + 0.76 * rr()) * cs, cs * (0.04 + 0.06 * rr()), 0, 7); l.fill(); }
    // water: dark bank, blue body with soft depth, white flow streaks
    if (sk.strokes?.some(s => s.k === "water" || s.k === "foam") || sk.cells.includes("2")) {
      const Wl = mmCanvas(W, H), w = Wl.getContext("2d");
      this.dilate(l, this.tint(Wm, T.book ? "rgba(40,62,88,.85)" : T.wave), Math.max(1.5, cs * 0.06));
      const g = w.createLinearGradient(0, 0, W, H); g.addColorStop(0, T.water); g.addColorStop(0.5, T.book ? "#5f88b2" : T.water); g.addColorStop(1, T.water);
      w.fillStyle = g; w.fillRect(0, 0, W, H);
      if (T.book) { const r2 = mmRand(5); for (let i = 0; i < W * H / (cs * cs) * 0.6; i++) { const px = r2() * W, py = r2() * H, rad = cs * (0.6 + r2() * 2); const gg = w.createRadialGradient(px, py, 0, px, py, rad); gg.addColorStop(0, r2() < 0.5 ? "rgba(255,255,255,.14)" : "rgba(30,60,95,.18)"); gg.addColorStop(1, "rgba(0,0,0,0)"); w.fillStyle = gg; w.fillRect(px - rad, py - rad, rad * 2, rad * 2); } }
      // streaks along each water stroke
      w.strokeStyle = T.wave; w.lineCap = "round";
      for (const s of sk.strokes || []) { if (s.k !== "water" || (s.pts || []).length < 2) continue; const r3 = mmRand((s.seed || 3) + 11);
        for (let j = -1.5; j <= 1.5; j += 1) { w.globalAlpha = 0.16 + 0.22 * r3(); w.lineWidth = Math.max(1, cs * (0.035 + 0.05 * r3())); w.setLineDash([cs * (1.6 + r3() * 2.4), cs * (0.8 + r3() * 1.6)]); w.lineDashOffset = r3() * cs * 3;
          w.beginPath(); s.pts.forEach((p, i) => { const q = s.pts[Math.min(i + 1, s.pts.length - 1)], pp = s.pts[Math.max(i - 1, 0)], dx = q[0] - pp[0], dy = q[1] - pp[1], dl = Math.hypot(dx, dy) || 1;
            const o = j * (+s.r || 1) * 0.36, X = off + (p[0] - dy / dl * o) * cs, Y = off + (p[1] + dx / dl * o) * cs; i ? w.lineTo(X, Y) : w.moveTo(X, Y); }); w.stroke(); } }
      // rapids / foam: white churn along foam strokes
      for (const s of sk.strokes || []) { if (s.k !== "foam") continue; const r4 = mmRand((s.seed || 5) + 23), R = (+s.r || 1) * cs, pts = s.pts || [];
        w.setLineDash([]); w.globalAlpha = 1;
        for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[Math.min(i + 1, pts.length - 1)], X = off + p[0] * cs, Y = off + p[1] * cs, ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
          const g = w.createRadialGradient(X, Y, 0, X, Y, R); g.addColorStop(0, "rgba(235,244,252,.55)"); g.addColorStop(1, "rgba(235,244,252,0)"); w.fillStyle = g; w.fillRect(X - R, Y - R, 2 * R, 2 * R);
          for (let k = 0; k < 6; k++) { const ox = (r4() - 0.5) * 1.6 * R, oy = (r4() - 0.5) * 1.6 * R; w.strokeStyle = `rgba(255,255,255,${0.45 + 0.4 * r4()})`; w.lineWidth = Math.max(1, cs * (0.03 + 0.05 * r4()));
            w.beginPath(); w.ellipse(X + ox, Y + oy, cs * (0.15 + 0.35 * r4()), cs * (0.05 + 0.1 * r4()), ang + (r4() - 0.5) * 0.6, Math.PI * (0.1 + r4() * 0.3), Math.PI * (1.2 + r4() * 0.6)); w.stroke(); }
          w.fillStyle = "rgba(255,255,255,.7)"; for (let k = 0; k < 4; k++) { w.beginPath(); w.arc(X + (r4() - 0.5) * 1.6 * R, Y + (r4() - 0.5) * 1.6 * R, cs * (0.02 + 0.04 * r4()), 0, 7); w.fill(); } } }
      w.setLineDash([]); w.globalAlpha = 0.35; w.lineWidth = Math.max(1, cs * 0.05);   // ripples on painted water squares
      for (let y = 0; y < sk.rows; y++) for (let x = 0; x < sk.cols; x++) if (this.cell(sk, x, y) === "2") for (const k of [0.35, 0.7]) { w.beginPath(); const px = off + x * cs, py = off + y * cs; w.moveTo(px + cs * 0.15, py + cs * k); w.quadraticCurveTo(px + cs * 0.35, py + cs * (k - 0.1), px + cs * 0.55, py + cs * k); w.quadraticCurveTo(px + cs * 0.75, py + cs * (k + 0.1), px + cs * 0.9, py + cs * k); w.stroke(); }
      w.globalAlpha = 1;
      if (T.book && this.canBlur) { const sh = mmCanvas(W, H), s2 = sh.getContext("2d"); s2.fillStyle = "#16324f"; s2.fillRect(0, 0, W, H); s2.globalCompositeOperation = "destination-out"; s2.drawImage(Wm, 0, 0);
        w.save(); w.filter = `blur(${cs * 0.35}px)`; w.globalAlpha = 0.55; w.drawImage(sh, 0, 0); w.restore(); }
      w.globalCompositeOperation = "destination-in"; w.drawImage(Wm, 0, 0);
      l.drawImage(Wl, 0, 0);
    }
    // grid
    l.strokeStyle = T.grid; l.lineWidth = Math.max(0.6, cs / 40); l.beginPath();
    for (let x = 0; x <= sk.cols; x++) { l.moveTo(off + x * cs + 0.25, off); l.lineTo(off + x * cs + 0.25, off + sk.rows * cs); }
    for (let y = 0; y <= sk.rows; y++) { l.moveTo(off, off + y * cs + 0.25); l.lineTo(off + sk.cols * cs, off + y * cs + 0.25); }
    l.stroke();
    // soft shadow along the walls
    if (T.book && this.canBlur) { const sh = mmCanvas(W, H), s2 = sh.getContext("2d"); s2.fillStyle = "#000"; s2.fillRect(0, 0, W, H); s2.globalCompositeOperation = "destination-out"; s2.drawImage(M, 0, 0);
      l.save(); l.filter = `blur(${cs * 0.4}px)`; l.globalAlpha = 0.42; l.drawImage(sh, 0, 0); l.restore(); }
    // chasms / pits: a dark rim and a hole that gets darker towards the middle, with streaks falling in
    if ((sk.strokes || []).some(s => s.k === "pit")) {
      this.dilate(l, this.tint(Pm, "#16171a"), Math.max(1.5, cs * 0.07));
      const P = mmCanvas(W, H), p = P.getContext("2d"); p.fillStyle = T.book ? "#5c6068" : "#444"; p.fillRect(0, 0, W, H);
      for (const s of sk.strokes) { if (s.k !== "pit") continue;
        [[0.85, "#43464d"], [0.65, "#2c2e33"], [0.45, "#18191c"], [0.25, "#060607"]].forEach(([f, col]) => { p.save(); if (this.canBlur) p.filter = `blur(${cs * 0.35}px)`; p.fillStyle = col; this.stamp(p, { ...s, k: "water", r: (+s.r || 1) * f }, cs, off); p.restore(); });
        const r5 = mmRand((s.seed || 9) + 41), R = (+s.r || 1) * cs; p.strokeStyle = "rgba(10,10,12,.35)"; p.lineCap = "round";
        (s.pts || []).forEach((pt, i) => { if (i % 2) return; const X = off + pt[0] * cs, Y = off + pt[1] * cs;
          for (let k = 0; k < 5; k++) { const a = r5() * Math.PI * 2, d1 = R * (0.95 + 0.2 * r5()), d2 = R * (0.25 + 0.2 * r5()); p.lineWidth = Math.max(1, cs * (0.03 + 0.05 * r5()));
            p.beginPath(); p.moveTo(X + Math.cos(a) * d1, Y + Math.sin(a) * d1); p.lineTo(X + Math.cos(a) * d2, Y + Math.sin(a) * d2); p.stroke(); } }); }
      p.globalCompositeOperation = "destination-in"; p.drawImage(Pm, 0, 0);
      l.globalCompositeOperation = "source-over"; l.drawImage(P, 0, 0);
    }
    l.globalCompositeOperation = "destination-in"; l.drawImage(M, 0, 0);
    cx.drawImage(L, 0, 0);
    // icons and labels
    cx.translate(off, off);
    (sk.items || []).forEach(it => this.icon(cx, it.t, (it.x + .5) * cs, (it.y + .5) * cs, cs, it.r || 0, T));
    cx.textAlign = "center"; cx.textBaseline = "middle";
    (sk.labels || []).forEach(lb => { const big = /^\d{1,3}$/.test(lb.text); const F = mmFont(sk); cx.font = `${F.w} ${cs * (big ? .66 : .5)}px ${T.book ? F.css : "Georgia, serif"}`;
      cx.lineWidth = cs / 8; cx.strokeStyle = T.book ? "rgba(255,255,255,.85)" : T.floor; cx.strokeText(lb.text, (lb.x + .5) * cs, (lb.y + .55) * cs); cx.fillStyle = T.label; cx.fillText(lb.text, (lb.x + .5) * cs, (lb.y + .55) * cs); });
    if (opt.preview) { const p = opt.preview; cx.strokeStyle = "#e0a100"; cx.lineWidth = 3; cx.setLineDash([6, 4]); cx.strokeRect(p.x * cs, p.y * cs, p.w * cs, p.h * cs); cx.setLineDash([]); }
    if (opt.brush) { cx.strokeStyle = "rgba(224,161,0,.9)"; cx.lineWidth = 2; cx.beginPath(); cx.arc(opt.brush.x * cs, opt.brush.y * cs, opt.brush.r * cs, 0, 7); cx.stroke(); }
    cx.setTransform(1, 0, 0, 1, 0, 0);
    if (T.book) this.deco(cx, sk, cs, W, H, Mg, opt.title);
    cx.restore();
  },
  // torn paper border, title, compass rose, scale
  deco(cx, sk, cs, W, H, Mg, title) {
    const d = { border: true, title: true, compass: true, scale: true, pos: "tl", ...(sk.deco || {}) }, r = mmRand(W + H * 3);
    if (Mg && d.border) {
      const F = mmCanvas(W, H), f = F.getContext("2d");
      f.fillStyle = "#e9e8e4"; f.fillRect(0, 0, W, H);
      f.fillStyle = "rgba(90,96,108,.10)"; for (let i = 0; i < W * H / 220; i++) { const s = 1 + r() * 2.5; f.fillRect(r() * W, r() * H, s, s); }
      // cloudy inner edge into the dark rock
      f.globalCompositeOperation = "destination-out";
      const inset = Mg * cs * 0.72;
      f.save(); if (this.canBlur) f.filter = `blur(${cs * 0.28}px)`; f.fillStyle = "#000"; f.fillRect(inset, inset, W - 2 * inset, H - 2 * inset); f.restore();
      for (let i = 0; i < (W + H) / cs * 3; i++) { const side = Math.floor(r() * 4), t = r(), px = side < 2 ? t * W : side === 2 ? inset : W - inset, py = side < 2 ? (side === 0 ? inset : H - inset) : t * H, rad = cs * (0.25 + r() * 0.5);
        const g = f.createRadialGradient(px, py, 0, px, py, rad); g.addColorStop(0, "rgba(0,0,0,.35)"); g.addColorStop(1, "rgba(0,0,0,0)"); f.fillStyle = g; f.fillRect(px - rad, py - rad, rad * 2, rad * 2); }
      cx.drawImage(F, 0, 0);
      // torn outer edge
      cx.save(); cx.globalCompositeOperation = "destination-in"; cx.beginPath(); const e = Mg * cs * 0.12, step = Math.max(3, cs / 8), jag = () => (r() - 0.5) * cs * 0.1;
      for (let x = e; x <= W - e; x += step) x === e ? cx.moveTo(x, e + jag()) : cx.lineTo(x, e + jag());
      for (let y = e; y <= H - e; y += step) cx.lineTo(W - e + jag(), y);
      for (let x = W - e; x >= e; x -= step) cx.lineTo(x, H - e + jag());
      for (let y = H - e; y >= e; y -= step) cx.lineTo(e + jag(), y);
      cx.closePath(); cx.fill(); cx.restore();
    }
    const pad = Mg * cs + cs * 0.4, corners = { tl: [pad, pad], tr: [W - pad, pad], bl: [pad, H - pad], br: [W - pad, H - pad] };
    const tpos = corners[d.pos] ? d.pos : "tl", opp = { tl: "tr", tr: "tl", bl: "br", br: "bl" }[tpos];
    const txt = String(title || d.text || "").trim();
    if (d.title && txt) {   // white title with a soft shadow, in the chosen font
      const F = mmFont(sk), size = cs * (F.caps ? 1.15 : 1.35), [x0, y0] = corners[tpos], right = tpos.endsWith("r"), bottom = tpos.startsWith("b"), parts = [];
      if (F.caps) txt.toUpperCase().split(/\s+/).forEach((w, i, all) => { parts.push([w[0], size]); if (w.length > 1) parts.push([w.slice(1), size * 0.78]); if (i < all.length - 1) parts.push([" ", size * 0.6]); });
      else parts.push([txt, size]);
      cx.save(); const sx = F.sx; let tw = 0; parts.forEach(([s, z]) => { cx.font = `${F.w} ${z}px ${F.css}`; tw += cx.measureText(s).width; }); tw *= sx;
      let x = right ? x0 - tw : x0; const base = bottom ? y0 - cs * 0.2 : y0 + size * 0.85;
      cx.shadowColor = "rgba(0,0,0,.75)"; cx.shadowBlur = cs * 0.25; cx.shadowOffsetY = cs * 0.05; cx.fillStyle = "#fbfbfa"; cx.textBaseline = "alphabetic"; cx.textAlign = "left";
      parts.forEach(([s, z]) => { cx.font = `${F.w} ${z}px ${F.css}`; const wd = cx.measureText(s).width; cx.save(); cx.translate(x, base); cx.scale(sx, 1); cx.font = `${F.w} ${z}px ${F.css}`; cx.fillText(s, 0, 0); cx.restore(); x += wd * sx; });
      cx.restore();
    }
    if (d.compass) this.compass(cx, ...corners[opp].map((v, i) => v + (i === 0 ? (opp.endsWith("r") ? -1 : 1) : (opp.startsWith("b") ? -1 : 1)) * cs * 1.3), cs * 1.25);
    if (d.scale) { const [sx0, sy0] = corners[tpos.startsWith("t") ? (tpos === "tl" ? "br" : "bl") : (tpos === "bl" ? "br" : "bl")];
      const right = sx0 > W / 2; cx.save(); cx.font = `400 ${cs * 0.5}px Georgia, 'Times New Roman', serif`; cx.textAlign = right ? "right" : "left"; cx.textBaseline = "alphabetic";
      cx.shadowColor = "rgba(0,0,0,.7)"; cx.shadowBlur = cs * 0.15; cx.fillStyle = "#f4f4f2"; cx.fillText("1 square = 5 feet", sx0, sy0); cx.restore(); }
  },
  compass(cx, x, y, R) {
    cx.save(); cx.translate(x, y); cx.lineJoin = "round";
    cx.strokeStyle = "rgba(20,20,24,.9)"; cx.lineWidth = Math.max(1, R / 28);
    cx.beginPath(); cx.arc(0, 0, R * 0.42, 0, 7); cx.fillStyle = "rgba(255,255,255,.15)"; cx.fill(); cx.stroke();
    const pt = (ang, len, wid, light) => { const a = ang * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      for (const side of [-1, 1]) { cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(c * len, s * len); cx.lineTo(-s * wid * side, c * wid * side); cx.closePath(); cx.fillStyle = (side < 0) === light ? "#f5f5f3" : "#2a2d33"; cx.fill(); cx.stroke(); } };
    [45, 135, 225, 315].forEach(a => pt(a, R * 0.62, R * 0.12, true));
    [0, 90, 180, 270].forEach(a => pt(a - 90, R, R * 0.17, false));
    cx.beginPath(); cx.arc(0, 0, R * 0.08, 0, 7); cx.fillStyle = "#c9a227"; cx.fill(); cx.stroke();
    cx.restore();
  }
});
// fonts for titles (Cinzel from Google Fonts; plain serif when offline)
(function loadMapFont() { if (document.getElementById("mmfont")) return; const l = document.createElement("link"); l.id = "mmfont"; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Pirata+One&family=Grenze+Gotisch:wght@600;700&family=UnifrakturMaguntia&family=MedievalSharp&display=swap"; document.head.appendChild(l); })();
