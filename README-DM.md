# D&D DM Tool

A separate app for preparing and running adventures: scenarios, a dungeon map with numbered nodes, battlemaps with a grid and tokens, a monster compendium, and secrets & clues.
Battlemaps can be **shared live with your players' phones over Wi-Fi, without internet**.

## Setup (one time)

You need Python plus the two packages you already installed for the character builder:

```
pip install requests beautifulsoup4
```

## Start

- **Windows:** double-click `start-dm.bat`. **PyCharm:** right-click `dm.py` → Run.
- The DM screen opens at **http://localhost:8766**. Keep the program running while you play.
- The first time you start it, Windows asks whether Python may use the network. Allow **Private networks** so players can connect.

## Monster compendium

On the start page, click **Import monsters from aidedd.org** (needs internet once, takes a few minutes; tick "also 2014 monsters" for the older ones too).
Pages are cached in `data/mcache`, so later updates are quick. Everything stays on your PC.
You can always add **custom monsters** by hand, or paste their stat block.

Stat blocks are shown the way aidedd.org shows them, with the creature picture. Pictures are downloaded the first time you open a monster and then stored in `data/mimg`. To get all of them at once for offline play, tick **download all images now** before you click Update. If an older import shows messy stat blocks, just click **Update monsters** again: the cached pages are re-read in a few seconds.

If stat blocks look wrong after the import, run `python monster_importer.py --test https://www.aidedd.org/monster/goblin-warrior` and send the output to Claude.

## On your phone (prepare on the go)

The DM Tool also runs as an app on your phone, from its GitHub Pages site: `https://YOUR-USERNAME.github.io/DM-Tool/` (see *GitHub repo* below).
- **Install it:** open that address in Chrome on the phone, then use ⋮ → **Add to Home screen** / **Install app**.
- **Storage:** everything is saved on the phone, so it works without internet.
- **Google Drive sync:** tap **☁ Connect Google Drive** (start page → *Devices & sync*) on the phone **and** on the laptop. Scenarios, the world map and the monster compendium then sync both ways; the newest version wins, and deleting a scenario deletes it everywhere. Drive sync can use the same Google Client ID as the Character Builder: put it into `docs/config.js` on GitHub.
- **Laptop setup, once:** for the laptop app, add `http://localhost:8766` to **Authorized JavaScript origins** in Google Cloud → Credentials → your OAuth client. Then paste the Client ID into the box on the laptop's start page.
- **Monsters:** the import from aidedd.org only runs on the laptop; Drive sync brings the monsters to the phone. Monster pictures load from aidedd.org when the phone is online, and are kept for offline use after that.
- **Laptop only:** sharing a battlemap with players (📡) needs the laptop.
- **Without Drive:** **⤓ Backup everything** saves one file with your scenarios, the world map and the monsters. Open it with **⤒ Import** on the other device. Only newer versions replace what's already there, so importing an old backup can't undo newer work. Deleting a scenario does *not* carry over this way; delete it on both devices.

## World map

The start page has a **🌍 World map** under your scenarios.
- Add a map of your world, click **➕ Place nodes**, and click on the map to add cities, dungeons, regions, quest hooks and so on.
- In the node list, link a node to a scenario under **Scenario here**. Clicking that node on the map then shows the scenario with an **Open scenario →** button.
- The world is saved in `scenarios/_world.json`.

## Reading nodes on the map

Click a node on any map (world or scenario) and its description opens right there, next to the node, including the encounter, its difficulty and the NPCs. **✎ Edit in list** jumps to that node in the list below the map. Click the **Nodes** heading to fold the list away.

## Preparing a scenario

1. **Start page:** type a name (e.g. *Dwarven Forge*), then click **+ New scenario**. Under the title, add a **subtitle** (one or two sentences, shown on the start page) and, if you like, a fold-out **📖 Synopsis**. At the top of the scenario, set **Party: players and level**. The difficulty uses the DMG XP thresholds and group multipliers, like donjon's Encounter Size Calculator (fewer than 3 players count one step harder, 6 or more one step easier).
2. **Overview & nodes:** add your dungeon map image.
   - Click **➕ Place nodes**, then click on the map. Each click adds a numbered node.
   - Open a node in the list below the map to fill it in:
     - a title (e.g. *Throne room*)
     - a type (room, encounter, trap, secret, clue, treasure, NPC)
     - your description
     - the **encounter**: pick monsters from the scenario's list and set how many with − / +. A badge shows the difficulty (Trivial, Easy, Medium, Hard, Deadly) for your party.
     - a linked battlemap
   - Drag nodes to move them.
3. **Battlemaps:** add a map image for each room or encounter.
   - Type how many **cells across** and **down** the map has. **square cells** works out the second number for you.
   - Nudge the grid with **Shift x / y** if it doesn't line up with the drawn grid.
   - Add player tokens and monster tokens. Monster tokens get their HP and size from the stat block, and start **hidden 🙈** from players.
   - If a node uses this battlemap, **+ Add encounter of #n** puts all of that encounter's monsters on the map in one go.
4. **Monsters:**
   - Search the compendium and click **+ Add**. Filter by **type** (tap several: Fiend, Fey, Monstrosity…) and **sort** by CR. Add each kind of monster **once**; how many show up where is set per node.
   - Put monsters into **groups** (e.g. *Forge guards*), add them to nodes, and add your notes. The list shows where each monster is used (#3 ×4).
   - Tap any dice in a stat block (🎲+4, 🎲2d6 + 3) to roll.
5. **NPCs:** **🎲 Random names** suggests six names. Pick any mix of tags (Medieval, German, Scandinavian, Elvish, Dwarvish… plus Male/Female, surname, epithet), then click a name to add that NPC.
    add an NPC with a name, picture, role, where to find them, and notes. Anywhere you write their name (or an alias such as *the forge master*) in a node description or the notes, it becomes a link. Tap it to see their card.
6. **Secrets & notes:** keep a checklist of secrets and clues (tick them off when discovered), plus free notes.

Scenarios are saved automatically on the device and, on the laptop, in `scenarios/` (the previous version goes to `scenarios/backup`). **⤓ Export** saves the whole scenario, images included, as one file you can back up or give to another DM (**⤒ Import** on the start page).

## Playing: share a battlemap with the players

1. Put everyone on the **same network**. No internet is needed:
   - the laptop and phones on the same Wi-Fi, **or**
   - turn on a **phone's hotspot** (works without mobile data) and connect the laptop and all phones to it, **or**
   - the laptop's own **mobile hotspot** (Windows: Settings → Network & internet → Mobile hotspot).
2. Open the battlemap and press **📡 Share with players**. A QR code appears.
3. Players scan it with their phone camera. The map opens in their browser.
4. Everyone can **drag tokens**. Moves show up on all screens within about a second.
5. Reveal monsters with **👁** when the players see them. Track monster HP with − / +.
6. Switch to another battlemap and press Share again; the players' screens follow. **■ Stop sharing** ends it.

If you have several networks, the QR window lets you pick the right address. The laptop hotspot is usually `192.168.137.1`.

Why the shared map opens in the browser instead of the character builder app: the builder is a secure (https) website, and browsers don't let those talk to a laptop on the local network. The table page is served directly by your laptop instead, which is also what makes it work offline. It runs in any phone browser, with nothing to install.

## GitHub repo (phone app + updates)

This whole folder is its own GitHub repository, e.g. `DM-Tool`. Your `scenarios` and `data` folders are never uploaded (see `.gitignore`): they hold your own adventures and the aidedd texts.
- **First time:** create a new repository `DM-Tool` (public, so Pages works on a free account). Use **Add file → Upload files** to upload everything in this folder *except* `scenarios` and `data`. Then go to **Settings → Pages → Build and deployment**: Source *Deploy from a branch*, branch `main`, folder **`/docs`** → Save. After a minute the app is at `https://YOUR-USERNAME.github.io/DM-Tool/`.
- **Updates:** upload the changed files the same way (same names replace the old ones). To update the laptop, use **Code → Download ZIP** on the repo page and copy the files over your DM Tool folder; `scenarios` and `data` stay untouched.

## Files

| File | Contents |
|---|---|
| `dm.py` | local server (DM screen, player table, live sync) |
| `monster_importer.py` | aidedd.org monster downloader |
| `docs/` | the app (DM screen `index.html`, player page `table.html`), also published by GitHub Pages |
| `scenarios/` | your scenarios |
| `data/monsters.json` | imported monster compendium |
