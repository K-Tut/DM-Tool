"use strict";
/* Battlemap view: image + grid overlay + draggable tokens (snap to grid) + area templates (cone, line, cube, sphere).
   Used by the DM screen (battlemaps, combat) and the player table. */
const TPL_KINDS = { cone: "Cone", line: "Line", cube: "Cube / square", sphere: "Sphere / circle" };
const MapView = {
  cell(map) { const g = map.grid || {}; const cols = Math.max(1, +g.cols || 20), rows = Math.max(1, +g.rows || 20); return { cw: map.w / cols, ch: map.h / rows, ox: +g.ox || 0, oy: +g.oy || 0, cols, rows }; },
  initials(name) { const w = String(name || "?").trim().split(/\s+/); const num = (name || "").match(/\d+$/); return (w.length > 1 ? w[0][0] + (num ? num[0] : w[1][0]) : w[0].slice(0, 2)).toUpperCase(); },
  // one template as an SVG group; coordinates in map pixels, 1 square = 5 ft
  tplSvg(t, map, z, edit) {
    const { cw } = this.cell(map), u = cw / 5 * z, L = (+t.size || 30) * u, col = t.color || "#e8590c", ang = +t.ang || 0;
    let shape = "", hx = L, hy = 0, lx = L / 2, ly = 0;
    if (t.kind === "sphere") { shape = `<circle r="${L}" />`; hx = null; lx = 0; ly = 0; }
    else if (t.kind === "cube") { shape = `<rect x="${-L / 2}" y="${-L / 2}" width="${L}" height="${L}" />`; hx = L / 2; lx = 0; }
    else if (t.kind === "line") { const w = (+t.w || 5) * u; shape = `<rect x="0" y="${-w / 2}" width="${L}" height="${w}" />`; }
    else shape = `<polygon points="0,0 ${L},${-L / 2} ${L},${L / 2}" />`;
    const label = `${t.size} ft ${(TPL_KINDS[t.kind] || "").split(" ")[0].toLowerCase()}`;
    return `<g class="tpl ${edit ? "edit" : ""}" data-tplg="${t.id}" transform="translate(${t.x * z},${t.y * z}) rotate(${ang})" style="--tc:${col}">
      <g data-tpl="${t.id}" fill="${col}" fill-opacity=".22" stroke="${col}" stroke-width="2.5">${shape}</g>
      <circle class="tpl-o" r="5" fill="${col}" data-tpl="${t.id}" />
      ${edit && hx !== null ? `<circle class="tpl-rot" cx="${hx}" cy="${hy}" r="9" data-tplrot="${t.id}" fill="#fff" stroke="${col}" stroke-width="3"><title>Drag to turn</title></circle>` : ""}
      <text x="${lx}" y="${ly}" transform="rotate(${-ang} ${lx} ${ly})" text-anchor="middle" dominant-baseline="middle" class="tpl-l">${label}</text></g>`;
  },
  html(map, z, opts = {}) {
    if (!map || !map.image) return `<div class="mv-empty">No map image</div>`;
    const { cw, ch, ox, oy } = this.cell(map), g = map.grid || {};
    const show = g.show !== false, col = g.color || "#000000", op = g.opacity ?? 0.35;
    const rgba = (() => { const h = col.replace("#", ""); return `rgba(${parseInt(h.substr(0, 2), 16)},${parseInt(h.substr(2, 2), 16)},${parseInt(h.substr(4, 2), 16)},${op})`; })();
    const grid = show ? `<div class="mv-grid" style="background-image:linear-gradient(to right, ${rgba} 1px, transparent 1px),linear-gradient(to bottom, ${rgba} 1px, transparent 1px);background-size:${cw * z}px ${ch * z}px;background-position:${ox * z}px ${oy * z}px"></div>` : "";
    const toks = (map.tokens || []).filter(t => opts.dm || !t.hidden).map(t => {
      const s = Math.max(1, +t.size || 1), w = cw * z * s, h = ch * z * s;
      const hpPct = t.maxHp ? Math.max(0, Math.min(100, 100 * (t.hp ?? t.maxHp) / t.maxHp)) : null;
      const img = opts.img ? opts.img(t) : "";
      return `<div class="tok ${t.kind || "player"} ${t.hidden ? "hid" : ""} ${opts.sel === t.id ? "sel" : ""} ${img ? "hasimg" : ""} ${t.hp === 0 ? "down" : ""}" data-tok="${t.id}" style="left:${(ox + (+t.x || 0) * cw) * z}px;top:${(oy + (+t.y || 0) * ch) * z}px;width:${w}px;height:${h}px;--c:${t.color || "#8e1f1f"};font-size:${Math.max(9, Math.min(w, h) * 0.34)}px">
        ${img ? `<img class="tok-img" src="${esc(img)}" alt="" draggable="false" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}<span class="tok-in">${esc(this.initials(t.name))}</span>${hpPct !== null && opts.dm ? `<i class="tok-hp" style="width:${hpPct}%"></i>` : ""}<small>${esc(t.name || "")}</small></div>`;
    }).join("");
    const tpls = (map.templates || []).length ? `<svg class="mv-tpl" width="${map.w * z}" height="${map.h * z}">${map.templates.map(t => this.tplSvg(t, map, z, opts.tplEdit)).join("")}</svg>` : "";
    return `<div class="mv-layer" style="width:${map.w * z}px;height:${map.h * z}px"><img src="${map.image}" draggable="false" alt="">${grid}${tpls}${toks}</div>`;
  },
  overTrash(e) { return document.elementsFromPoint(e.clientX, e.clientY).some(el => el.classList && el.classList.contains("maptrash")); },
  // drag support: host = scroll container; get() returns {map, z}; onMove(id, x, y); onSelect(id); x = {onTpl(id, patch), onTrash(kind, id)}
  bind(host, get, onMove, onSelect, x = {}) {
    let drag = null;
    const trash = on => document.querySelectorAll(".maptrash").forEach(t => t.classList.toggle("hot", !!on));
    host.addEventListener("pointerdown", e => {
      const layer = host.querySelector(".mv-layer"); if (!layer) return;
      const rot = e.target.closest("[data-tplrot]"), tp = !rot && e.target.closest("[data-tpl]");
      if ((rot || tp) && x.onTpl) {
        const id = (rot || tp).dataset.tplrot || (rot || tp).dataset.tpl, { map, z } = get(), t = (map.templates || []).find(k => k.id === id); if (!t) return;
        e.preventDefault(); try { (rot || tp).setPointerCapture(e.pointerId); } catch (err) { }
        drag = { tpl: t, rot: !!rot, z, sx: e.clientX, sy: e.clientY, x0: t.x, y0: t.y, g: host.querySelector(`[data-tplg="${id}"]`), moved: false };
        return;
      }
      const tok = e.target.closest(".tok"); if (!tok) return;
      e.preventDefault(); tok.setPointerCapture(e.pointerId);
      const r = tok.getBoundingClientRect();
      drag = { tok, id: tok.dataset.tok, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false, sx: e.clientX, sy: e.clientY };
      tok.classList.add("dragging");
    });
    host.addEventListener("pointermove", e => {
      if (!drag) return;
      if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 4) drag.moved = true;
      if (drag.tpl) {
        const t = drag.tpl, z = drag.z;
        if (drag.rot) { const lr = host.querySelector(".mv-layer").getBoundingClientRect(); let a = Math.atan2(e.clientY - lr.top - t.y * z, e.clientX - lr.left - t.x * z) * 180 / Math.PI; a = Math.round(a / 15) * 15; drag.ang = a; drag.g.setAttribute("transform", `translate(${t.x * z},${t.y * z}) rotate(${a})`); }
        else { drag.nx = drag.x0 + (e.clientX - drag.sx) / z; drag.ny = drag.y0 + (e.clientY - drag.sy) / z; drag.g.setAttribute("transform", `translate(${drag.nx * z},${drag.ny * z}) rotate(${+t.ang || 0})`); trash(this.overTrash(e)); }
        return;
      }
      const lr = host.querySelector(".mv-layer").getBoundingClientRect();
      drag.tok.style.left = (e.clientX - lr.left - drag.dx) + "px"; drag.tok.style.top = (e.clientY - lr.top - drag.dy) + "px";
      trash(x.onTrash && this.overTrash(e));
    });
    const end = e => {
      if (!drag) return; const d = drag; drag = null; trash(false);
      if (d.tpl) {
        if (!d.moved) return;
        if (!d.rot && x.onTrash && this.overTrash(e)) return x.onTrash("tpl", d.tpl.id);
        const { map } = get(), { cw, ox, oy } = this.cell(map), snap = v => Math.round(v / (cw / 2)) * (cw / 2);
        return x.onTpl(d.tpl.id, d.rot ? { ang: d.ang ?? d.tpl.ang } : { x: snap(d.nx - ox) + ox, y: snap(d.ny - oy) + oy });
      }
      d.tok.classList.remove("dragging");
      if (!d.moved) { onSelect && onSelect(d.id); return; }
      if (x.onTrash && this.overTrash(e)) return x.onTrash("tok", d.id);
      const { map, z } = get(); const { cw, ch, ox, oy, cols, rows } = this.cell(map);
      const lr = host.querySelector(".mv-layer").getBoundingClientRect();
      const t = (map.tokens || []).find(k => k.id === d.id); const s = Math.max(1, +(t && t.size) || 1);
      const px = (e.clientX - lr.left - d.dx) / z + cw / 2, py = (e.clientY - lr.top - d.dy) / z + ch / 2;
      const nx = Math.max(0, Math.min(cols - s, Math.floor((px - ox) / cw))), ny = Math.max(0, Math.min(rows - s, Math.floor((py - oy) / ch)));
      onMove(d.id, nx, ny);
    };
    host.addEventListener("pointerup", end); host.addEventListener("pointercancel", end);
  },
  fitZoom(host, map) { return map && map.w ? Math.min(4, Math.max(0.05, (host.clientWidth - 4) / map.w)) : 1; }
};
