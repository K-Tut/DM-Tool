"use strict";
/* ============ Battlemap tools shared by the Battlemaps and Combat tabs: token pictures, area templates, trash can ============ */
function tokMonster(t) { return t.mon ? S.scen?.monsters.find(m => m.id === t.mon) : null; }
function tokImg(t) { const sm = tokMonster(t); return sm ? (sm.custom?.image || monImgSrc(sm)) : (t.img || ""); }
// what the players' screens get: monster pictures as a small link the laptop serves (not the big picture itself)
function tokForTable(t) { const sm = tokMonster(t), ref = sm ? monImgRef(sm) : ""; return ref && !sm.custom?.image ? { ...t, ref } : t; }
function trashHtml() { return `<div class="maptrash" title="Drag a token or a template here to remove it">🗑</div>`; }
function toolMap(k) { return k === "bm" ? curMap() : cbMap(); }
function mapTools(k) {
  const m = toolMap(k); if (!m) return "";
  const o = S.ui.tplNew ||= { kind: "cone", size: 30 };
  return `<div class="row small maptools"><b>📐 Area</b><select data-act="tplKind">${Object.entries(TPL_KINDS).map(([v, l]) => `<option value="${v}" ${o.kind === v ? "selected" : ""}>${l}</option>`).join("")}</select>
    <input type="number" value="${o.size}" min="5" step="5" data-act="tplSize" style="width:60px"> ft<button class="small" data-act="tplAdd" data-k="${k}">＋ Place</button>
    ${(m.templates || []).map(t => `<span class="chip" style="border:2px solid ${t.color}">${t.size} ft ${TPL_KINDS[t.kind].split(" ")[0].toLowerCase()} <a href="#" data-act="tplDel" data-k="${k}" data-id="${t.id}" title="Remove">✕</a></span>`).join("")}
    <span class="muted">drag the shape to move it · drag the white dot to turn it · drop on 🗑 to remove</span></div>`;
}
function afterMapChange(m, redraw) { save(); redraw(); if (S.live && S.live.mapId === m.id) pushTable(); }
function mapExtras(getMap, redraw) {
  return {
    onTpl: (id, patch) => { const m = getMap(), t = m && (m.templates || []).find(x => x.id === id); if (!t) return; Object.assign(t, patch); afterMapChange(m, redraw); },
    onTrash: (kind, id) => {
      const m = getMap(); if (!m) return;
      if (kind === "tpl") m.templates = (m.templates || []).filter(t => t.id !== id);
      else { const t = m.tokens.find(x => x.id === id); m.tokens = m.tokens.filter(x => x.id !== id);
        if (t?.cf) { const f = cbState().list.find(x => x.id === t.cf); if (f) (f.noToken ||= []).push(m.id); } toast((t?.name || "Token") + " removed from the map"); }
      save(); render(); if (S.live && S.live.mapId === m.id) pushTable();
    }
  };
}
const TPL_COLORS = ["#e8590c", "#1971c2", "#2f9e44", "#9c36b5", "#c92a2a", "#f08c00"];
Object.assign(ACT, {
  tplAdd: el => {
    const m = toolMap(el.dataset.k); if (!m) return; const o = S.ui.tplNew, host = document.getElementById(el.dataset.k === "bm" ? "bmmap" : "cbmap");
    const z = el.dataset.k === "bm" ? S.ui.bmZ : S.ui.cbZ;
    const x = host ? (host.scrollLeft + host.clientWidth / 3) / z : m.w / 2, y = host ? (host.scrollTop + host.clientHeight / 2) / z : m.h / 2;
    (m.templates ||= []).push({ id: uid(), kind: o.kind, size: Math.max(5, +o.size || 30), x, y, ang: 0, color: TPL_COLORS[m.templates.length % TPL_COLORS.length] });
    save(); render(); if (S.live && S.live.mapId === m.id) pushTable();
  },
  tplDel: el => { const m = toolMap(el.dataset.k); m.templates = (m.templates || []).filter(t => t.id !== el.dataset.id); save(); render(); if (S.live && S.live.mapId === m.id) pushTable(); }
});
Object.assign(CHG, {
  tplKind: el => { (S.ui.tplNew ||= { kind: "cone", size: 30 }).kind = el.value; },
  tplSize: el => { (S.ui.tplNew ||= { kind: "cone", size: 30 }).size = +el.value || 30; }
});
