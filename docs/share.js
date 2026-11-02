"use strict";
/* ============ Giving loot and items to the players on the local Wi-Fi (laptop only) ============
   The players open the table page (QR code), say who they are, and get a 🎁 window: they claim items, split coins,
   everybody presses OK, then each adds their part to their Character Builder. */
function htmlToText(html) {
  const d = document.createElement("div"); d.innerHTML = String(html || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|h\d|li|tr)>/gi, "\n");
  d.querySelectorAll("h1, .type").forEach(x => x.remove());
  return d.textContent.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
}
// one loot entry as the players see it (a curse stays hidden until somebody identifies the item)
function offerItem(e) {
  const it = e.ref ? S.items.byKey[e.ref] : null;
  let desc = it ? htmlToText(S.items.blocks[e.ref] || "") : e.kind === "trinket" ? "A trinket." : e.kind === "gem" ? `A gemstone worth ${e.value} gp.` : e.kind === "art" ? `An art object worth ${e.value} gp.` : "";
  let curse = "", cursed = false;
  if (it?.my) { desc = it.my.desc || ""; desc = [myItemRules(it.my).join("\n"), desc].filter(Boolean).join("\n\n"); cursed = !!it.my.cursed; curse = it.my.curse || ""; }
  else { const m = desc.match(/\n?\s*Curse\.\s*([\s\S]*?)(?=\n\n|$)/); if (m) { cursed = true; curse = m[1].trim(); desc = desc.replace(m[0], "").trim(); } }
  return { id: e.id, name: e.name, qty: +e.qty || 1, kind: e.kind || (it ? "magic" : "item"), rarity: e.rarity || it?.rarity || "", attune: !!it?.attune, value: +e.value || 0,
    desc, cursed, curse, img: it?.my?.img || "", weapon: it?.my?.cat === "Weapon" ? { base: it.my.base, magic: +it.my.bonus || 0, extra: myItemExtra(it.my) } : null };
}
async function postOffer(o) { await api("api/offer/new", { method: "POST", body: { offer: o } }); toast("Sent to the players — they see it under 🎁"); }
function onlinePlayers() { return (S.players || []).filter(p => p.online); }
function playerChip(p) { return `<span class="pchip"><span class="av" style="background:${esc(p.color)}">${p.img ? `<img src="${esc(p.img)}">` : esc((p.name || "?")[0])}</span>${esc(p.name)}</span>`; }
// status of everything handed out (Loot tab)
function vOffers() {
  if (!S.server) return "";
  const os = S.offers || [], pls = S.players || [], who = pid => pls.find(p => p.pid === pid) || { name: "?", color: "#888" };
  return `<div class="card"><div class="row"><h3 style="margin:0">🎁 Players</h3><span class="small muted">${onlinePlayers().length ? onlinePlayers().map(playerChip).join(" ") : "nobody connected — players scan the QR code and enter their name"}</span><button class="small ghost right" data-act="showQR">📱 QR code</button></div>
    ${os.map(o => `<div class="offer"><div class="row small"><b>${o.kind === "player" ? "Item for " + esc(who(o.to).name) : "Party loot"}: ${esc(o.title)}</b>${o.done ? '<span class="chip" style="background:#2f9e44;color:#fff">✔ shared out</span>' : '<span class="chip">players are deciding…</span>'}<a href="#" class="right" data-act="offerClose" data-id="${o.id}">remove</a></div>
      ${(o.items || []).map(it => `<div class="small">• ${esc(it.name)} → ${o.claims[it.id] ? playerChip(who(o.claims[it.id])) : '<span class="muted">nobody yet</span>'}${it.identified ? ` <span class="chip">🔍 identified by ${esc(who(it.identifiedBy).name)}</span>` : ""}</div>`).join("")}
      ${o.shares ? `<div class="small">Coins split: ${Object.entries(o.shares).map(([p, c]) => esc(who(p).name) + " " + Object.entries(c).filter(([, v]) => v).map(([k, v]) => v + " " + k).join(" ")).join(" · ")}</div>` : ""}
      ${o.kind !== "player" ? `<div class="small">OK: ${(o.members || []).map(p => `${esc(who(p).name)} ${o.oks[p] ? "✔" : "…"}`).join(" · ")}</div>` : ""}</div>`).join("") || '<p class="small muted" style="margin:6px 0 0">Use 🎁 on a loot list (whole party) or on a single item (one player).</p>'}</div>`;
}
MODALS.give = () => {
  const L = findLoot(S.modal.l), e = L?.items.find(x => x.id === S.modal.e); if (!e) return "";
  const pls = onlinePlayers();
  return `<h2>🎁 Give “${esc(e.name)}” to…</h2>${pls.length ? `<div class="row">${pls.map(p => `<button class="ghost" data-act="giveTo" data-p="${p.pid}">${playerChip(p)}</button>`).join("")}</div>`
    : '<p class="muted">Nobody is connected. Players open the table page (📱 QR code) and enter their name.</p>'}
    <div class="foot"><button class="ghost" data-act="showQR">📱 QR code</button><button data-act="closeModal">Cancel</button></div>`;
};
Object.assign(ACT, {
  lootGive: async (el, e) => { e.stopPropagation(); const L = findLoot(el.dataset.id); if (!L) return;
    if (!onlinePlayers().length && !confirm("No player is connected right now. Send it anyway (players who join later can still take part)?")) return;
    await postOffer({ id: uid(), kind: "party", title: L.name, items: (L.items || []).map(offerItem), coins: { ...L.coins } }); },
  itemGive: (el, e) => { e.stopPropagation(); S.modal = { type: "give", l: el.dataset.l, e: el.dataset.e }; renderModal(); },
  giveTo: async el => { const L = findLoot(S.modal.l), e = L.items.find(x => x.id === S.modal.e); S.modal = null; renderModal();
    await postOffer({ id: uid(), kind: "player", to: el.dataset.p, title: e.name, items: [offerItem(e)], coins: {} }); },
  offerClose: async el => { await api("api/offer/act", { method: "POST", body: { oid: el.dataset.id, act: "close" } }); }
});
