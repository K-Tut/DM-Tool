"use strict";
/* Battlemap view: image + grid overlay + draggable tokens (snap to grid). Used by the DM screen and the player table. */
const MapView = {
  cell(map) { const g = map.grid || {}; const cols = Math.max(1, +g.cols || 20), rows = Math.max(1, +g.rows || 20); return { cw: map.w / cols, ch: map.h / rows, ox: +g.ox || 0, oy: +g.oy || 0, cols, rows }; },
  initials(name) { const w = String(name || "?").trim().split(/\s+/); const num = (name || "").match(/\d+$/); return (w.length > 1 ? w[0][0] + (num ? num[0] : w[1][0]) : w[0].slice(0, 2)).toUpperCase(); },
  html(map, z, opts = {}) {
    if (!map || !map.image) return `<div class="mv-empty">No map image</div>`;
    const { cw, ch, ox, oy } = this.cell(map), g = map.grid || {};
    const show = g.show !== false, col = g.color || "#000000", op = g.opacity ?? 0.35;
    const rgba = (() => { const h = col.replace("#", ""); return `rgba(${parseInt(h.substr(0, 2), 16)},${parseInt(h.substr(2, 2), 16)},${parseInt(h.substr(4, 2), 16)},${op})`; })();
    const grid = show ? `<div class="mv-grid" style="background-image:linear-gradient(to right, ${rgba} 1px, transparent 1px),linear-gradient(to bottom, ${rgba} 1px, transparent 1px);background-size:${cw * z}px ${ch * z}px;background-position:${ox * z}px ${oy * z}px"></div>` : "";
    const toks = (map.tokens || []).filter(t => opts.dm || !t.hidden).map(t => {
      const s = Math.max(1, +t.size || 1), w = cw * z * s, h = ch * z * s;
      const hpPct = t.maxHp ? Math.max(0, Math.min(100, 100 * (t.hp ?? t.maxHp) / t.maxHp)) : null;
      return `<div class="tok ${t.kind || "player"} ${t.hidden ? "hid" : ""} ${opts.sel === t.id ? "sel" : ""}" data-tok="${t.id}" style="left:${(ox + (+t.x || 0) * cw) * z}px;top:${(oy + (+t.y || 0) * ch) * z}px;width:${w}px;height:${h}px;--c:${t.color || "#8e1f1f"};font-size:${Math.max(9, Math.min(w, h) * 0.34)}px">
        <span class="tok-in">${esc(this.initials(t.name))}</span>${hpPct !== null && opts.dm ? `<i class="tok-hp" style="width:${hpPct}%"></i>` : ""}<small>${esc(t.name || "")}</small></div>`;
    }).join("");
    return `<div class="mv-layer" style="width:${map.w * z}px;height:${map.h * z}px"><img src="${map.image}" draggable="false" alt="">${grid}${toks}</div>`;
  },
  // drag support: host = scroll container; get() returns {map, z}; onMove(id, x, y); onSelect(id)
  bind(host, get, onMove, onSelect) {
    let drag = null;
    host.addEventListener("pointerdown", e => {
      const tok = e.target.closest(".tok"); if (!tok) return;
      const layer = host.querySelector(".mv-layer"); if (!layer) return;
      e.preventDefault(); tok.setPointerCapture(e.pointerId);
      const r = tok.getBoundingClientRect();
      drag = { tok, id: tok.dataset.tok, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false, sx: e.clientX, sy: e.clientY };
      tok.classList.add("dragging");
    });
    host.addEventListener("pointermove", e => {
      if (!drag) return;
      if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 4) drag.moved = true;
      const lr = host.querySelector(".mv-layer").getBoundingClientRect();
      drag.tok.style.left = (e.clientX - lr.left - drag.dx) + "px"; drag.tok.style.top = (e.clientY - lr.top - drag.dy) + "px";
    });
    const end = e => {
      if (!drag) return; const d = drag; drag = null; d.tok.classList.remove("dragging");
      if (!d.moved) { onSelect && onSelect(d.id); return; }
      const { map, z } = get(); const { cw, ch, ox, oy, cols, rows } = this.cell(map);
      const lr = host.querySelector(".mv-layer").getBoundingClientRect();
      const t = (map.tokens || []).find(x => x.id === d.id); const s = Math.max(1, +(t && t.size) || 1);
      const px = (e.clientX - lr.left - d.dx) / z + cw / 2, py = (e.clientY - lr.top - d.dy) / z + ch / 2;
      const x = Math.max(0, Math.min(cols - s, Math.floor((px - ox) / cw))), y = Math.max(0, Math.min(rows - s, Math.floor((py - oy) / ch)));
      onMove(d.id, x, y);
    };
    host.addEventListener("pointerup", end); host.addEventListener("pointercancel", end);
  },
  fitZoom(host, map) { return map && map.w ? Math.min(4, Math.max(0.05, (host.clientWidth - 4) / map.w)) : 1; }
};
