"use strict";
/* ============ Your own magic items: a step-by-step creator with an estimated rarity and similar official items ============
   Stored on this device (and in the backup file), shown in the magic item library like the imported ones. */
const MI_WEAPONS = [ // name, damage, type, properties
  ["Club", "1d4", "bludgeoning", "Light"], ["Dagger", "1d4", "piercing", "Finesse, Light, Thrown"], ["Greatclub", "1d8", "bludgeoning", "Two-Handed"], ["Handaxe", "1d6", "slashing", "Light, Thrown"],
  ["Javelin", "1d6", "piercing", "Thrown"], ["Light Hammer", "1d4", "bludgeoning", "Light, Thrown"], ["Mace", "1d6", "bludgeoning", ""], ["Quarterstaff", "1d6", "bludgeoning", "Versatile (1d8)"],
  ["Sickle", "1d4", "slashing", "Light"], ["Spear", "1d6", "piercing", "Thrown, Versatile (1d8)"], ["Dart", "1d4", "piercing", "Finesse, Thrown"], ["Light Crossbow", "1d8", "piercing", "Ammunition, Loading, Two-Handed"],
  ["Shortbow", "1d6", "piercing", "Ammunition, Two-Handed"], ["Sling", "1d4", "bludgeoning", "Ammunition"], ["Battleaxe", "1d8", "slashing", "Versatile (1d10)"], ["Flail", "1d8", "bludgeoning", ""],
  ["Glaive", "1d10", "slashing", "Heavy, Reach, Two-Handed"], ["Greataxe", "1d12", "slashing", "Heavy, Two-Handed"], ["Greatsword", "2d6", "slashing", "Heavy, Two-Handed"], ["Halberd", "1d10", "slashing", "Heavy, Reach, Two-Handed"],
  ["Lance", "1d10", "piercing", "Heavy, Reach"], ["Longsword", "1d8", "slashing", "Versatile (1d10)"], ["Maul", "2d6", "bludgeoning", "Heavy, Two-Handed"], ["Morningstar", "1d8", "piercing", ""],
  ["Pike", "1d10", "piercing", "Heavy, Reach, Two-Handed"], ["Rapier", "1d8", "piercing", "Finesse"], ["Scimitar", "1d6", "slashing", "Finesse, Light"], ["Shortsword", "1d6", "piercing", "Finesse, Light"],
  ["Trident", "1d8", "piercing", "Thrown, Versatile (1d10)"], ["Warhammer", "1d8", "bludgeoning", "Versatile (1d10)"], ["War Pick", "1d8", "piercing", "Versatile (1d10)"], ["Whip", "1d4", "slashing", "Finesse, Reach"],
  ["Blowgun", "1", "piercing", "Ammunition, Loading"], ["Hand Crossbow", "1d6", "piercing", "Ammunition, Light, Loading"], ["Heavy Crossbow", "1d10", "piercing", "Ammunition, Heavy, Loading, Two-Handed"], ["Longbow", "1d8", "piercing", "Ammunition, Heavy, Two-Handed"], ["Musket", "1d12", "piercing", "Ammunition, Loading, Two-Handed"], ["Pistol", "1d10", "piercing", "Ammunition, Loading"]
];
const MI_ARMOR = [["Padded", "11 + Dex"], ["Leather", "11 + Dex"], ["Studded Leather", "12 + Dex"], ["Hide", "12 + Dex (max 2)"], ["Chain Shirt", "13 + Dex (max 2)"], ["Scale Mail", "14 + Dex (max 2)"], ["Breastplate", "14 + Dex (max 2)"], ["Half Plate", "15 + Dex (max 2)"],
  ["Ring Mail", "14"], ["Chain Mail", "16"], ["Splint", "17"], ["Plate", "18"]];
const MI_CATS = ["Weapon", "Armor", "Shield", "Ring", "Wondrous item", "Wand", "Staff", "Rod", "Potion", "Ammunition"];
const MI_EFFECTS = {
  dmg: "Extra damage on a hit", res: "Resistance to a damage type", imm: "Immunity to a damage type", spell: "Cast a spell from it", ac: "Bonus to Armor Class",
  save: "Bonus to saving throws", spellatk: "Bonus to spell attacks and spell save DC", abil: "Sets an ability score", adv: "Advantage on something", speed: "Faster walking speed",
  fly: "Flying speed", dv: "Darkvision", text: "Something else (your own text)"
};
const RAR = ["common", "uncommon", "rare", "very rare", "legendary"];
const ABL = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
const ordinal = n => n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th");

// ---------- the rules sentences of an item ----------
function myItemExtra(my) { const d = (my.effects || []).find(e => e.t === "dmg"); return d ? `${d.n}d${d.s} ${d.type}` : ""; }
function myItemRules(my) {
  const out = [], b = +my.bonus || 0, sp = s => spellInfo(s.name);
  if (my.cat === "Weapon" && b) out.push(`You have a +${b} bonus to attack and damage rolls made with this magic weapon.`);
  if (my.cat === "Ammunition" && b) out.push(`You have a +${b} bonus to attack and damage rolls made with this piece of magic ammunition. Once it hits a target, it's no longer magical.`);
  if (my.cat === "Armor" && b) out.push(`You have a +${b} bonus to Armor Class while wearing this armor.`);
  if (my.cat === "Shield" && b) out.push(`While holding this Shield, you have a +${b} bonus to Armor Class. This bonus is in addition to the Shield's normal bonus to AC.`);
  const wear = ["Armor", "Ring", "Wondrous item", "Shield"].includes(my.cat) ? "While wearing or holding it" : "While you hold it";
  (my.effects || []).forEach(e => {
    if (e.t === "dmg") out.push(`On a hit, the target takes an extra ${e.n}d${e.s} ${cap(e.type || "")} damage${e.note ? " " + e.note : ""}.`);
    if (e.t === "res") out.push(`${wear}, you have Resistance to ${cap(e.type || "")} damage.`);
    if (e.t === "imm") out.push(`${wear}, you have Immunity to ${cap(e.type || "")} damage.`);
    if (e.t === "spell" && e.name) { const s = sp(e); const lvl = s ? (s.level ? ` (level ${s.level})` : " (cantrip)") : "";
      out.push(e.per === "will" ? `You can cast ${e.name}${lvl} from it at will.` : e.per === "charges" ? `It has ${e.uses || 3} charges. You can expend 1 charge to cast ${e.name}${lvl} from it. It regains 1d${Math.max(2, (e.uses || 3))} expended charges daily at dawn.`
        : `You can cast ${e.name}${lvl} from it ${+e.uses > 1 ? e.uses + " times" : "once"}; it regains ${+e.uses > 1 ? "all uses" : "this ability"} ${e.per === "short" ? "when you finish a Short or Long Rest" : "daily at dawn"}.`); }
    if (e.t === "ac") out.push(`${wear}, you gain a +${e.v || 1} bonus to Armor Class.`);
    if (e.t === "save") out.push(`${wear}, you gain a +${e.v || 1} bonus to saving throws.`);
    if (e.t === "spellatk") out.push(`While holding it, you gain a +${e.v || 1} bonus to spell attack rolls and your spell save DC.`);
    if (e.t === "abil") out.push(`Your ${ABL[e.ab] || "Strength"} score is ${e.v || 19} while you wear it. It has no effect on you if your score is already equal to or greater than that.`);
    if (e.t === "adv") out.push(`${wear}, you have Advantage on ${e.what || "Dexterity (Stealth) checks"}.`);
    if (e.t === "speed") out.push(`${wear}, your Speed increases by ${e.v || 10} feet.`);
    if (e.t === "fly") out.push(`${wear}, you have a Fly Speed of ${e.v || 30} feet.`);
    if (e.t === "dv") out.push(`${wear}, you have Darkvision with a range of ${e.v || 60} feet.`);
    if (e.t === "text" && e.text) out.push(e.text);
  });
  return out;
}
function myItemDamage(my) {   // weapon damage parts for the dice roller
  const w = MI_WEAPONS.find(x => x[0] === my.base); if (!w) return [];
  const b = +my.bonus || 0, parts = [{ f: w[1] + (b ? "+" + b : ""), type: w[2] }];
  (my.effects || []).filter(e => e.t === "dmg").forEach(e => parts.push({ f: `${e.n}d${e.s}`, type: dtKey(e.type) }));
  return parts;
}

// ---------- rarity estimate (DMG guidelines + comparable official items) ----------
function effectScore(e, my) {
  const v = +e.v || 0;
  switch (e.t) {
    case "dmg": { const avg = (+e.n || 1) * ((+e.s || 4) + 1) / 2; return avg <= 2.5 ? 1 : avg <= 4.5 ? 1.5 : avg <= 7 ? 2 : avg <= 10.5 ? 3 : 3.5; }
    case "res": return 2; case "imm": return 3;
    case "spell": { const s = spellInfo(e.name), L = s ? s.level : 1; let r = [0.5, 1, 1.5, 2, 2, 2.5, 3, 3, 3.5, 4][L] ?? 2; if (e.per === "will") r += 1; else if (+e.uses >= 3) r += 0.5; return r; }
    case "ac": return v >= 3 ? 3.5 : v === 2 ? 2.5 : 1.5;
    case "save": return v >= 3 ? 3 : v === 2 ? 2 : 1;
    case "spellatk": return Math.min(3, v || 1);
    case "abil": return v >= 27 ? 4 : v >= 25 ? 3.5 : v >= 23 ? 3 : v >= 21 ? 2 : 1;
    case "adv": return 1; case "speed": return (v || 10) >= 30 ? 2 : 1; case "fly": return 2; case "dv": return 1;
    case "text": return +e.w || 0;
  }
  return 0;
}
function estimateRarity(my) {
  const why = [], scores = [], b = +my.bonus || 0;
  if (b && ["Weapon", "Ammunition"].includes(my.cat)) { scores.push(my.cat === "Ammunition" ? b - 0.5 : b); why.push(`+${b} ${my.cat.toLowerCase()} ≈ ${RAR[Math.round(my.cat === "Ammunition" ? b - 0.5 : b)]}`); }
  if (b && my.cat === "Armor") { scores.push(b + 1); why.push(`+${b} armor ≈ ${RAR[Math.min(4, b + 1)]}`); }
  if (b && my.cat === "Shield") { scores.push(b); why.push(`+${b} shield ≈ ${RAR[b]}`); }
  (my.effects || []).forEach(e => { const s = effectScore(e, my); if (s > 0) { scores.push(s); why.push(`${MI_EFFECTS[e.t].toLowerCase()} ≈ ${RAR[Math.min(4, Math.round(s))]}`); } });
  scores.sort((a, c) => c - a);
  let total = scores.length ? scores[0] + scores.slice(1).reduce((t, s) => t + Math.min(0.75, s * 0.35), 0) : 0;
  if (my.cat === "Potion" || my.cat === "Ammunition") total -= 0.5;   // used up once
  const idx = Math.max(0, Math.min(4, Math.round(total - 0.01)));
  return { rarity: RAR[idx], score: total, why };
}
// a few well-known official items to compare with: name, rarity, tags
const MI_REF = [
  ["Weapon, +1", "uncommon", "cat:weapon wb:1"], ["Weapon, +2", "rare", "cat:weapon wb:2"], ["Weapon, +3", "very rare", "cat:weapon wb:3"],
  ["Armor, +1", "rare", "cat:armor ab:1"], ["Armor, +2", "very rare", "cat:armor ab:2"], ["Armor, +3", "legendary", "cat:armor ab:3"],
  ["Shield, +1", "uncommon", "cat:shield sb:1"], ["Shield, +2", "rare", "cat:shield sb:2"], ["Shield, +3", "very rare", "cat:shield sb:3"],
  ["Flame Tongue", "rare", "cat:weapon dmg dmg:fire"], ["Frost Brand", "very rare", "cat:weapon dmg dmg:cold res res:fire"], ["Sun Blade", "rare", "cat:weapon wb:2 dmg dmg:radiant"],
  ["Dragon Slayer", "rare", "cat:weapon wb:1 dmg"], ["Giant Slayer", "rare", "cat:weapon wb:1 dmg"], ["Holy Avenger", "legendary", "cat:weapon wb:3 dmg dmg:radiant"],
  ["Mace of Disruption", "rare", "cat:weapon dmg dmg:radiant"], ["Dagger of Venom", "rare", "cat:weapon wb:1 dmg dmg:poison"], ["Javelin of Lightning", "uncommon", "cat:weapon dmg dmg:lightning"],
  ["Oathbow", "very rare", "cat:weapon dmg dmg:piercing"], ["Berserker Axe", "rare", "cat:weapon wb:1 cursed"], ["Sword of Wounding", "rare", "cat:weapon dmg dmg:necrotic"],
  ["Armor of Resistance", "rare", "cat:armor res"], ["Ring of Resistance", "rare", "cat:ring res"], ["Brooch of Shielding", "uncommon", "cat:wondrous res res:force"], ["Potion of Resistance", "uncommon", "cat:potion res"],
  ["Cloak of Protection", "uncommon", "cat:wondrous ac:1 save:1"], ["Ring of Protection", "rare", "cat:ring ac:1 save:1"], ["Bracers of Defense", "rare", "cat:wondrous ac:2"], ["Ioun Stone (Protection)", "rare", "cat:wondrous ac:1"],
  ["Wand of the War Mage, +1", "uncommon", "cat:wand spellatk:1"], ["Wand of the War Mage, +2", "rare", "cat:wand spellatk:2"], ["Rod of the Pact Keeper, +1", "uncommon", "cat:rod spellatk:1"], ["Staff of Power", "very rare", "cat:staff spellatk:2 ac:2 save:2 spell"],
  ["Gauntlets of Ogre Power", "uncommon", "cat:wondrous abil abil:str"], ["Headband of Intellect", "uncommon", "cat:wondrous abil abil:int"], ["Amulet of Health", "rare", "cat:wondrous abil abil:con"],
  ["Belt of Hill Giant Strength", "rare", "cat:wondrous abil abil:str abil21"], ["Belt of Fire Giant Strength", "very rare", "cat:wondrous abil abil:str abil25"],
  ["Goggles of Night", "uncommon", "cat:wondrous dv"], ["Boots of Elvenkind", "uncommon", "cat:wondrous adv"], ["Cloak of Elvenkind", "uncommon", "cat:wondrous adv"], ["Eyes of the Eagle", "uncommon", "cat:wondrous adv"],
  ["Boots of Striding and Springing", "uncommon", "cat:wondrous speed"], ["Boots of Speed", "rare", "cat:wondrous speed"], ["Winged Boots", "uncommon", "cat:wondrous fly"], ["Cloak of the Bat", "rare", "cat:wondrous fly dv"],
  ["Wand of Magic Missiles", "uncommon", "cat:wand spell spell:1"], ["Wand of Web", "uncommon", "cat:wand spell spell:2"], ["Wand of Fireballs", "rare", "cat:wand spell spell:3"], ["Wand of Lightning Bolts", "rare", "cat:wand spell spell:3"],
  ["Staff of Fire", "very rare", "cat:staff spell spell:3 res res:fire"], ["Staff of Healing", "rare", "cat:staff spell spell:1"], ["Necklace of Fireballs", "rare", "cat:wondrous spell spell:3"], ["Ring of Spell Storing", "rare", "cat:ring spell"],
  ["Periapt of Proof against Poison", "rare", "cat:wondrous imm imm:poison"], ["Ring of Feather Falling", "rare", "cat:ring spell spell:1"], ["Pearl of Power", "uncommon", "cat:wondrous spell"]
];
function myTags(my) {
  const t = new Set(["cat:" + (my.cat || "").split(" ")[0].toLowerCase()]), b = +my.bonus || 0;
  if (b) t.add((my.cat === "Armor" ? "ab:" : my.cat === "Shield" ? "sb:" : "wb:") + b);
  if (my.cursed) t.add("cursed");
  (my.effects || []).forEach(e => {
    if (e.t === "dmg") { t.add("dmg"); t.add("dmg:" + dtKey(e.type)); }
    if (e.t === "res" || e.t === "imm") { t.add(e.t); t.add(e.t + ":" + dtKey(e.type)); }
    if (e.t === "spell") { t.add("spell"); const s = spellInfo(e.name); if (s) t.add("spell:" + s.level); }
    if (["ac", "save", "spellatk"].includes(e.t)) t.add(e.t + ":" + (e.v || 1));
    if (e.t === "abil") { t.add("abil"); t.add("abil:" + e.ab); if (+e.v >= 21) t.add("abil" + (+e.v >= 25 ? 25 : 21)); }
    if (["adv", "speed", "fly", "dv"].includes(e.t)) t.add(e.t);
  });
  return t;
}
function similarItems(my) {
  const t = myTags(my);
  return MI_REF.map(([name, rarity, tags]) => { const ts = tags.split(" "); let s = 0; ts.forEach(x => { if (t.has(x)) s += x.startsWith("cat:") ? 1 : 2; else if (!x.startsWith("cat:")) s -= 0.6; }); return { name, rarity, s }; })
    .filter(x => x.s >= 2).sort((a, b) => b.s - a.s).slice(0, 3)
    .map(x => ({ ...x, key: (S.items.list || []).find(i => i.ed !== "custom" && norm(i.name) === norm(x.name)) ? itemKey((S.items.list || []).find(i => i.ed !== "custom" && norm(i.name) === norm(x.name))) : "" }));
}

// ---------- storage + library ----------
async function loadMyItems() { S.myItems = (await DDB.get("myitems")) || []; mergeMyItems(); }
async function saveMyItems() { await DDB.set("myitems", S.myItems); mergeMyItems(); }
function myRarity(my) { return my.rarity || estimateRarity(my).rarity; }
function myTypeLine(my) {
  const base = my.cat === "Weapon" || my.cat === "Armor" ? `${my.cat} (${my.base || "any"})` : my.cat;
  return `${base}, ${myRarity(my)}${my.attune ? " (requires attunement)" : ""}`;
}
function myItemHtml(my, dm = true) {
  const dmg = my.cat === "Weapon" ? myItemDamage(my) : [], w = MI_WEAPONS.find(x => x[0] === my.base), a = MI_ARMOR.find(x => x[0] === my.base);
  return `<h1>${esc(my.name || "Unnamed item")}</h1><div class="type">${esc(myTypeLine(my))}</div>
    ${my.img ? `<img class="sbimg" src="${my.img}" alt="">` : ""}
    ${my.desc ? `<p><em>${esc(my.desc).replace(/\n/g, "<br>")}</em></p>` : ""}
    ${myItemRules(my).map(r => `<p>${spellLinkify(r)}</p>`).join("")}
    ${dmg.length ? `<p><strong>Damage:</strong> <a href="#" class="cbdmg" data-act="dmgp" data-p="${esc(JSON.stringify(dmg))}" data-t="${esc(my.name)}">${dmg.map(p => esc(p.f) + " " + dtIcon(p.type, "inl")).join(" + ")}</a> <span class="small muted">+ Str/Dex modifier · ${esc(w ? w[3] : "")}</span></p>` : ""}
    ${a ? `<p><strong>AC:</strong> ${esc(a[1])}${+my.bonus ? " + " + my.bonus : ""}</p>` : ""}
    ${my.cursed && dm ? `<p><strong><em>Curse.</em></strong> ${esc(my.curse || "")} <span class="small muted">(hidden from the players until identified)</span></p>` : ""}`;
}
function mergeMyItems() {
  const I = S.items; I.list = (I.list || []).filter(x => x.ed !== "custom"); I.blocks ||= {}; I.byKey ||= {};
  for (const k in I.byKey) if (k.endsWith("|custom")) delete I.byKey[k];
  (S.myItems || []).forEach(my => { const it = { slug: "my-" + my.id, ed: "custom", name: my.name || "Unnamed item", cat: my.cat === "Wondrous item" ? "Wondrous Item" : my.cat, rarity: myRarity(my), attune: !!my.attune, src: "Your own item", my };
    I.list.push(it); I.byKey[itemKey(it)] = it; I.blocks[itemKey(it)] = myItemHtml(my); });
}

// ---------- creator ----------
function newMyItem() { return { id: uid(), name: "", cat: "Weapon", base: "Longsword", bonus: 1, effects: [], attune: false, cursed: false, curse: "", desc: "", img: "", rarity: "" }; }
function effectRow(e, i) {
  const k = `effects.${i}.`, num = (p, v, w = 60, o = "") => `<input type="number" value="${esc(v ?? "")}" data-act="miSet" data-k="${k + p}" data-num style="width:${w}px" ${o}>`;
  const txt = (p, v, ph, w = "100%") => `<input value="${esc(v ?? "")}" data-act="miSet" data-k="${k + p}" placeholder="${esc(ph)}" style="width:${w}">`;
  const types = (p, v) => `<select data-act="miSet" data-k="${k + p}">${DMG_TYPES.map(t => `<option value="${t.toLowerCase()}" ${dtKey(v) === t.toLowerCase() ? "selected" : ""}>${t}</option>`).join("")}</select>`;
  let body = "";
  if (e.t === "dmg") body = `${num("n", e.n, 50, 'min="1"')}d<select data-act="miSet" data-k="${k}s" data-num>${[4, 6, 8, 10, 12].map(s => `<option ${+e.s === s ? "selected" : ""}>${s}</option>`).join("")}</select>${types("type", e.type)}${txt("note", e.note, "optional, e.g. against undead", "150px")}`;
  else if (e.t === "res" || e.t === "imm") body = types("type", e.type);
  else if (e.t === "spell") body = `<input list="mi_spells" value="${esc(e.name || "")}" data-act="miSet" data-k="${k}name" placeholder="Spell name" style="width:150px">
      <select data-act="miSet" data-k="${k}per">${[["day", "per day"], ["short", "per short rest"], ["charges", "charges"], ["will", "at will"]].map(([v, l]) => `<option value="${v}" ${e.per === v ? "selected" : ""}>${l}</option>`).join("")}</select>${e.per === "will" ? "" : num("uses", e.uses ?? 1, 52, 'min="1"')}
      ${spellInfo(e.name) ? `<a href="#" class="small" data-act="spellPeek" data-n="${esc(e.name)}">${spellInfo(e.name).level ? "level " + spellInfo(e.name).level : "cantrip"}</a>` : ""}`;
  else if (["ac", "save", "spellatk"].includes(e.t)) body = `+${num("v", e.v ?? 1, 50, 'min="1" max="3"')}`;
  else if (e.t === "abil") body = `<select data-act="miSet" data-k="${k}ab">${Object.entries(ABL).map(([a, l]) => `<option value="${a}" ${e.ab === a ? "selected" : ""}>${l}</option>`).join("")}</select> becomes ${num("v", e.v ?? 19, 56)}`;
  else if (e.t === "adv") body = txt("what", e.what, "e.g. Wisdom (Perception) checks", "240px");
  else if (["speed", "fly", "dv"].includes(e.t)) body = `${num("v", e.v ?? (e.t === "dv" ? 60 : e.t === "fly" ? 30 : 10), 60)} ft`;
  else if (e.t === "text") body = `${txt("text", e.text, "What it does", "260px")}<select data-act="miSet" data-k="${k}w" data-num title="How strong is it?">${[[0, "minor"], [1, "useful"], [2, "strong"], [3, "very strong"]].map(([v, l]) => `<option value="${v}" ${+e.w === v ? "selected" : ""}>${l}</option>`).join("")}</select>`;
  return `<div class="mieff"><b>${MI_EFFECTS[e.t]}</b> ${body}<a href="#" data-act="miEffDel" data-i="${i}" title="Remove">✕</a></div>`;
}
MODALS.myitem = () => {
  const d = S.modal.d, est = estimateRarity(d), sim = similarItems(d), bonusOk = ["Weapon", "Armor", "Shield", "Ammunition"].includes(d.cat);
  const set = (p, v, o = "") => `data-act="miSet" data-k="${p}" ${o}`;
  return `<h2>✨ ${S.modal.isNew ? "Create a magic item" : "Edit your item"}</h2>
    <div class="mibox"><div class="miform">
      <label>Name <input value="${esc(d.name)}" ${set("name")} placeholder="e.g. Emberfang" style="width:100%"></label>
      <div class="row" style="margin-top:6px"><label>Kind <select ${set("cat")}>${MI_CATS.map(c => `<option ${d.cat === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>
        ${d.cat === "Weapon" ? `<label>Weapon <select ${set("base")}>${MI_WEAPONS.map(w => `<option ${d.base === w[0] ? "selected" : ""}>${w[0]}</option>`).join("")}</select></label>` : ""}
        ${d.cat === "Armor" ? `<label>Armor <select ${set("base")}>${MI_ARMOR.map(w => `<option ${d.base === w[0] ? "selected" : ""}>${w[0]}</option>`).join("")}</select></label>` : ""}
        ${bonusOk ? `<label>Bonus <select ${set("bonus", "data-num")}>${[0, 1, 2, 3].map(n => `<option value="${n}" ${+d.bonus === n ? "selected" : ""}>${n ? "+" + n : "none"}</option>`).join("")}</select></label>` : ""}</div>
      <h3 style="margin:12px 0 4px">Effects</h3>${(d.effects || []).map(effectRow).join("") || '<p class="small muted">No extra effects yet.</p>'}
      <select data-act="miEffAdd"><option value="">＋ add an effect…</option>${Object.entries(MI_EFFECTS).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select>
      <datalist id="mi_spells">${(S.spells.list || []).map(s => `<option value="${esc(s.name)}">`).join("")}</datalist>
      <div class="row" style="margin-top:10px"><label><input type="checkbox" ${set("attune")} ${d.attune ? "checked" : ""}> requires attunement</label><label><input type="checkbox" ${set("cursed")} ${d.cursed ? "checked" : ""}> cursed</label></div>
      ${d.cursed ? `<label class="small">The curse (players only see it after 🔍 Identify)<textarea ${set("curse")} rows="2">${esc(d.curse || "")}</textarea></label>` : ""}
      <label class="small">Description / looks (optional)<textarea ${set("desc")} rows="3" placeholder="A blackened blade whose edge glows like coals…">${esc(d.desc || "")}</textarea></label>
      <div class="row" style="margin-top:6px">${d.img ? `<img src="${d.img}" style="width:60px;height:60px;object-fit:cover;border-radius:8px">` : ""}<button class="small ghost" data-act="miImg">🖼 ${d.img ? "Change" : "Add"} picture</button>${d.img ? `<button class="small ghost" data-act="miImgDel">Remove</button>` : ""}<span class="small muted">or copy a picture and press Ctrl+V</span></div>
    </div>
    <div class="mipreview">
      <div class="miest"><div class="small muted">Estimated rarity</div><div><span class="chip" style="background:${RAR_COL[est.rarity]};color:#fff;font-size:15px">${cap(est.rarity)}</span>
        <label class="small" style="margin-left:6px">use <select ${set("rarity")}><option value="">the estimate</option>${RAR.map(r => `<option value="${r}" ${d.rarity === r ? "selected" : ""}>${cap(r)}</option>`).join("")}</select></label></div>
        ${est.why.length ? `<ul class="small">${est.why.map(w => `<li>${esc(w)}</li>`).join("")}</ul>` : '<p class="small muted">No magical effect yet → common.</p>'}
        ${sim.length ? `<div class="small"><b>Similar official items:</b> ${sim.map(x => `${x.key ? `<a href="#" data-act="miPeekRef" data-k="${esc(x.key)}">${esc(x.name)}</a>` : esc(x.name)} <span class="chip" style="background:${RAR_COL[x.rarity]};color:#fff">${x.rarity}</span>`).join(" · ")}</div>` : ""}</div>
      <div class="statblock aidedd itemblock">${myItemHtml(d)}</div></div></div>
    <div class="foot">${S.modal.isNew ? "" : `<button class="danger" data-act="miDelete" style="margin-right:auto">Delete</button>`}<button class="ghost" data-act="closeModal">Cancel</button><button data-act="miSave">💾 Save to the item library</button></div>`;
};
const EFF_DEFAULT = { dmg: { n: 1, s: 6, type: "fire" }, res: { type: "fire" }, imm: { type: "poison" }, spell: { name: "", per: "day", uses: 1 }, ac: { v: 1 }, save: { v: 1 }, spellatk: { v: 1 }, abil: { ab: "str", v: 19 }, adv: { what: "" }, speed: { v: 10 }, fly: { v: 30 }, dv: { v: 60 }, text: { text: "", w: 1 } };
Object.assign(ACT, {
  miNew: () => { S.modal = { type: "myitem", d: newMyItem(), isNew: true }; renderModal(); },
  miEdit: (el, e) => { e?.stopPropagation?.(); const my = (S.myItems || []).find(x => "my-" + x.id + "|custom" === el.dataset.k); if (!my) return; S.modal = { type: "myitem", d: clone(my) }; renderModal(); },
  miEffDel: el => { S.modal.d.effects.splice(+el.dataset.i, 1); renderModal(); },
  miImg: async () => { const f = await pickFile(); if (!f) return; S.modal.d.img = await smallImage(f, 520, 0.8); renderModal(); },
  miImgDel: () => { S.modal.d.img = ""; renderModal(); },
  miPeekRef: el => { S.modal = { type: "secitem", k: el.dataset.k, back: S.modal }; renderModal(); },
  miSave: async () => { const d = S.modal.d; if (!d.name.trim()) return toast("Give the item a name"); d.updated = Date.now();
    const a = S.myItems ||= []; const i = a.findIndex(x => x.id === d.id); if (i >= 0) a[i] = clone(d); else a.push(clone(d));
    await saveMyItems(); S.modal = null; render(); toast(d.name + " saved — " + myRarity(d)); },
  miDelete: async () => { if (!confirm("Delete this item from your library?")) return; S.myItems = (S.myItems || []).filter(x => x.id !== S.modal.d.id); await saveMyItems(); S.modal = null; render(); }
});
Object.assign(CHG, {
  miSet: el => { const v = el.type === "checkbox" ? el.checked : el.dataset.num !== undefined ? (parseFloat(el.value) || 0) : el.value; setPath(S.modal.d, el.dataset.k, v);
    if (el.dataset.k === "cat") { const d = S.modal.d; d.base = d.cat === "Weapon" ? "Longsword" : d.cat === "Armor" ? "Chain Mail" : ""; if (!["Weapon", "Armor", "Shield", "Ammunition"].includes(d.cat)) d.bonus = 0; } },
  miEffAdd: el => { if (!el.value) return; S.modal.d.effects.push({ t: el.value, ...clone(EFF_DEFAULT[el.value]) }); }
});
