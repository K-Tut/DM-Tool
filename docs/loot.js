"use strict";
/* ============ LOOT: magic item & trinket library, loot lists per scenario, random loot generator ============ */

// ----- built-in tables (used when nothing better was imported) -----
const BUILTIN_TRINKETS = [
  "A brass key that is warm to the touch", "A glass eye that always looks north", "A tiny wooden boat that never gets wet", "A locket holding a lock of silver hair",
  "A tin whistle that makes no sound", "A pressed blue flower that never wilts", "A die with a single pip on every face", "A spoon bent into a perfect spiral",
  "A small iron bell with no clapper", "A candle stub that smells of the sea", "A map of a town that does not exist", "A thimble engraved with a laughing face",
  "A bird skull wrapped in red thread", "A copper ring too small for any finger", "A vial of black sand that sparkles at night", "A wooden mask of a sleeping child",
  "A playing card with a blank face", "A pebble with a hole worn through it", "A tooth carved into a tiny lighthouse", "A button from a nobleman's coat",
  "A scrap of sail with a star stitched on it", "A clay figurine of a three-legged horse", "A quill that writes in faint green ink", "A coin from a kingdom no one remembers",
  "A jar lid painted with a door", "A lead soldier missing its head", "A crystal that hums when held near water", "A leather pouch that smells of cinnamon",
  "A tiny cage holding a dried beetle", "A wax seal showing an unknown crest", "A comb carved from whalebone", "A letter addressed to you, unopened",
  "A silver needle that floats in water", "A snail shell that is always cool", "A child's drawing of a dragon", "A spyglass lens with a crack shaped like a river",
  "A string of knots that might be a message", "A bronze acorn with a seam around its middle", "A feather that is heavier than it looks", "A key-shaped cookie, rock hard",
  "A tiny book with pages of pure gold leaf, all blank", "A knucklebone painted with runes", "A shard of a mirror that reflects the sky", "A wooden whistle shaped like an owl",
  "A cloth doll with button eyes of different colours", "A ring of braided horsehair", "A small hourglass filled with red sand", "A chess piece carved from obsidian",
  "A smooth stone that feels like it has a heartbeat", "A rusty nail from a famous ship", "A miniature portrait of a stern old woman", "A seashell that whispers your name",
  "A tiny brass compass that points to the nearest tavern", "A ribbon that never gets tangled", "A walnut shell holding a folded note", "A clay pipe with teeth marks",
  "A silver fishhook shaped like a question mark", "A dried rose that smells of smoke", "A scrap of parchment with a recipe for 'dragon stew'", "A tiny glass orb with a snowflake inside",
  "A bone dice cup with one die missing", "A copper bracelet that turns skin green", "A carved wooden fox with a missing tail", "A stoppered vial of rainwater",
  "A pewter badge from a long-gone guard company", "A stone with a fossilised fern", "A pair of mismatched earrings", "A cork carved into a tiny castle",
  "A candle that burns with a faint purple flame", "A slender bone flute with three holes", "A small tin of very old tea", "A spinning top that never falls over until you look away",
  "A painted egg that is completely solid", "A hand mirror with a crack across the middle", "A tiny iron anchor on a chain", "A scrap of dragon scale the size of a coin",
  "A ticket to a play that ended a hundred years ago", "A fingerbone ring", "A pinecone made of silver", "A ball of wax with a fly trapped inside",
  "A wooden spoon with your initials carved in it", "A lock with no keyhole", "A collar for a very small dog, with a bell", "A star chart with one star circled",
  "A glass bead that changes colour with the weather", "A knot of hair tied with gold thread", "A chipped teacup with a painted moon", "A rope belt with seven knots",
  "A stone arrowhead that is always pointing the wrong way", "A miniature shield the size of a thumbnail", "A tiny jar of honey that never runs out of smell", "A brass button that says 'TRUTH'",
  "A wooden sword carved for a child", "A coil of copper wire twisted into a face", "A sachet of dried lavender and bones", "A small portrait of you, painted years ago",
  "A sealed bottle containing a single shout", "A fragment of stained glass showing an eye", "A clockwork beetle that no longer winds", "A soft grey stone shaped like a heart"
];
const GEMS = {
  10: ["Azurite", "Banded agate", "Blue quartz", "Eye agate", "Hematite", "Lapis lazuli", "Malachite", "Moss agate", "Obsidian", "Rhodochrosite", "Tiger eye", "Turquoise"],
  50: ["Bloodstone", "Carnelian", "Chalcedony", "Chrysoprase", "Citrine", "Jasper", "Moonstone", "Onyx", "Quartz", "Sardonyx", "Star rose quartz", "Zircon"],
  100: ["Amber", "Amethyst", "Chrysoberyl", "Coral", "Garnet", "Jade", "Jet", "Pearl", "Spinel", "Tourmaline"],
  500: ["Alexandrite", "Aquamarine", "Black pearl", "Blue spinel", "Peridot", "Topaz"],
  1000: ["Black opal", "Blue sapphire", "Emerald", "Fire opal", "Opal", "Star ruby", "Star sapphire", "Yellow sapphire"],
  5000: ["Black sapphire", "Diamond", "Jacinth", "Ruby"]
};
const ART = {
  25: ["Silver ewer", "Carved bone statuette", "Small gold bracelet", "Cloth-of-gold vestments", "Black velvet mask with silver thread", "Copper chalice with silver filigree", "Pair of engraved bone dice", "Small mirror in a painted wooden frame", "Embroidered silk handkerchief", "Gold locket with a painted portrait"],
  250: ["Gold ring set with bloodstones", "Carved ivory statuette", "Large gold bracelet", "Silver necklace with a gemstone pendant", "Bronze crown", "Silk robe with gold embroidery", "Fine tapestry", "Brass mug with jade inlay", "Box of turquoise animal figurines", "Gold birdcage with electrum filigree"],
  750: ["Silver chalice set with moonstones", "Silver-plated longsword with jet in the hilt", "Carved harp of exotic wood with ivory inlay", "Small gold idol", "Gold dragon comb set with red garnets", "Bottle stopper cork embossed with gold leaf and amethysts", "Ceremonial electrum dagger with a black pearl in the pommel", "Silver and gold brooch", "Obsidian statuette with gold fittings", "Painted gold war mask"],
  2500: ["Fine gold chain set with a fire opal", "Old masterpiece painting", "Embroidered silk and velvet mantle set with moonstones", "Platinum bracelet set with a sapphire", "Embroidered glove set with jewel chips", "Jeweled anklet", "Gold music box", "Gold circlet set with four aquamarines", "Eye patch with a mock eye of sapphire and moonstone", "Necklace string of small pink pearls"],
  7500: ["Jeweled gold crown", "Jeweled platinum ring", "Small gold statuette set with rubies", "Gold cup set with emeralds", "Gold jewelry box with platinum filigree", "Painted gold child's sarcophagus", "Jade game board with solid gold playing pieces", "Bejeweled ivory drinking horn with gold filigree"]
};
const RARITIES = ["common", "uncommon", "rare", "very rare", "legendary", "artifact"];
const RAR_COL = { common: "#6b6b6b", uncommon: "#2f7d4a", rare: "#1f4e8e", "very rare": "#6b2f8e", legendary: "#b8641a", artifact: "#8e1f1f", varies: "#555" };
const COINS = ["cp", "sp", "ep", "gp", "pp"], COIN_GP = { cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 };
// Generator settings in the spirit of the DMG treasure tables (adjust the result freely).
const LOOT_TIERS = [["0", "CR 0–4"], ["5", "CR 5–10"], ["11", "CR 11–16"], ["17", "CR 17+"]];
const GEN = {
  individual: {
    "0": { coins: [["gp", "3d6"]], items: "0", trinket: 1 / 6 },
    "5": { coins: [["gp", "2d8*10"]], items: "0", trinket: 1 / 8 },
    "11": { coins: [["pp", "2d10*10"]], items: "0", trinket: 1 / 10 },
    "17": { coins: [["pp", "2d8*100"]], items: "0", trinket: 1 / 12 }
  },
  hoard: {
    "0": { coins: [["cp", "2d6*100"], ["sp", "2d6*10"], ["gp", "2d4*100"]], vals: ["1d4", [["gem", 10], ["gem", 50], ["art", 25]]], items: "1d4-1", rar: { common: 45, uncommon: 50, rare: 5 }, trinkets: "1d2" },
    "5": { coins: [["sp", "2d6*100"], ["gp", "8d10*100"], ["pp", "1d6*10"]], vals: ["2d4", [["gem", 50], ["gem", 100], ["art", 250]]], items: "1d3", rar: { common: 10, uncommon: 50, rare: 35, "very rare": 5 }, trinkets: "1d2-1" },
    "11": { coins: [["gp", "4d6*1000"], ["pp", "5d6*10"]], vals: ["2d4", [["gem", 500], ["art", 750], ["gem", 1000]]], items: "1d4", rar: { uncommon: 15, rare: 40, "very rare": 35, legendary: 10 }, trinkets: "1d2-1" },
    "17": { coins: [["gp", "12d6*1000"], ["pp", "8d6*100"]], vals: ["1d8", [["gem", 1000], ["art", 2500], ["gem", 5000], ["art", 7500]]], items: "1d6", rar: { rare: 20, "very rare": 45, legendary: 35 }, trinkets: "1d2-1" }
  }
};
function rollExpr(x) {   // "2d6*100", "1d4-1", "3d6"
  const m = String(x).match(/^(\d+)d(\d+)(?:([+-])(\d+))?(?:\*(\d+))?$/); if (!m) return +x || 0;
  let t = 0; for (let i = 0; i < +m[1]; i++) t += rollDie(+m[2]);
  if (m[3]) t += (m[3] === "-" ? -1 : 1) * +m[4];
  return Math.max(0, t * (+m[5] || 1));
}
const pick = a => a[rollDie(a.length) - 1];
function pickWeighted(w) { const tot = Object.values(w).reduce((a, b) => a + b, 0); let r = rollDie(tot); for (const [k, v] of Object.entries(w)) { r -= v; if (r <= 0) return k; } return Object.keys(w)[0]; }

// ----- library access -----
function trinkets() { return (S.items.trinkets || []).length >= 20 ? S.items.trinkets : BUILTIN_TRINKETS; }
function itemKey(it) { return it.slug + "|" + it.ed; }
function libItems() {   // prefer one edition when both are imported (the newer one)
  const all = S.items.list || [], ed = S.ui.libEd || (all.some(x => x.ed === "2024") ? "2024" : "all");
  return all.filter(x => ed === "all" || x.ed === ed || x.ed === "custom");
}
function randomMagicItem(rarity, opts = {}) {
  let pool = libItems().filter(x => x.rarity === rarity && (!opts.noAttune || !x.attune));
  const fresh = pool.filter(x => !(opts.taken || new Set()).has(itemKey(x))); if (fresh.length) pool = fresh;   // no doubles in one hoard if possible
  if (!pool.length) return { kind: "magic", name: `Random ${rarity} magic item`, rarity, custom: true };
  const it = pick(pool); return { kind: "magic", ref: itemKey(it), name: it.name, rarity: it.rarity };
}
function randomValuable(type, value) {
  return type === "gem" ? { kind: "gem", name: pick(GEMS[value]), value } : { kind: "art", name: pick(ART[value]), value };
}
function lootEntry(o) { return { id: uid(), qty: 1, ...o }; }
function generateLoot(L, o) {   // o = {type, tier, magic, valuables, trinkets, noAttune}
  const g = GEN[o.type][o.tier], out = [];
  const coins = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
  g.coins.forEach(([c, x]) => coins[c] += rollExpr(x));
  if (o.type === "hoard") {
    if (o.valuables) { const n = rollExpr(g.vals[0]); for (let i = 0; i < n; i++) { const [t, v] = pick(g.vals[1]); out.push(lootEntry(randomValuable(t, v))); } }
    if (o.magic) { const n = rollExpr(g.items), taken = new Set((o.append ? L.items : []).map(e => e.ref));
      for (let i = 0; i < n; i++) { const it = randomMagicItem(pickWeighted(g.rar), { ...o, taken }); if (it.ref) taken.add(it.ref); out.push(lootEntry(it)); } }
    if (o.trinkets) { const n = rollExpr(g.trinkets); for (let i = 0; i < n; i++) out.push(lootEntry({ kind: "trinket", name: pick(trinkets()) })); }
  } else {
    const n = Math.max(1, +o.count || 1);
    for (let k = 1; k < n; k++) g.coins.forEach(([c, x]) => coins[c] += rollExpr(x));
    if (o.trinkets) for (let k = 0; k < n; k++) if (Math.random() < g.trinket) out.push(lootEntry({ kind: "trinket", name: pick(trinkets()) }));
  }
  if (!o.append) { L.items = []; L.coins = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }; }
  L.coins ||= {}; COINS.forEach(c => L.coins[c] = (+L.coins[c] || 0) + coins[c]);
  L.items.push(...out);
}
function rerollEntry(L, e) {
  if (e.kind === "magic") Object.assign(e, randomMagicItem(e.rarity, { taken: new Set(L.items.map(x => x.ref)) }), { id: e.id, qty: e.qty });
  else if (e.kind === "trinket") e.name = pick(trinkets());
  else if (e.kind === "gem" || e.kind === "art") e.name = randomValuable(e.kind, e.value).name;
}
function lootValue(L) { return COINS.reduce((t, c) => t + (+L.coins?.[c] || 0) * COIN_GP[c], 0) + (L.items || []).reduce((t, e) => t + (+e.value || 0) * (+e.qty || 1), 0); }
const fmtGp = n => Math.round(n).toLocaleString("en-US") + " gp";

// ----- views -----
function vItemsCard() {   // start page
  const n = (S.items.list || []).length, t = (S.items.trinkets || []).length, imp = S.ui.iimp || {};
  return `<div class="card"><h3>Magic item library</h3>
    <p>${n ? `<b>${n}</b> magic items from ${esc(S.items.source || "aidedd.org")} (imported ${esc(S.items.imported || "?")}), ` : "No magic items on this device yet. "}${t >= 20 ? `<b>${t}</b> trinkets from the 2024 rules.` : `${BUILTIN_TRINKETS.length} built-in trinkets.`}</p>
    ${S.server ? (imp.running ? `<div class="progress"><div style="width:${imp.total ? Math.round(100 * imp.done / imp.total) : 3}%"></div></div><p class="small muted">${esc(imp.msg)} (${imp.done}/${imp.total})</p>`
      : `<div class="row"><button data-act="impItems">${n ? "Update" : "Import"} magic items from aidedd.org</button><label class="small"><input type="checkbox" id="iimp2014"> also older 2014 items</label></div>`)
      : `<p class="small muted">The import runs on the laptop; the library then comes here with your backup file or Google Drive sync.</p>`}
    <div class="row" style="margin-top:8px"><button class="small" data-act="miNew">✨ Create your own magic item</button><span class="small muted">${(S.myItems || []).length} of your own items</span></div>
    ${imp.error ? `<p class="warn">${esc(imp.error)}</p>` : ""}</div>`;
}
function lootList() { return S.scen.loot ||= []; }
function vLoot() {
  const ls = lootList();
  if (!ls.some(l => l.id === S.ui.lootSel)) S.ui.lootSel = ls[0]?.id || null;
  return `${vOffers()}<div class="two"><div>
      <div class="card"><div class="row"><h3 style="margin:0">Loot (${ls.length})</h3><input id="newLoot" placeholder="Name, e.g. Dragon's hoard" style="flex:1;min-width:150px"><button data-act="addLoot">+ New loot list</button></div>
        <p class="small muted" style="margin:6px 0 0">Make a list per treasure (a chest, a hoard, what the boss carries…), fill it from the library or with 🎲 Generate, then edit it freely.</p></div>
      ${ls.map(lootCard).join("") || ""}
    </div>
    <div class="card"><h3>Library</h3>${libraryView()}</div></div>`;
}
function lootCard(L) {
  const i = lootList().indexOf(L), isSel = S.ui.lootSel === L.id, nodes = S.scen.nodes.slice().sort((a, b) => a.n - b.n);
  const gen = S.ui.lootGen === L.id, go = S.ui.genOpts ||= { type: "hoard", tier: "0", magic: true, valuables: true, trinkets: true, noAttune: false, count: 1 };
  const row = (e, k) => { const it = e.ref ? S.items.byKey[e.ref] : null;
    const tag = e.kind === "magic" ? `<span class="chip" style="background:${RAR_COL[e.rarity] || "#555"};color:#fff">${esc(e.rarity || "magic")}${it?.attune ? " · A" : ""}</span>`
      : e.kind === "gem" ? `<span class="chip">💎 ${e.value} gp</span>` : e.kind === "art" ? `<span class="chip">🏺 ${e.value} gp</span>` : e.kind === "trinket" ? `<span class="chip">trinket</span>` : "";
    return `<div class="lootrow">${inp(`loot.${i}.items.${k}.qty`, +e.qty || 1, { type: "number", style: "width:52px", attr: 'min="1"' })}
      ${e.ref || e.kind === "trinket" ? `<a href="#" class="grow" data-act="itemPeek" data-l="${L.id}" data-e="${e.id}">${esc(e.name)}</a>` : `<span class="grow">${esc(e.name)}</span>`}${tag}
      ${["magic", "trinket", "gem", "art"].includes(e.kind) ? `<button class="small ghost" data-act="lootReroll" data-l="${L.id}" data-e="${e.id}" title="Swap for another one">🎲</button>` : ""}
      ${true ? `<button class="small ghost" data-act="itemGive" data-l="${L.id}" data-e="${e.id}" title="Give this to one player">🎁</button>` : ""}<a href="#" data-act="lootDelItem" data-l="${L.id}" data-e="${e.id}" title="Remove">✕</a></div>`; };
  return `<div class="card lootcard ${isSel ? "sel" : ""}" id="loot-${L.id}" data-act="lootSel" data-id="${L.id}">
    <div class="row">${inp(`loot.${i}.name`, L.name, { style: "flex:1;font-weight:700;min-width:120px" })}
      <label class="small">at ${sel(`loot.${i}.node`, L.node || "", nodes.map(n => [n.id, "#" + n.n + " " + (n.title || "")]), { blank: "— no node —" })}</label>
      ${true ? `<button class="small" data-act="lootGive" data-id="${L.id}" title="Send this loot to the players' phones: they claim items, split the coins and press OK">🎁 Give to party</button>` : ""}<button class="small ghost" data-act="delLoot" data-id="${L.id}" title="Delete list">🗑</button></div>
    <div class="coins">${COINS.map(c => `<label>${c.toUpperCase()} ${inp(`loot.${i}.coins.${c}`, +L.coins?.[c] || 0, { type: "number", style: "width:86px", attr: 'min="0"' })}</label>`).join("")}</div>
    <div class="lootitems">${(L.items || []).map(row).join("") || '<p class="small muted">No items yet.</p>'}</div>
    <div class="row small" style="margin-top:6px"><input placeholder="Add your own item, e.g. Silver key to the vault" data-act-enter="lootCustom" data-l="${L.id}" style="flex:1;min-width:150px"><button class="small ghost" data-act="lootCustom" data-l="${L.id}">+ Add</button>
      <button class="small ${gen ? "" : "ghost"}" data-act="lootGenTog" data-id="${L.id}">🎲 Generate…</button><span class="right muted">≈ ${fmtGp(lootValue(L))}</span></div>
    ${gen ? `<div class="genbox"><div class="row small">
        <label>${sel("__gt", go.type, [["hoard", "Treasure hoard"], ["individual", "Individual treasure"]], { attr: 'data-act="genOpt" data-k="type"' }).replace('data-path="__gt"', "")}</label>
        <label>${sel("__gc", go.tier, LOOT_TIERS, { attr: 'data-act="genOpt" data-k="tier"' }).replace('data-path="__gc"', "")}</label>
        ${go.type === "individual" ? `<label>creatures <input type="number" min="1" value="${+go.count || 1}" data-act="genOpt" data-k="count" style="width:56px"></label>` : `<label><input type="checkbox" data-act="genOpt" data-k="magic" ${go.magic ? "checked" : ""}> magic items</label><label><input type="checkbox" data-act="genOpt" data-k="valuables" ${go.valuables ? "checked" : ""}> gems &amp; art</label>`}
        <label><input type="checkbox" data-act="genOpt" data-k="trinkets" ${go.trinkets ? "checked" : ""}> trinkets</label>${go.type === "hoard" ? `<label><input type="checkbox" data-act="genOpt" data-k="noAttune" ${go.noAttune ? "checked" : ""}> no attunement items</label>` : ""}</div>
      <div class="row small" style="margin-top:6px"><button data-act="lootGen" data-id="${L.id}">🎲 Generate (replace list)</button><button class="ghost" data-act="lootGen" data-id="${L.id}" data-append="1">+ Add to list</button>
        <span class="muted">Amounts follow the spirit of the DMG treasure tables — change coins, remove items or 🎲 swap single ones afterwards.</span></div>
      ${!(S.items.list || []).length && go.magic && go.type === "hoard" ? `<p class="small warn" style="margin:6px 0 0">No magic item library yet: magic items appear as placeholders like “Random rare magic item”.</p>` : ""}</div>` : ""}
  </div>`;
}
function libraryView() {
  const tab = S.ui.libTab || "magic";
  const tabs = `<div class="row small" style="margin-bottom:6px"><button class="small ${tab === "magic" ? "" : "ghost"}" data-act="libTab" data-k="magic">✨ Magic items (${(S.items.list || []).length})</button><button class="small ${tab === "trinket" ? "" : "ghost"}" data-act="libTab" data-k="trinket">🪙 Trinkets (${trinkets().length})</button>
    <button class="small" data-act="miNew">✨ Create an item</button><span class="muted right">+ Add puts it into the highlighted loot list</span></div>`;
  if (tab === "trinket") return tabs + `<div class="row"><input placeholder="🔍 Search trinkets" value="${esc(S.ui.trq || "")}" data-act-input="trq" style="flex:1"><button class="small ghost" data-act="libRandTrinket">🎲 Random trinket</button></div>
    <div id="liblist" data-sk="liblist" class="liblist">${trinketRows()}</div>`;
  if (!(S.items.list || []).length) return tabs + `<p class="muted">${S.server ? "Import the magic item library on the start page (needs internet once)." : "The magic item library comes from the laptop (start page → Magic item library), then via backup file or Google Drive sync."}</p>`;
  const rs = S.ui.libRar || [], cats = [...new Set(libItems().map(x => x.cat || "Other"))].sort();
  return tabs + `<div class="row"><input placeholder="🔍 Search name or description word" value="${esc(S.ui.libq || "")}" data-act-input="libq" style="flex:1">
      ${(S.items.list || []).some(x => x.ed === "2014") ? sel("__led", S.ui.libEd || "2024", [["2024", "2024"], ["2014", "2014"], ["all", "All editions"]], { attr: 'data-act="libEd"' }).replace('data-path="__led"', "") : ""}</div>
    <div class="row small" style="margin-top:6px;gap:4px"><span class="muted">Rarity:</span>${RARITIES.map(r => `<a href="#" class="chip ${rs.includes(r) ? "on" : ""}" data-act="libRar" data-r="${r}">${cap(r)}</a>`).join("")}</div>
    <div class="row small" style="margin-top:4px;gap:4px"><span class="muted">Type:</span>${cats.map(c => `<a href="#" class="chip ${(S.ui.libCat || []).includes(c) ? "on" : ""}" data-act="libCat" data-c="${esc(c)}">${esc(c)}</a>`).join("")}
      <label class="small" style="margin-left:6px"><input type="checkbox" data-act="libNoAtt" ${S.ui.libNoAtt ? "checked" : ""}> no attunement</label></div>
    <div id="liblist" data-sk="liblist" class="liblist">${libRows()}</div>`;
}
function libRows() {
  const q = norm(S.ui.libq || ""), rs = S.ui.libRar || [], cs = S.ui.libCat || [];
  let list = libItems().filter(x => (!rs.length || rs.includes(x.rarity)) && (!cs.length || cs.includes(x.cat || "Other")) && (!S.ui.libNoAtt || !x.attune));
  if (q) list = list.filter(x => norm(x.name).includes(q) || (q.length > 3 && norm(S.items.blocks[itemKey(x)] || "").includes(q)));
  list = list.slice().sort((a, b) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity) || a.name.localeCompare(b.name));
  const shown = list.slice(0, 200);
  return shown.map(x => { const k = itemKey(x), open = S.ui.libOpen === k;
    return `<div class="mrow"><div class="mh"><a href="#" data-act="libOpen" data-k="${esc(k)}">${open ? "▾" : "▸"} ${esc(x.name)}</a>
      <span class="chip" style="background:${RAR_COL[x.rarity] || "#555"};color:#fff">${esc(x.rarity || "?")}</span><span class="small muted">${esc([x.cat, x.attune ? "attunement" : ""].filter(Boolean).join(" · "))}</span>
      ${x.ed === "custom" ? `<span class="chip">✨ yours</span><button class="small ghost" data-act="miEdit" data-k="${esc(k)}">✎</button>` : ""}<button class="small right" data-act="libAdd" data-k="${esc(k)}">+ Add</button></div>${open ? itemBlock(k) : ""}</div>`; }).join("")
    + (list.length > shown.length ? `<p class="small muted">${list.length - shown.length} more — refine the search.</p>` : "") + (list.length ? "" : '<p class="muted small">Nothing found.</p>');
}
function trinketRows() {
  const q = norm(S.ui.trq || ""), all = trinkets();
  const list = all.map((t, i) => [t, i]).filter(([t]) => !q || norm(t).includes(q));
  return list.map(([t, i]) => `<div class="mrow"><div class="mh"><span class="small muted" style="width:28px">${i + 1}</span><span class="grow">${esc(t)}</span><button class="small right" data-act="libAddTrinket" data-i="${i}">+ Add</button></div></div>`).join("") || '<p class="muted small">Nothing found.</p>';
}
function itemBlock(key) {
  const it = S.items.byKey[key], html = S.items.blocks[key];
  if (!it) return "";
  const body = html ? linkifyHtml(html, it.name) : `<h1>${esc(it.name)}</h1><div class="type">${esc([it.cat, it.rarity, it.attune ? "(requires attunement)" : ""].filter(Boolean).join(", "))}</div><p class="muted">No description imported.</p>`;
  return `<div class="statblock aidedd itemblock">${body}${it.src ? `<p class="sbsrc">Source: ${esc(it.src)} (${it.ed})</p>` : ""}</div>`;
}
function mItem() {
  const { l, e } = S.modal, L = lootList().find(x => x.id === l), en = L?.items.find(x => x.id === e);
  if (!en) return "";
  const body = en.ref ? itemBlock(en.ref) : `<div class="statblock aidedd itemblock"><h1>${esc(en.name)}</h1><div class="type">${esc(en.kind === "trinket" ? "Trinket" : en.kind)}</div></div>`;
  return `${body}<div class="foot"><button data-act="closeModal">Close</button></div>`;
}
function mMon() {
  const sm = S.scen.monsters.find(m => m.id === S.modal.id); if (!sm) return "";
  return `${statBlock(sm)}<div class="foot"><button class="ghost" data-act="editMon" data-id="${sm.id}">✎ ${sm.custom && !sm.ref ? "Edit" : "Edit as copy"}</button><button class="ghost" data-act="monGo" data-id="${sm.id}">Open in Monsters tab</button><button data-act="closeModal">Close</button></div>`;
}
function lootAt(nodeId) { return (S.scen?.loot || []).filter(L => L.node === nodeId); }

// ----- actions -----
const findLoot = id => lootList().find(x => x.id === id);
function targetLoot() { let L = findLoot(S.ui.lootSel); if (!L) { L = { id: uid(), name: "Loot", node: "", coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, items: [] }; lootList().push(L); S.ui.lootSel = L.id; } return L; }
Object.assign(ACT, {
  addLoot: () => { const n = ($("#newLoot").value || "").trim() || "Loot " + (lootList().length + 1); const L = { id: uid(), name: n, node: "", coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, items: [] }; lootList().push(L); S.ui.lootSel = L.id; save(); render(); },
  delLoot: (el, e) => { e.stopPropagation(); if (!confirm("Delete this loot list?")) return; S.scen.loot = lootList().filter(x => x.id !== el.dataset.id); save(); render(); },
  lootSel: (el, e) => { if (S.ui.lootSel === el.dataset.id) return; if (e.target.closest("input,select,button,a,textarea")) { S.ui.lootSel = el.dataset.id; return; } S.ui.lootSel = el.dataset.id; render(); },
  lootDelItem: (el, e) => { e.stopPropagation(); const L = findLoot(el.dataset.l); L.items = L.items.filter(x => x.id !== el.dataset.e); save(); render(); },
  lootReroll: (el, e) => { e.stopPropagation(); const L = findLoot(el.dataset.l), en = L.items.find(x => x.id === el.dataset.e); rerollEntry(L, en); save(); render(); },
  lootCustom: (el, e) => { e?.stopPropagation?.(); const box = el.tagName === "INPUT" ? el : el.parentElement.querySelector("input"); const v = (box.value || "").trim(); if (!v) return;
    findLoot(el.dataset.l).items.push(lootEntry({ kind: "custom", name: v })); S.ui.lootSel = el.dataset.l; save(); render(); },
  lootGenTog: (el, e) => { e.stopPropagation(); S.ui.lootSel = el.dataset.id; S.ui.lootGen = S.ui.lootGen === el.dataset.id ? null : el.dataset.id; render(); },
  lootGen: (el, e) => { e.stopPropagation(); const L = findLoot(el.dataset.id); if (!el.dataset.append && L.items.length && !confirm("Replace the items and coins in this list?")) return;
    generateLoot(L, { ...S.ui.genOpts, append: !!el.dataset.append }); save(); render(); },
  itemPeek: (el, e) => { e.stopPropagation(); S.modal = { type: "item", l: el.dataset.l, e: el.dataset.e }; renderModal(); },
  libTab: el => { S.ui.libTab = el.dataset.k; render(); },
  libOpen: el => { S.ui.libOpen = S.ui.libOpen === el.dataset.k ? null : el.dataset.k; $("#liblist").innerHTML = libRows(); },
  libRar: el => { const a = S.ui.libRar || [], r = el.dataset.r; S.ui.libRar = a.includes(r) ? a.filter(x => x !== r) : [...a, r]; render(); },
  libCat: el => { const a = S.ui.libCat || [], c = el.dataset.c; S.ui.libCat = a.includes(c) ? a.filter(x => x !== c) : [...a, c]; render(); },
  libAdd: el => { const it = S.items.byKey[el.dataset.k], L = targetLoot(); L.items.push(lootEntry({ kind: "magic", ref: el.dataset.k, name: it.name, rarity: it.rarity })); save(); render(); toast(`${it.name} → ${L.name}`); },
  libAddTrinket: el => { const t = trinkets()[+el.dataset.i], L = targetLoot(); L.items.push(lootEntry({ kind: "trinket", name: t })); save(); render(); toast(`Trinket → ${L.name}`); },
  libRandTrinket: () => { const L = targetLoot(); L.items.push(lootEntry({ kind: "trinket", name: pick(trinkets()) })); save(); render(); toast(`Random trinket → ${L.name}`); },
  monPeek: (el, e) => { e.stopPropagation(); S.modal = { type: "mon", id: el.dataset.id }; renderModal(); },
  monGo: el => { S.modal = null; S.tab = "monsters"; S.ui.openMon = el.dataset.id; render(); },
  lootGo: el => { S.modal = null; S.tab = "loot"; S.ui.lootSel = el.dataset.id; S.ui.popNode = null; render(); setTimeout(() => $("#loot-" + el.dataset.id)?.scrollIntoView({ block: "start", behavior: "smooth" }), 50); },
  impItems: async () => { await api("api/items/import", { method: "POST", body: { include2014: !!$("#iimp2014")?.checked } }); S.ui.iimp = { running: true, done: 0, total: 0, msg: "Starting…" }; render(); pollItemImport(); }
});
Object.assign(CHG, {
  genOpt: el => { S.ui.genOpts[el.dataset.k] = el.type === "checkbox" ? el.checked : el.value; },
  libEd: el => { S.ui.libEd = el.value; },
  libNoAtt: el => { S.ui.libNoAtt = el.checked; }
});
async function pollItemImport() {
  const st = await api("api/items/import"); S.ui.iimp = st;
  if (S.view === "home") render();
  if (st.running) setTimeout(pollItemImport, 900); else { await Folder.pull(); await loadItems(); if (S.view === "home") render(); if (!st.error) toast("Magic items ready"); }
}
document.addEventListener("input", e => {
  const el = e.target;
  if (el.dataset.actInput === "libq") { S.ui.libq = el.value; const l = $("#liblist"); if (l) l.innerHTML = libRows(); }
  if (el.dataset.actInput === "trq") { S.ui.trq = el.value; const l = $("#liblist"); if (l) l.innerHTML = trinketRows(); }
});
document.addEventListener("keydown", e => { const el = e.target; if (e.key === "Enter" && el.dataset?.actEnter === "lootCustom") ACT.lootCustom(el, e); });
