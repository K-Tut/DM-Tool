"use strict";
/* Player view of the shared battlemap: live updates by long-polling the DM laptop; everyone can move tokens. */
const T = { map: null, rev: -1, imageRev: "", z: null, fitMode: true, dragging: false };
const board = document.getElementById("board"), status = document.getElementById("status");

function draw() {
  if (!T.map || !T.map.active) { board.innerHTML = `<div id="wait">${T.map && !T.map.active ? "The DM stopped sharing the map." : "Waiting for the DM to share a map…"}</div>`; return; }
  if (T.fitMode || T.z == null) T.z = MapView.fitZoom(board, T.map);
  const sl = board.scrollLeft, st = board.scrollTop;
  board.innerHTML = MapView.html(T.map, T.z, { dm: false });
  board.scrollLeft = sl; board.scrollTop = st;
  document.getElementById("tname").textContent = T.map.name || "Battlemap";
}

async function poll() {
  for (;;) {
    try {
      const r = await fetch(`/api/table?rev=${T.rev}&img=${T.imageRev}`, { cache: "no-store" });
      const s = await r.json();
      const image = s.image !== undefined ? s.image : (T.map ? T.map.image : "");
      if (s.image !== undefined) T.imageRev = s.imageRev;
      T.rev = s.rev;
      const changedMap = !T.map || T.map.mapId !== s.mapId;
      T.map = { ...s, image };
      if (changedMap) T.fitMode = true;
      status.textContent = s.active ? "● live" : "○ not shared"; status.style.color = s.active ? "#7d7" : "#ccc";
      if (!T.dragging) draw();
    } catch (e) {
      status.textContent = "reconnecting…"; status.style.color = "#fb6";
      await new Promise(res => setTimeout(res, 1500));
    }
  }
}

MapView.bind(board, () => ({ map: T.map, z: T.z }), async (id, x, y) => {
  const t = T.map.tokens.find(k => k.id === id); if (t) { t.x = x; t.y = y; } draw();
  try { await fetch("/api/table/move", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, x, y }) }); } catch (e) { }
}, null);
board.addEventListener("pointerdown", e => { if (e.target.closest(".tok")) T.dragging = true; });
window.addEventListener("pointerup", () => { setTimeout(() => { T.dragging = false; }, 50); });
document.getElementById("zin").onclick = () => { T.fitMode = false; T.z = (T.z || 1) * 1.25; draw(); };
document.getElementById("zout").onclick = () => { T.fitMode = false; T.z = (T.z || 1) / 1.25; draw(); };
document.getElementById("zfit").onclick = () => { T.fitMode = true; draw(); };
window.addEventListener("resize", () => { if (T.fitMode) draw(); });
poll();
