"use strict";
/* Random NPC names. Tags: name styles (multi-select) + gender (multi-select). Works offline. */
const NAMES = (() => {
  const L = s => s.split(/\s+/).filter(Boolean);
  const T = s => s.split("|");
  // real-world inspired name lists: m = male, f = female, s = surnames / bynames
  const LISTS = {
    medieval: {
      m: L("Aldric Ambrose Anselm Baldwin Bartholomew Benedict Bertram Cedric Conrad Edmund Edric Everard Fulk Gareth Geoffrey Gilbert Godfrey Hamon Hugh Humphrey Jasper Lambert Lionel Merek Osric Percival Ranulf Reginald Robert Roger Simon Theobald Tristan Walter William Wystan"),
      f: L("Adela Agnes Alice Alys Amice Beatrice Cecily Constance Edith Eleanor Elena Elise Emma Isabel Isolde Joan Juliana Lettice Mabel Margery Matilda Maud Millicent Muriel Petronilla Rosamund Sabina Sybil Agatha Gwendolyn Helewise Ida Avice Yvette"),
      s: L("Ashdown Blackwood Bramble Carter Cooper Crowley Fairfax Fletcher Godwin Hale Hawthorne Holloway Kemp Langley Marsh Mercer Miller Northcott Oakes Pembroke Ravenscroft Redgrave Shepherd Stanton Thatcher Underhill Waller Whitlock Woodward Wyatt"),
      t: T("the Bold|the Fair|the Younger|the Elder|of Ashford|of the Vale|the Lame|the Pious|Longshanks|Greycloak")
    },
    german: {
      m: L("Albrecht Anselm Bernhard Dietrich Eberhard Egon Ekkehard Friedrich Gottfried Gunther Hartmut Heinrich Helmut Hermann Hildebrand Konrad Kuno Leopold Lothar Ludwig Manfred Meinhard Otto Rudolf Ruprecht Siegfried Ulrich Volker Walther Wendelin Wilhelm Wolfram Matthias Klaus Jakob"),
      f: L("Adelheid Agathe Anneliese Brunhild Elsbeth Elfriede Gertrud Gisela Greta Hedwig Hildegard Ilse Irmgard Kunigunde Liesel Lotte Margarete Mechthild Ottilie Roswitha Sieglinde Ursula Walburga Wiebke Wilhelmina Friederike Kathrin Magda Johanna Clara"),
      s: L("Altmann Baumgart Brenner Eisenhardt Falkenberg Fischer Hartmann Hoffmann Jäger Kessler Krämer Lang Lindner Messner Müller Neumann Pfeiffer Richter Rotfuchs Schäfer Schmied Schwarzwald Steinbach Vogt Wagner Weber Wolfsberg Zimmermann Grünwald Hammerstein"),
      t: T("von Eichenau|von Rabenstein|der Rote|der Ältere|von Falkenhain|vom Moor")
    },
    scandinavian: {
      m: L("Arne Asger Bjorn Brand Dag Einar Eirik Erland Finn Gorm Gunnar Halfdan Harald Hakon Ivar Ketil Knut Leif Magnus Olaf Orm Ragnar Rolf Sigurd Snorri Steinar Sven Thorvald Torsten Ulf Vidar Yngvar Hrolf Egil Sten"),
      f: L("Alfhild Astrid Asa Bergljot Brynhild Dagny Eira Freydis Frida Gudrun Gunnhild Gyda Halla Helga Hild Ingrid Ingunn Kari Liv Ragna Ragnhild Runa Sigrid Signy Solveig Svanhild Thora Thyra Tove Unn Vigdis Yrsa Embla Revna"),
      s: L("Ironside Bloodaxe Fairhair Forkbeard Halfhand Ravenwing Stormborn Wolfsbane Grimsson Haraldsson Olafsdottir Sigurdsson Bjornsson Eiriksdottir Thorsdottir Ulfsson Snowbeard Longship Frostmane Skullsplitter"),
      t: T("the Wanderer|the Skald|the Unready|the Boneless|of the Fjord")
    },
    french: {
      m: L("Achille Alain Amaury Armand Arnaud Aymeric Bertrand Clément Denis Enguerrand Étienne Gaspard Gaston Gauthier Guillaume Henri Hugues Jacques Jean Lancelot Louis Lucien Mathieu Olivier Philippe Raoul Renaud Roland Thibault Tristan Yves"),
      f: L("Adèle Aliénor Amélie Anne Aude Béatrice Blanche Céleste Clémence Colette Éloïse Esmée Geneviève Héloïse Isabeau Jeanne Josette Louise Margot Marguerite Mélisande Odette Perrine Sidonie Solène Vivienne Yolande"),
      s: L("Beaumont Bellerose Boucher Chastain Delacroix Dubois Duval Fontaine Lacroix Lafleur Leclerc Marchand Montclair Moreau Rochefort Sauvage Valois Vautrin Verdier Lefèvre"),
      t: T("de Montfort|le Bel|le Hardi|de la Tour")
    },
    celtic: {
      m: L("Aedan Aodh Bran Brennus Cathal Ciaran Conall Conan Cormac Declan Diarmuid Donal Eamon Fergus Finnian Lorcan Niall Oisin Owain Padraig Rhodri Ronan Taliesin Tadhg Bryn Cadoc Emrys Gwydion Morcant"),
      f: L("Aine Aisling Brigid Caitlin Ceridwen Deirdre Eithne Enid Fionnuala Grainne Gwenllian Isolt Maeve Moira Morrigan Muirne Niamh Nuala Orla Rhiannon Saoirse Siobhan Tegan Una Branwen Eluned Mairead"),
      s: L("MacAllister MacBride O'Byrne O'Connell MacDuff Ap Rhys Ap Gwyn O'Neill MacCormac MacFinn O'Dowd Ap Owain Blackthorn Greenbough"),
      t: T("of the Mists|the Druid|mac Lir|of the Hollow Hill")
    },
    slavic: {
      m: L("Bogdan Borislav Bronislav Casimir Dobromir Dragan Gorazd Igor Jaromir Ladislav Lubomir Milan Miroslav Mstislav Radoslav Rostislav Stanislav Svyatoslav Vadim Vladimir Vojtech Yaroslav Zbigniew Zoran Boris Dmitri"),
      f: L("Bogdana Bozena Dobrava Dragana Jadwiga Jarmila Kasia Lada Ludmila Milena Miroslava Nadia Olga Radka Snezhana Svetlana Vesna Vlasta Yelena Zlata Zora Zoria Desislava Mila"),
      s: L("Volkov Sokolov Kozlov Morozov Belov Novak Kowalski Dvorak Zelenko Voronov Medvedev Orlov Lebedev Chernov Gorski"),
      t: T("the Grey|Ironhand|of Kiev|the Wolf")
    },
    arabic: {
      m: L("Amir Anwar Bashir Faris Farid Hakim Hamid Harun Idris Ishaq Jabir Jamal Karim Khalid Malik Mansur Nasir Omar Qasim Rashid Salim Samir Tariq Yazid Yusuf Zahir"),
      f: L("Amira Aziza Basma Dalia Farah Fatima Habiba Hana Jamila Layla Leila Maryam Nadira Najwa Noor Rania Salma Samira Soraya Yasmin Zahra Zainab Zaynab"),
      s: L("al-Rashid ibn-Tariq al-Hakim ibn-Yusuf al-Qasim bint-Malik al-Zahir ibn-Harun al-Mansur ibn-Faris"),
      t: T("the Wise|of the Seven Sands|the Merchant")
    }
  };
  // fantasy: syllable based
  const SYL = {
    fantasy: { a: L("Ar Bel Cal Dor El Fen Gal Har Is Jor Kel Lor Mar Nor Or Per Quin Ral Sar Tor Ul Val Wyn Xan Yor Zel Ae Bri Cor Dra Eth Fal"),
      b: L("a an ar ia en el in or wyn ric dan las mir ros thas vin"),
      m: L("ric dor rin gar mund dan los thar vek ion"), f: L("ra lia na wen ith elle ys ara iel ine"),
      s: L("Starfall Duskbane Silverleaf Thornfield Brightwater Ashenvale Stormwind Moonshadow Embermane Frostwhisper Goldvein Nightbloom Shadowmere Swiftbrook Highcastle") },
    elvish: { a: L("Ael Ara Cael Ela Elen Fae Gala Ilu Ith Lae Lia Mae Nae Rae Sae Sil Tha Vae Yll Aes Eru Fin Gil Lor"),
      b: L("dri lan ren ria tha the vin wy sel nor ion"),
      m: L("ndil thir rion las dor ion vain ren"), f: L("wen riel thiel lia nis ra iel ys"),
      s: L("Amakiir Galanodel Holimion Ilphelkiir Liadon Meliamne Nailo Siannodel Xiloscient Moonwhisper Leafsong Silverfrond Starbloom Evenwood") },
    dwarvish: { a: L("Bal Bar Bor Bru Dag Dur Dwa Far Gim Gor Gru Har Kil Mor Nor Rur Thor Thra Ul Vond Hel Eb Bel"),
      b: L("a i o u ur ar"),
      m: L("din grim nar rin dok gar mund li ni rak"), f: L("dis da hild ra gun wynn lin ja"),
      s: L("Ironfist Battlehammer Stonehelm Fireforge Deepdelver Gemcutter Brawnanvil Frostbeard Coppervein Granitejaw Holderhek Ungart Rumnaheim Torunn Balderk") },
    halfling: { a: L("Al Ce Cor Dan Ed Fin Gar Lin Mer Mil Os Per Ros Sam Tob Wel An Bel Kith Lav Ver"),
      b: L("o i e a"),
      m: L("do ric bo by wick ton rin fred"), f: L("ly ra sy ie bell na dra mae"),
      s: L("Brushgather Goodbarrel Greenbottle Highhill Hilltopple Leagallow Tealeaf Thorngage Tosscobble Underbough Applebrook Butterfoot") },
    orcish: { a: L("Gr Kr Th Ur Dr Br Sk Zug Mog Gor Rok Vor Hag Nar Shag Grul Yev Ug"),
      b: L("a o u ag ug ar ok"),
      m: L("ash gash nak mog thar rok grul zug dak"), f: L("ga ka sha tha gra vola yena"),
      s: L("Skullcrusher Bonegnaw Bloodfang Ironjaw Tuskbreaker Ashmaw Gutripper Blackhand Doomhowl Grimtooth") },
    tiefling: { a: L("Ak Am Bar Dam Ek Ia Kal Kair Mor Mak Nem Ori Riel Sky Zer Ani Bri Ler"),
      b: L("a e i o"),
      m: L("menos kos ro tos mon mos us ekar"), f: L("kis ria nadra lis bis zia ta ka"),
      s: L("Ash|Carrion|Chant|Despair|Glory|Hope|Ideal|Music|Nowhere|Open|Poetry|Quest|Random|Reverence|Sorrow|Torment|Weary".replace(/\|/g, " ")) }
  };
  const STYLES = [["medieval", "Medieval"], ["german", "German"], ["scandinavian", "Scandinavian"], ["french", "French"], ["celtic", "Celtic"], ["slavic", "Slavic"], ["arabic", "Desert / Arabic"],
    ["fantasy", "Fantasy"], ["elvish", "Elvish"], ["dwarvish", "Dwarvish"], ["halfling", "Halfling"], ["orcish", "Orcish"], ["tiefling", "Tiefling"]];
  const GENDERS = [["m", "Male"], ["f", "Female"]];
  const EXTRAS = [["surname", "+ surname"], ["title", "+ title / epithet"]];
  const rnd = n => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
  const pick = a => a[rnd(a.length)];
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function first(style, g) {
    if (LISTS[style]) return pick(LISTS[style][g]);
    const y = SYL[style]; let n = pick(y.a);
    if (rnd(3) === 0) n += pick(y.b);
    n += pick(y[g]);
    return cap(n.replace(/(.)\1\1/g, "$1$1"));
  }
  function last(style, g) {   // no "-son" names for women, no "-dottir" for men
    const all = LISTS[style] ? LISTS[style].s : SYL[style].s;
    const ok = all.filter(x => g === "f" ? !/sson$|^ibn-/.test(x) : !/dott?ir$|^bint-/.test(x));
    return pick(ok.length ? ok : all); }
  function title(style, g) { const t = LISTS[style]?.t; return t ? (g === "f" ? pick(t).replace(/^der /, "die ") : pick(t)) : pick(["the Bold", "the Wise", "the Silent", "of the North", "the Wanderer", "Oathkeeper"]); }
  // tags: array of style keys, gender keys and extras; empty style list = all human-ish styles
  function generate(tags, count = 6) {
    const styles = STYLES.map(s => s[0]).filter(k => tags.includes(k));
    const genders = GENDERS.map(g => g[0]).filter(k => tags.includes(k));
    const st = styles.length ? styles : ["medieval", "german", "scandinavian", "fantasy"], gs = genders.length ? genders : ["m", "f"];
    const out = new Set(); let guard = 0;
    while (out.size < count && guard++ < 200) {
      const s = pick(st), g = pick(gs);
      let n = first(s, g);
      if (tags.includes("surname")) n += " " + last(s, g);
      if (tags.includes("title")) n += " " + title(s, g);
      out.add(n);
    }
    return [...out];
  }
  return { STYLES, GENDERS, EXTRAS, generate };
})();
