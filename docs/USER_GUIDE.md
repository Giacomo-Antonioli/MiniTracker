# MiniTracker user guide

MiniTracker keeps track of your miniatures: what you own, what's painted, the paints and schemes you use, your armies and the games you play. It runs in your browser and keeps everything on your device. There's no account, and nothing goes to a server unless you sync two of your own devices or send someone a link.

This guide follows the app's menu from top to bottom. You don't need to read it in order; jump to the page you're on.

- [Getting started](#getting-started)
- [Home](#home)
- [Backlog](#backlog)
- [Armies](#armies)
- [Catalogue and Rules](#catalogue-and-rules)
- [Paints](#paints)
- [Storage and labels](#storage-and-labels)
- [Workshop: tools and supplies](#workshop-tools-and-supplies)
- [Schemes](#schemes)
- [Guides](#guides)
- [Shopping](#shopping)
- [Companion and painting time](#companion-and-painting-time)
- [Stats and sharing your collection](#stats-and-sharing-your-collection)
- [Goals](#goals)
- [Games](#games)
- [Sync between devices](#sync-between-devices)
- [Settings and backups](#settings-and-backups)
- [On a phone](#on-a-phone)
- [Troubleshooting](#troubleshooting)

---

## Getting started

Open the app at **https://giacomo-antonioli.github.io/MiniTracker/**. In Chrome, Edge or Safari you can install it ("Install app" in the address bar, or *Share › Add to Home Screen* on an iPhone). Once installed it works offline.

A good first half hour looks like this:

1. **Download a catalogue.** Go to **⚙ Settings › Catalogue data** and download the game you play: Warhammer 40,000 (11th or 10th edition), Age of Sigmar 4th edition, Kill Team (2024) or Middle-earth Strategy Battle Game (2024). Your browser fetches the data from the community [BSData](https://github.com/BSData) project (Middle-earth from the [MESBG list builder](https://github.com/mhollink/mesbg-list-builder-v2024)) and converts it on your device, which takes a minute. You can install several and switch with **Use this edition**; the active one is used by the Catalogue, the Backlog and new army lists. With two or more games installed, a **Game** picker appears under the MiniTracker name in the menu: pick one game to see only its units and lists on Home, Backlog, Stats and Armies (this also makes it the active catalogue), or **All games** to see everything.
2. **Add a few units.** On the **Backlog**, press **+ Add unit**, pick the faction and the unit, and say how many models are at which stage. You can add a unit by hand too, without the catalogue.
3. **Make a backup.** **Settings › Backup** saves everything in one file. Your data lives in this browser only; clearing the browser's site data deletes it, so keep a backup somewhere else.

The theme (*Grimdark* or *Forum 2005*) is in **Settings › Appearance**.

## Home

The start page. It shows how many models you painted this month, your weekly streak, the size of the pile, whether the pile is shrinking this year, and an estimate of when you'll finish at your current pace.

Below that come cards: the units you worked on last (with a quick move to the next stage), a year activity calendar, records, the oldest units in the pile, your goals, recent games, painting timers, the shopping list and things running low. **✎ Customise** lets you reorder, resize, add or remove cards.

The painting timer lives here too; see [Companion and painting time](#companion-and-painting-time).

## Backlog

Your collection. Each **unit** holds one or more **groups** of models, so "6 built + 4 painted" is one unit with two groups. Each group can have its own loadout and magnetised weapon slots.

**Stages.** Models move through your painting pipeline: Wishlisted → On sprue → Built → Primed → Basecoated → Painted → Based → Varnished. You can rename, reorder or add stages in **Settings › Pipelines**. *Wishlisted* is special: those are models you don't own yet, so they don't count as owned in army lists or in painting progress, and they sit on the shopping list automatically.

**Moving models.** Each row has a quick move: one model, a number, or all of a stage, to the next stage or any stage you pick. The full **Move** dialog adds a date, a note and a photo. Every move goes into the unit's history.

**Table or board.** The **Table | Board** switch at the top changes the view. The table groups entries of the same unit type, sorts on any column (click the header) and lets you hide columns. The board has one column per stage and one card per group of models; drag a card to another stage or use its **Move…** menu.

**Unit details.** Click a row to open the side panel; double-click (or **⤢ Open page**) for the full unit page. There you'll find:

- photos, as a grid or a **Timeline** that shows the unit going from bare plastic to finished;
- the datasheet: stats, weapons, abilities, rules and keywords;
- the paint scheme, with any paints from it you don't own (**Add missing paints to shopping list…**);
- price paid, tags, notes, links, and the unit's storage place and label codes.

**📷 Scan box** reads the barcode on a kit box. If MiniTracker doesn't know the box it looks it up online; tell it once what's inside and it remembers.

**⚔ Spearhead box** (with Age of Sigmar installed) adds a whole Age of Sigmar Spearhead army at once. Pick the faction and the army; the dialog lists the general and units with their model counts, how many you already own, and, where a unit has several builds (e.g. Kurnoth Hunters with greatbows or scythes), which one you made. Choose **Add as** Wishlisted or a painting stage, then add. The units are tagged *Spearhead* and the army name. **Rules (PDF)** opens the army's free rules on Warhammer Community.

## Armies

Army lists, built from the units in the active catalogue.

Press **+ New list**, pick the edition (or game), battle size and faction. The builder shows legal units on the left, grouped by role; by default only units you own, tick **Not owned** to see all of them. Add a unit with **+**, a double-click, or by dragging it to the right-hand column.

For 40k the builder handles detachments, enhancements, one Warlord (★, Characters only), Leaders attached to the units they can lead, and wargear loadouts per model (open a unit's details with ▸). **Rule checks** at the bottom flag problems: points, unit copies, detachment points, enhancements, Leaders, unit sizes. Hover a warning for the rule behind it. A list with problems can still be saved; nothing is enforced.

Each unit shows whether you own it fully, partly or not at all, and how much of it is painted. Link a list unit to a specific unit of your collection if you have several.

Useful buttons in the list header:

- **📄 Army PDF**: roster, datasheet cards and a legend of every rule and keyword; stratagem cards if you imported them (see Settings › Catalogue data).
- **Buy list**: models and scheme paints you still need, as text, PDF or straight onto the shopping list.
- **🧳 Pick list**: which storage places to open, in what order, to pack the army; **🧳 Pack … into** a case and **Put back** move the units for you.
- **⬇ Export**: text, a MiniTracker `.json` file, or **📱 Show as QR**, which plays the list as a loop of QR codes for your opponent's phone to read.

**⬆ Import** on the Armies page reads BattleScribe / New Recruit rosters (`.rosz`, `.ros`), text lists from the GW app or New Recruit, and MiniTracker files.

Age of Sigmar, Kill Team and Middle-earth lists work the same way with points and units, but without the 40k-only parts (detachments, Combat Patrol).

## Catalogue and Rules

**Catalogue** lists every unit of the active game with role, size, points, stats, weapons, abilities and keywords. Filter by faction or role, show only what you own, and add a unit to your collection from here.

**Rules** has every core and faction rule with its text and the units that have it. Rule names in datasheets ("Deep Strike", "Sustained Hits 1"…) explain themselves; **Settings › Appearance › Rule explanations** chooses whether those explanations are folded, always open, or shown on hover.

## Paints

About 2,200 paints from Citadel, Army Painter, Vallejo, AK Interactive, Green Stuff World, Scale75 and Pro Acryl, each with a swatch. Search by name or filter by brand, type, colour and stage.

Your **inventory** sits on the same page: stage (wishlist, ordered, sealed, in use, running low, empty), number of pots, price, shop, where it's kept, rating and notes. Marking a paint *Running low* puts it on the shopping list. Custom paints, with your own colour, are allowed, and the inventory imports and exports as CSV.

Each paint shows the closest paints you own and the closest in every brand. **Match a colour** does the same for any colour you pick. **Paints to buy** takes a set of schemes and prints the paints they use that you don't have.

## Storage and labels

Where your miniatures physically are. Make one or more **storages** (home, club locker), each with nested **places**: a shelf, drawer, box, bag, case, tray or desk, with slots if you want them.

Every unit can have a home place and slot. You can **check out** a unit to a carry case or your desk and **put it back** later; the moves log keeps track. On a place page, **📦 Move contents…** moves several things at once, and **↦ Move this place** puts a whole box on another shelf with everything inside. From the Backlog, **📦 Store shown units…** gives the filtered units one home.

**Codes and labels.** Units and places get short codes (U-001, B-01); a unit with several models gets one per model (U-001-1, U-001-2…). Print QR stickers, box labels listing the contents, or a stencil sheet (print, or SVG for a cutting machine). Scanning a code with the in-app scanner, or with any phone camera, opens the unit or place. **Find code** works if you'd rather type it.

## Workshop: tools and supplies

**Tools** (airbrush, clippers, lamp…) and **supplies** (primer, glue, brushes…) share one Workshop tab; the ▸ next to it opens each on its own.

Both take a brand, category, storage place, bought date, price and notes. Supplies have stock with an alert level; liquids (primer, glue, varnish…) have a 💧 level instead: Full, Half, Running low, Empty. Reaching the alert level, or running low, adds the item to the shopping list. Tools can have repeating maintenance jobs, like a deep clean every 14 days, and the menu shows a ⚠ count when something is due.

Categories, and which supply categories count as liquids, are in **Settings › Workshop**.

## Schemes

Paint schemes, yours and other people's. A scheme has areas (armour, cloth, base…), and each area has ordered steps with a technique, paints with mix ratios, notes, video links and photos.

The **library** holds around 600 community recipes for 40k factions (plus some Necromunda and Blackstone Fortress), credited to their sources: Paint Pad, 'Eavy Archive and others. Library schemes are read-only; **Save a copy** or **Make my variant** to make them yours. A variant remembers its original and shows which paints you added or dropped.

Every scheme starts with a **Before you start** box: painting order, techniques used (each opens its guide), paint count and difficulty. **Print / PDF** gives you a recipe card.

To bring in a recipe from the web, **Add from link** drafts a scheme from a page, or install the **Send to MiniTracker** bookmarklet and press it while reading any recipe. **🔗 Share link** packs a scheme into a link anyone can open to import it (no photos).

A unit's scheme picker shows only schemes that fit it, and you can set a default scheme per faction.

## Guides

How-to guides with diagrams, written for MiniTracker from published guides (all credited):

- **Techniques**: 19 of them, from basecoating to edge highlighting, with method, brush, thinning, common mistakes and tips. Techniques in scheme steps link here.
- **Bases**: how to base, about 100 basing recipes by terrain type, and basing materials with **+ Add to Supplies**.
- **Terrain**: how to paint and build terrain, terrain recipes, and beginner projects.

## Shopping

One main list of everything to buy, plus your own lists (say, one per shop). Things land on it from many places: an army's buy list, paints missing from a scheme, Wishlisted models, paints and supplies running low. You can also search the whole catalogue from here and add units or paints you don't own yet.

Set quantity, shop and price. Ticking a kit **bought** moves its models into your collection. **📷 Scan box** in a shop ticks off the box you're holding.

## Companion and painting time

**Painting time.** Start a timer on Home for one unit or a batch of model groups. Pause and resume as you like, even across days. **Stop** logs the time, split between the groups by number of models. You can add or fix sessions by hand. Stats shows hours per month, army, unit and stage.

**Companion.** A screen for the painting desk, opened from the Companion tab, a unit page, a Backlog row or a timer. The **Painter** companion walks through the unit's scheme as a checklist in painting order, with paints and technique tips. The **Builder** companion covers assembly. Both have the unit's timer, **Done → next stage** (which also logs the time), progress photos and notes.

## Stats and sharing your collection

**Stats** goes deep: models painted per month or week, pile in versus pile out, pile age and the oldest unpainted units, points painted over time, time per stage, progress by faction and role, records, spending and the collection's value painted versus unpainted (set prices and purchases on units and in **+ Purchase**), paint usage, painting time and game results. Filter by faction and time range at the top.

**🔗 Share** on Stats makes a read-only link to your collection: units, factions and how many models are at each stage, with progress bars overall and per faction. Pick factions and whether to include the wishlist, then copy or share the link. The data travels inside the link itself, so nothing is uploaded, and photos aren't included. The link shows the collection as it was when you made it; make a new one later to show progress. Whoever opens it sees the page without anything being saved on their device.

## Goals

Set targets and watch the bars: paint N models a week, month or year; finish chosen units, optionally by a date; shrink the pile (paint more than you add); keep a weekly streak. Recurring goals mark past periods as hit or missed. The Home page has a Goals card.

## Games

Score keeping for games you play, from the first dice roll to the history.

**▶ New game.** Pick your army list (or none), the opponent's name and faction, and optionally their list, which can come from:

- **📄 File**: a `.rosz`, `.ros`, `.json` or text list;
- **📷 Read QR**: point the camera at their phone while it plays **⬇ Export › 📱 Show as QR** from their list;
- **One of my lists…**: one of your own lists, copied into the game (handy for proxy or practice games).

For 40k, the mission panel uses the Chapter Approved 2026-27 cards. Pick or 🎲 draw each player's **Force Disposition** and both Primary Missions fill in; draw a **Deployment** and an optional **Twist** the same way. Only card names are included, not their rules, and you can type anything instead. Other games get plain mission and deployment fields.

**Who goes first:** **🎲 Roll off** rolls one 3D die each (red for you, blue for them) and rolls again on a tie; **🪙 Coin flip** flips a coin against your call. The winner chooses who starts.

**Live game.** Primary and secondary points per round, CP for both players, rounds and turns, units destroyed on both sides, and photos of the table (**📷 Add**). **End game** saves it with notes, or discards it.

**📱 Companion** is the phone screen for the game itself: the phase bar, the stratagems you can use right now (with **Use** to spend the CP), the abilities that apply in this phase and turn, wounds per model (each model with its own wounds, so a sergeant or leader counts right), a chess clock and the game's photos. Stratagems need Wahapedia's files, imported once in Settings › Catalogue data.

**🎲 Dice**, on the live game and in the companion, rolls a whole attack with 3D dice:

1. **Hits**: number of dice and the target (3+), then **Roll**. **Re-roll 1s** or **Re-roll fails** if a rule lets you.
2. **Wound roll with N ▶** carries the hits over. Use **S vs T** for 40k, or **Fixed** ("Wound on 4+") for Age of Sigmar and similar.
3. **Saves for N ▶**: the target's Save, AP or Rend, and an invulnerable save if it has one. If no save is possible it tells you so.

A summary line follows the attack ("8 hits → 5 wounds → 2 unsaved"). Untick **3D** for instant rolls; it starts off if your device asks for reduced motion. The first time you open it the 3D engine takes a moment to load.

The history below shows past games, with results per list and per opponent faction.

## Sync between devices

**⇄ Sync** (bottom of the menu) copies data between your own devices, say a PC and a phone. Choose both ways, send only or receive only; merge (the newest change wins) or overwrite; with or without deletions and photos. Both devices see a preview of the changes before anything happens.

There are several ways to connect, depending on your network:

- **Pair with a code**, its QR or a pairing link. The data goes directly between the two devices, encrypted. Devices you synced with before get **⇄ Sync now** and find each other while Sync is open on both.
- **Private mode**, with no relay at all: copy or scan a connection text each way.
- **QR carousel**, with no network at all: **▶ Show QR carousel** on one device, **📷 Read QR carousel** on the other. It doesn't include photos. If frames get missed, choose *Simple* or slow it down.
- **Sync file**: save a file (optionally with photos) to a shared folder, USB stick or chat, and open it on the other device.

If two devices can't reach each other directly (some phone networks and office Wi-Fi block it), Sync says so after about 25 seconds and offers the other options. **Settings › Sync** has the device name, default choices and an optional TURN server for those networks.

## Settings and backups

Settings has tabs:

- **Catalogue data**: download, update or remove game catalogues; import catalogue files by hand; import Wahapedia stratagem files.
- **Appearance**: theme, rule explanations.
- **Pipelines**: the painting stages, plus the paint, scheme, storage and liquid-level pipelines.
- **Workshop**: tool and supply categories.
- **Sync**: see above.
- **Storage**: photo and browser storage use, and **Remove originals** to free space (keeps the compressed copies).
- **Backup**: save or restore everything.

**Backups** are one `.zip` file. *Light* keeps the compressed photos and stays small; *Full* also keeps the original photos. Restoring replaces all data on the device, so restore only onto a device whose data you don't need (or sync instead). Make one regularly and keep it off the device, in a cloud folder or on a USB stick.

## On a phone

Under 768 px wide the app switches layout: a top bar with ☰ menu and ⇄ Sync, and a bottom bar with Home, Backlog, Paints, Workshop and More. The Backlog shows cards, and unit pages and dialogs open full screen. The match companion and the dice roller are built for phone use at the table.

## Troubleshooting

**The catalogue won't download.** BSData lives on GitHub; if GitHub is blocked, download the repository as a zip on another machine and use **Import from files** in Settings › Catalogue data.

**My data is gone.** Data lives in this browser on this device. Another browser, a private window, or clearing site data shows an empty app. Restore your latest backup, or sync from another device.

**The 3D dice don't appear.** Your device may not support WebGL; the roller falls back to instant rolls by itself.

**Sync hangs or says the devices can't connect.** Use the QR carousel or a sync file instead, or set a TURN server in Settings › Sync.

**The QR reader doesn't pick up frames.** Turn up the sending screen's brightness, fill most of the camera view with the code, and choose *Simple* QR size or a slower speed.

Found a bug or want something? Open an issue on [GitHub](https://github.com/Giacomo-Antonioli/MiniTracker/issues).
