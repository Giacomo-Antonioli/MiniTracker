# Changelog

All notable changes to MiniTracker. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Desktop app: *Nearby devices* on the Sync page lists other MiniTracker apps on the same network, found automatically (no code to type). The first time, both screens show the same 6-digit number to confirm the pairing; after that a paired device syncs with one click (*⇄ Sync now*). The data still goes directly between the devices over the encrypted connection; the browser version keeps pairing codes and QR.

## [0.26.3] - 2026-11-07

### Fixed
- Desktop app: Print / PDF buttons do something on Windows again: they open the system print dialog (army and buy-list sheets, recipe cards, labels, storage, missing paints, shopping, Before you start).
- Desktop releases: the macOS update entry no longer goes missing from the update file.

## [0.26.2] - 2026-11-07

### Changed
- Welcome guide: steps 5–9 are guided tours of the whole app, drawn with driver.js and started by themselves: each page's controls are highlighted and explained in turn, across pages (Backlog, Paints, Schemes, Tools, Supplies, Storage, Armies, Games, Stats, Home, Catalogue, Rules, Shopping, Goals, Companion, Sync, Settings).
- The tours act things out for you: they add a unit (open the dialog, type the name, pick 5 models built, save, open it), search and open a paint, add a tool and a storage place, and run a game (set it up, start, score, next turn, end). All of it happens in a separate demo database: your own data is never touched and is back when the tour ends. Finishing a tour goes on to the next; *▶ Show me again* replays one; *Open…* buttons let you try a page yourself while the guide waits. The *Your data* choices are laid out more clearly. Enter or Space go to the next step, one at a time, in the guide and in the tours.

## [0.26.1] - 2026-11-07

### Added
- Welcome guide on first start: what MiniTracker does, download your games' catalogues, theme and text size, bring your data (sync, restore a backup or start fresh) and where things are. Skip it at any step; Settings › Appearance › Welcome guide › Show it again opens it later. Not shown to anyone who already has units.
- Desktop app: Settings › Appearance shows the installed version with *Check for updates*; the update banner has the release notes (*What's new*); the window title shows the version.
- Desktop app: only one copy runs at a time (opening it again brings the open window to the front), and the window remembers its size, position and maximised state.

### Fixed
- Desktop installers are built and attached to the release again (0.26.0 shipped without them).

## [0.26.0] - 2026-11-07

### Added
- Desktop app (#168, part 1): MiniTracker as an installable app for Windows (.msi/.exe), macOS (.dmg) and Linux (.deb/.AppImage), built with Tauri and attached to each GitHub release. It keeps its own data: on first start Home offers to sync from another device or restore a backup. Web links open in your browser, and share, pairing and QR links point to the web app so other devices can open them. The installers are not code-signed yet (see the release notes for how to open them). Automatic discovery of your other devices comes next.
- Desktop app updates itself: on start it checks GitHub releases for a newer version and offers *Install and restart*. Updates are signed with the project's update key and checked before installing. On Linux the AppImage updates itself; the .deb updates through apt.
- Text and interface size (Settings › Appearance): Auto by default, following the window (100% up to 1280 px wide, growing to 150% on big or maximised windows), or a fixed 80–150%, saved on the device; text and the layout grow together. In the desktop app Ctrl + / Ctrl − change it and Ctrl 0 goes back to Auto.

## [0.25.0] - 2026-11-07

### Added
- Middle-earth wargear options can be picked in the army builder (#99): heroes take any of their options, warriors one (shield, spear, bow, banner…), and each option's points are added per model to the unit and the list total. Download the Middle-earth catalogue again to get them.

## [0.24.0] - 2026-11-07

### Added
- Spearhead boxes (#99): ⚔ Spearhead box on the Backlog adds a whole Age of Sigmar Spearhead army (47 armies across 24 factions) to the backlog, wishlisted or at a painting stage. Units link to the Age of Sigmar catalogue where the names match; where a unit has several builds you pick yours. Shows how many of each you already own and links the army's rules PDF. The contents are read from Games Workshop's free Spearhead PDFs by `npm run spearhead:build`.

## [0.23.1] - 2026-11-07

### Fixed
- The game picker and the active catalogue stay in step: making an edition of another game active in Settings moves the picker to that game, and on start the picked game's catalogue is used.

## [0.23.0] - 2026-11-07

### Added
- Middle-earth Strategy Battle Game (2024 edition, #99): download it in Settings › Catalogue data. The data comes from the community MESBG list builder (BSData's Middle-earth data stopped before the 2024 edition): 106 army lists with points, stat lines (including Might/Will/Fate/Wounds), special rules, heroic actions, wargear and options. Heroes are single models, warriors are bought per model, unique heroes are limited to one.

## [0.22.0] - 2026-11-06

### Added
- User guide (docs/USER_GUIDE.md): every page of the app explained, linked from the README and from Settings.
- Other game systems (#99): Age of Sigmar 4th edition and Kill Team (2024) can be downloaded in Settings › Catalogue data next to 40k. Units come with points (Age of Sigmar), stat lines, weapons and abilities; lists, the backlog and the catalogue work with them. 40k-only parts (detachments, Combat Patrol, mission cards) are hidden for these games, and the dice roller's wound roll can be fixed (Wound on 4+) instead of S vs T.
- Necromunda and Blackstone Fortress schemes from 'Eavy Archive (#163): 9 more recipes in the scheme library.
- Share collection (#97): Stats › 🔗 Share makes a read-only link to your units and painting progress, overall and per faction. The data travels inside the link (no server, no photos); pick factions and whether to include the wishlist. Whoever opens it sees a snapshot, and nothing is saved on their device.

## [0.21.0] - 2026-11-06

### Added
- Mission cards (#194): on New game pick or 🎲 draw each player's Force Disposition and both Primary Missions fill in (Chapter Approved 2026-27 matrix); 🎲 draw a Deployment and an optional Twist. Card names only; you can still type any mission. The live game shows both missions, the deployment and the twist.
- Opponent's list (#193): on New game pick it from your own lists or 📷 Read QR from the opponent's device, where the list's ⬇ Export › 📱 Show as QR plays it as a QR carousel. Files still work.
- Who goes first (#192): 🎲 Roll off (one D6 each in your colours, ties roll again) or 🪙 Coin flip on New game; the winner chooses who goes first.
- Dice roller (#191): 🎲 Dice in the live game and the companion. 3D dice that tumble (dice-box), hits → wounds → saves with the wound table from S and T and the save from Sv, AP and invulnerable save, re-roll 1s or fails, and a summary of the attack. Turn 3D off for quick rolls; it is off when the device asks for reduced motion.
- Game photos (#164): 📷 Add photos to a game, live or from the companion; they show in the game's history too and are deleted with the game.

### Changed
- Companion abilities (#164) are sorted by what they do, not only by the phase they name: ranged attacks in Shooting, melee in Fight, charges, Battle-shock, Deep Strike. Your turn and the opponent's are kept apart, and the core and army rules on each datasheet are included.
- Companion wounds (#164) use each model's own stat line, so a leader or a model with a different W gets the right wounds.

## [0.20.0] - 2026-11-06

### Added
- Sync now (#161): while ⇄ Sync is open, devices you synced with before can reach this one without a code; each known device has a ⇄ Sync now button.

### Changed
- Sync says when two devices can't reach each other directly (failed or no connection within 25 s) instead of waiting, with buttons for the TURN setting, the QR carousel and the sync file.

## [0.19.0] - 2026-11-05

### Added
- QR carousel (#161): sync with no network at all. ▶ Show QR carousel loops this device's data (no photos, compressed) as QR codes; 📷 Read QR carousel on the other device collects them with the camera in any order, then shows the changes before applying. QR size and speed are adjustable.

## [0.18.0] - 2026-11-05

### Fixed
- Sync could hang at "Connected…" on a busy device: the connection now listens from the start, keeps messages that arrive early, and the opening hello is repeated until the other device confirms it.

### Added
- Phone layout (#31): under 768 px wide a top bar (☰ menu, ⇄ Sync) and a bottom bar (Home, Backlog, Paints, Workshop, More) replace the sidebar; the Backlog shows cards; unit and datasheet panels open full screen; dialogs and wide tables fit the screen; bigger tap targets and no zoom on iPhone when typing.
- Sync between devices (#161): ⇄ Sync pairs two devices by a short code, its QR or a pairing link (the data goes directly between them, encrypted), or in private mode with no relay by copying or scanning a connection text each way. Choose both ways, send or receive, merge (newest wins) or overwrite, deletions and photos; the other device accepts, and each side sees a preview of the changes before anything is saved. Progress, cancel, clock check, and a list of devices synced with (warning after 90 days).
- Sync file: save this device's data (optionally with photos) to a shared folder, USB stick or chat and open it on another device to merge or overwrite.
- Settings › Sync: device name, default choices, marking deletions for sync, an optional TURN server, and forgetting devices.

## [0.17.0] - 2026-11-05

### Added
- Liquid supplies (primer, glue, varnish, mediums…) show a 💧 level, Full → Half → Running low → Empty, instead of a condition; running low or empty puts them on the shopping list. The levels are a pipeline in Settings › Pipelines › Liquid level.
- Settings › Workshop: add, reorder and delete tool and supply categories, and mark which supply categories are liquids.

### Changed
- Settings: the sections are real tabs (one shown at a time, Catalogue data first). Each pipeline is a row that expands to show its stages.

## [0.16.0] - 2026-11-05

### Added
- Mass move: 📦 Move contents… on a place page moves the ticked units, tools and supplies to another place, for good (new home, slots kept where free, warning when full) or for now (check out). ↦ Move this place puts a box on another shelf or storage with everything inside. 📦 Store shown units… on the Backlog gives the filtered units one home. 📷 Scan into here moves each scanned unit or box sticker into the place.
- Workshop: one tab with tools and supplies together; ▸ next to it opens the separate Tools and Supplies pages. The nav shows low stock plus due maintenance (Workshop ⚠n).

### Changed
- Tools and supplies have the same options: brand, category, stock with an alert level (going low adds it to the shopping list), condition, storage place, bought date, price, notes, repeating maintenance jobs and a wishlist. Existing supplies keep their data.

## [0.15.0] - 2026-11-04

### Added
- Tools: a Tools tab for owned tools (airbrush, clippers, lamp…) with brand, category, condition, storage place, bought date, price and notes. Repeating maintenance jobs (e.g. deep clean every 14 days, with suggestions per category) show as due in the tab and in the nav (Tools ⚠n). A wishlist, plus worn or broken tools, can be sent to the shopping list. Saved in the backup.

### Changed
- Labels: a unit gets one code per model (U-001-1 … U-001-5) for stickers and stencils, and the unit page lists them; scanning or typing any of them opens the unit. Single-model units keep the plain code.

## [0.14.0] - 2026-11-03

### Added
- Box barcode scanner (#93): 📷 Scan box on Backlog, Shopping and Home (the Storage scanner reads barcodes too). Unknown boxes are looked up in Open Products Facts, with links to UPCitemdb and Barcode Spider; teach the app what's in the box once and it remembers. Known boxes show what you own, where it's stored, and tick it off the shopping list.

## [0.13.0] - 2026-11-03

### Added
- Storage (#18): a Storage tab with separate storages (home, club locker…) as tabs, nested places (shelf, drawer, box, bag, case, tray, desk; kinds editable in Settings) with slots and fill, and a page per place. Each unit has a home place and slot (bags can hold several units of one sprue), can be checked out to a case or the desk and put back, with a moves log and a storage status (Settings › Pipelines › Storage). The unit page has Details | Storage tabs.
- Army Pick list: which places to open in order and what to take, units not stored, Pack into a case and Put back.
- Codes and labels (#10): short codes (U-001, B-01), Find code and an in-app QR scanner; QR links open the unit or place. Print QR stickers, box labels with contents, or a stencil sheet (print or SVG for cutting machines); the code is shown big for writing under a base.

## [0.12.0] - 2026-11-03

### Added
- Backlog board (#91): a Table | Board switch on the Backlog. One column per painting stage (your custom stages too), one card per group of models, so a unit split across stages shows up in each. Drag a card to another stage, or use its "Move…" menu (works on touch); both open the usual Move dialog, so you can move only some models and add a date, note or photo. The view is remembered.
- Painting time (#89): start a timer on Home for one unit or a batch of model groups; pause and resume (paused timers are saved, also across days); Stop logs the time, split over the groups by number of minis. Add or edit sessions by hand. Stats › Painting time shows hours per month, by army, unit and stage.
- Companion tab: a Painter and a Builder companion per unit, opened from the tab, the unit page, Backlog rows, Kanban cards or a timer. Both have the unit's timers (switch between saved timers, Pick another unit pauses the running one), Done → next stage (also logs the time), progress photo and notes. Painter: scheme steps checklist in painting order with paints and technique tips. Builder: wargear and magnets checklist, build links and supplies with "Used one".

## [0.11.2] - 2026-11-03

### Added
- Guides › Terrain: Materials and Beginner projects (rubble piles, ruined walls, forest bases, modular ruins), terrain density per game, from Tista Minis' terrain guide (credited).

## [0.11.1] - 2026-11-03

### Added
- Guides › Terrain: "How to paint terrain" (prepare, prime, drybrush and shade, details and weathering, finish), plus a "Build and lay out" section, merged from seven published guides (credited), with three diagrams drawn for MiniTracker.
- Guides › Bases: "How to base miniatures" (plan, texture, paint, rim, finish), merged from four published guides, with diagrams.

## [0.11.0] - 2026-11-03

### Added
- Guides › Terrain: 15 terrain recipes (10 from 'Eavy Archive: Battlezone Mechanicus, Battle Sanctum, Boarding Actions; 5 written for MiniTracker: Imperial ruins, rusted metal, wood, sci-fi panels, ice crystals), filtered by surface.
- Guides › Bases › Materials: 12 basing materials (texture paste, sand, rocks/cork, static grass, tufts, flowers, flock, pigments, snow, water effects, PVA, super glue) with how-to, tips, mistakes and links to makers (Green Stuff World, Army Painter, Gamers Grass, Citadel, Vallejo and more). "+ Add to Supplies" on each. Base recipes list the materials they use.
- Paints: Green Stuff World (220), Scale75 (358) and Pro Acryl (131) from the MIT-licensed miniature-paints dataset, with range, type and colour family. Paint brands are listed in `tools/paints/sources.json`, so more can be added without code changes (#29). Scheme recipes using these brands now link to them.
- Technique guides in depth: each of the 19 techniques now has a step-by-step method and tips, merged from three published guides (credited and linked), and an explanatory diagram for every technique, drawn for MiniTracker. The scheme Print / PDF sheet ends with "How to" for every technique the recipe uses.
- Guides › Bases: 105 basing recipes (8 written for MiniTracker: snow, lava, urban rubble, desert, mud, Mars, grass, ash; 5 from 'Eavy Archive; the rest from base areas of library schemes), filtered by terrain type. In the scheme editor, "🪨 Add a base" / "Use a base recipe" copies a base into your scheme.
- "Before you start" in every scheme (library and your own, updating as you edit): painting order worked out from the area names, techniques used (each opens its guide), paint count, estimated difficulty, and a Print / PDF sheet with the recipe in painting order.
- Guides: a new page (also a tab in Schemes) with 19 technique guides (what, when, brush, thinning, mistakes, video search) and a Getting started guide. Techniques in recipe steps open their guide in a side panel.
- Scheme library: 125 more schemes from 'Eavy Archive (chapters, craftworlds, hive fleets and more), with mixes, ratios and notes kept. Library now has 598 schemes.

## [0.10.0] - 2026-11-03

### Added
- Scheme library grows from 43 T'au schemes to 473 community recipes for 28 Warhammer 40k factions (#57): the scraper now reads every faction listing on Paint Pad, tags sub-factions (chapters, craftworlds, hive fleets…) and unit types, and drops duplicate recipes.
- Home: a Goals card with progress bars (unfinished goals first; 3, 5 or 10 goals).

### Added
- Recipes (#95): video/tutorial links on each scheme step (shown in the scheme view and on the printed recipe card), step photos shown in the scheme view, and "🔗 Share link": the scheme packed into a link anyone can open to import it (no server, photos not included).
- Goals page (#90): paint N models per week/month/year, finish chosen units (with an optional due date), shrink the pile (paint more than you add) and weekly painting streaks; progress bars, and past periods marked hit or missed for recurring goals.

## [0.9.0] - 2026-11-03

### Added
- Closest colour match (CIEDE2000): closest paints you own and closest in any brand on each paint, a "Match a colour" picker for any hex colour, and the closest owned substitute for missing paints in schemes (#30).
- Magnet editor in the unit form: add, edit and remove magnet slots per model group, with options picked from the datasheet's wargear (#32).
- Cost tracking: price paid per unit, purchases (boxes, bundles) shared across units by model count, a currency setting, and a Costs section on Stats with total spent and collection value painted vs unpainted (#94).

### Changed
- Games: "Discard game" next to "Save game" when ending a game, and a delete button on every row of the game history.

### Fixed
- Stats charts no longer overflow their cards.

## [0.8.0] - 2026-11-03

### Added
- Match companion (#72): 📱 Companion on the live game opens a phone-friendly screen with the phase bar (Command → Fight, then the next turn), the stratagems you can use now (your detachments' and core, by turn and phase; Use spends the CP), detachment rules and unit abilities that mention the phase, your units with wounds tracked per model (a unit is destroyed when its last model dies), quick score buttons, CP, and a chess clock with total game time.
- Games (#71): start a game from an army list (or without one), with the opponent, their faction and optionally their list (.rosz, .ros, .json or text). Live score board: primary and secondary per round with +1/+5/−1, CP for both (+1 each at every turn), round and turn, units destroyed on both sides (ticked off their lists, or counted). End the game with notes; the history shows score by round, units lost and destroyed, and results overall, per list and per opponent faction. A Games card on Home, and each unit shows how many games it played and how often it was destroyed. The Stats page gets a Games section: played, win rate, average score, win streak, best list, results and average score over time, and wins by opponent faction and by list. The game saves after every tap.

## [0.7.0] - 2026-11-03

### Added
- Stratagem cards (#98): import Wahapedia's Stratagems.csv and Detachment_abilities.csv in Settings → Catalogue (links there; kept in your data and backups). The Army PDF can add the rules and stratagem cards of the list's detachments plus the core stratagems; a detachment whose name differs is picked once from a list. Powered by Wahapedia.
- Running low (#92): marking a paint "Running low" puts it on the shopping list. New Supplies page (primer, glue, brushes…) with stock and an alert level: reaching it flags the supply, adds it to the shopping list and shows a ⚠ count in the menu. A "Running low" card on Home lists both.
- Photo timeline per unit (#96): a Grid / Timeline switch in the unit's photos shows them by date, each with the stage it shows (its history step, or the stage reached by that day). The choice is remembered.

### Fixed
- Home no longer breaks when a unit has no valid creation date.

## [0.6.1] - 2026-11-03

### Changed
- Add to shopping list: when models and paints come together (an army's buy list), checkboxes let you add only the models or only the paints.
- One Warlord per army, and only a Character: ★ is disabled on other units, moves the Warlord to the unit you click (click again to clear), and until one is chosen the Characters' stars are highlighted with a hint above the list. Characters are starred in the Add units list too. Hovering a list warning explains the rule behind it.

### Added
- Print the whole army (📄 Army PDF in the list header, no paints): roster with points, Warlord, enhancements and leaders, plus datasheet cards. Owned and painted counts are added only if you tick them.
- Datasheet cards in the army PDF (#98): one card per unit type with points, stat lines, the ranged and melee weapons its loadout carries, core rules, abilities with their text and keywords, followed by a legend explaining every rule and weapon keyword on the cards (Deep Strike, Sustained Hits, Assault…). Checkboxes in the Make PDF dialog turn the models to buy, the scheme paints and the cards on or off. The buy list and the list's missing paints are now collapsible.

## [0.6.0] - 2026-11-02

### Added
- More stats: records (best month, week and day, longest streak, average days from Built to Painted), a year activity calendar, models moved into each stage, average time per stage, painted points over time, pile age with the oldest unpainted units, painted models by role, money spent from the shopping list, and the paints your units' schemes use most.
- Home page (#117), the new start page: painted this month and streak, pile, net pile this year and finish estimate; cards to continue painting the last units you worked on (with a quick move), a year activity calendar, records, the oldest units in the pile, factions closest to done, recent activity, the last 6 months, and what's left to buy. New users get a prompt to add their first unit. Settings → Appearance → Start page switches back to the Backlog. ✎ Customise reorders (drag or arrows), resizes (S/M/L), removes and adds cards (points painted, pile age, stage flow, spending, paint usage, roles), with a few options per card; the layout is saved with your data and backups.
- Stats page (#88): painted this month, weekly streak, pile size and level, net pile this year, pace and finish estimate; charts of models painted per month and pile in vs out; points and models painted per faction with a finish estimate each. Filter by faction and time range (1, 3, 6 months, 1 or 2 years, or all time; 1 and 3 months are drawn by week). Charts have gridlines, rounded bars and hover tooltips.

## [0.5.5] - 2026-11-02

### Changed
- Backlog table: entries of the same unit type and faction share one summary row (models, Wishlisted, a stage bar, painted, schemes, flags, last update) that expands into each entry with its own stages, scheme, tags and state. Columns sort on click and can be hidden; your choices are remembered.

## [0.5.4] - 2026-11-02

### Added
- Unit models: move one, a number, or all models of a stage in one click, to the next stage by default or any stage you pick. The full move dialog (date, note, photo) is still there.

## [0.5.3] - 2026-11-02

### Changed
- Wishlisted models in the backlog are always on the shopping list: the item's quantity follows the Wishlisted count (also in units with models at several stages), and it is ticked bought when none are left.

## [0.5.2] - 2026-11-02

### Added
- Backlog unit: "Add missing paints to shopping list…" for the paints of its scheme you don't own (#104).
- Shopping: search the whole catalogue (units, and paints with a colour swatch) and add to the shopping list without owning them. A unit also goes to the backlog as Wishlisted (a new entry, or more models on an entry you choose); a paint not in your inventory goes on the paint wishlist. Ticking a unit bought moves its Wishlisted models to the first painting stage.
- Backlog: a fixed first stage, Wishlisted, for models you don't own yet. They don't count as owned in army lists or in painting progress.

## [0.5.1] - 2026-11-02

### Added
- Shopping lists: a new Shopping tab with a main list of everything to buy and your own lists (e.g. per shop) holding some of it. Add models and paints from an army's buy list, "Paints to buy" or the paint wishlist, choosing which lists they go on, or type in anything else. Set quantity, shop and price; see the total; copy as text or print / save as PDF. Ticking a paint as bought can mark it ordered or put it in your inventory (#87).
- Paints to buy: on the Paints page, pick schemes (yours to start with) and print or save as PDF the paints they use that you don't own, with brand, swatch, the schemes that use each one and tick boxes (#86).

### Changed
- The buy list PDF shows each paint's brand and swatch (#86).

### Fixed
- The old greyed-out "Shopping (soon)" item no longer shows next to the Shopping tab.

## [0.5.0] - 2026-11-02

### Added
- Wargear loadouts for army list units: in a unit's details (▸) set how many models of each type it has and the weapons each one takes. A unit starts from the loadout of your linked models, or the datasheet default, and keeps your own changes once you edit it. Rule checks flag loadouts that break the datasheet's limits (#78).
- Importing a BattleScribe or New Recruit roster (`.rosz`, `.ros`) also reads each unit's wargear (#78).

### Fixed
- Wargear options that link to another model's weapon in the same unit (e.g. an Eliminator Sergeant's Bolt Sniper Rifle) were missing from the catalogue (#78).

## [0.4.2] - 2026-11-02

### Added
- Colour schemes for army lists: an army scheme in the builder header and, per unit, a scheme in its details (▸). A unit without a choice uses the scheme on your model, then a version of the army scheme made for its unit type, then the army scheme, then the faction default. "Use these schemes on my models" applies them to linked models (asks before changing a model that has another scheme). Your schemes and the bundled library are offered (#83).
- PDF asks for the army scheme and, optionally, a scheme per unit; it lists each scheme with its units (to buy / to paint / painted ✓) and its paints, ticked when you have them. Buy-list paints now come from every unit in the list, owned or not (#83).

## [0.4.1] - 2026-11-02

### Added
- Buy list includes the paints your list's units need for their schemes and you don't have (no pot, or only wishlist / ordered / empty), on screen, in the text copy and in the PDF (#73).

## [0.4.0] - 2026-11-01

Army builder: lists from your collection, rule checks per edition, detachments, buy list, import/export.

Download your catalogue again after updating (Settings → Catalogue data) to get rule checks, detachments, leaders, stats and weapons.

### Added
- 10th and 11th edition catalogues, selectable: Settings → Catalogue data has a card per edition (download, update check, remove, "Use this edition"); both can be installed. The parser reads BSData's new JSON format (11th edition) as well as XML. New downloads default to 11th edition. The daily BSData check covers both (#58).
- Army lists: edition, battle size (Combat Patrol, Incursion, Strike Force, Onslaught), editable points limit, planned/playable; points and owned / partly owned / missing are worked out from the catalogue and your collection; lists are in backups (#51).
- Rule checks per edition from BSData: points limit, unit copies (with Incursion limits), at least one Character, unit sizes, one Character Warlord, Epic Heroes once; Combat Patrol checks points only. Lists that break rules can still be saved (#56). Download your catalogue again to enable checks.
- Armies page: all lists with complete / missing models and rules OK / issues flags, with filters; builder with legal units of the list's faction grouped by role, a "Not owned" switch (off: only units you own), Legends switch, Warlord star, model counts, leader attachment, ownership per unit and a clickable issues panel. The first unit sets the faction (#52).
- Detachments and enhancements from BSData, both editions: 11th edition armies take several detachments within their detachment points (2 at Incursion, or 3 with a 3DP detachment; 3 at Strike Force; 4 at Onslaught), 10th edition one. Enhancements of the chosen detachments on Characters (not Epic Heroes), with points; checks for count (11th: 2 at Incursion, else 4; 10th: 3), duplicates, wrong detachment and wrong unit (#54). Download your catalogue again to get them.
- Buy list in the builder: missing models per unit with their points, total, copy as text, and a printable sheet (save as PDF from the print dialog) (#60).
- Lists and your collection: link each list unit to one of your units (a unit only once per list), painted progress per unit (🎨 painted/owned), a "From my collection" panel with models still to paint (⏭ Next up shortcut) and paints their schemes need that you don't have, "Add all my units" and "Start with all the units I own" for new lists (#53).
- Import lists from BattleScribe / NewRecruit (.rosz, .ros; matched by BSData ids), from text (GW app / NewRecruit style, pasted or .txt; matched by names, with a list of anything not recognised) and from MiniTracker .json; export as text (copy or .txt) and .json (#55).
- Backlog units show their datasheet: stat lines, ranged and melee weapon profiles, abilities, rules, weapon abilities, wargear options and keywords (open on the unit page, folded in the side panel). The catalogue browser shows stats and weapons too. Download the catalogue again to get stats and weapons.
- Leaders: each Leader is offered only the units it can lead (from BSData), and lists are checked for wrong attachments and too many Leaders (two for units that allow it, e.g. Cadian Shock Troops). Enhancements limited to some units (e.g. Kroot Shaper enhancements) are offered only to those units and checked. Wargear lists no longer show Warlord, "… upgrade" or Crusade entries. Wolf Scouts sizes fixed (#63).
- Builder: add units by double-click or by dragging them anywhere onto the right-hand column; the unit panel can be resized (drag the divider, or arrow keys) and remembers its width; the + button stays visible on long names.

### Fixed
- Unit sizes for units built from size options or linked models (e.g. Death Korps of Krieg, Cadian Shock Troops, Einhyr Hearthguard, Lootas, Sicarians, Jakhals were read as 1 model); Epic Heroes can be Warlord even when the data leaves out the Character keyword (The Silent King); importing a roster now warns about a detachment the catalogue doesn't know. Found by importing real BattleScribe/NewRecruit rosters.

## [0.3.0] - 2026-11-01

Paints, schemes, photos and rules.

### Changed
- Settings is now one page: Appearance (theme), Pipelines, Catalogue data and Backup; theme moved there from the sidebar (#33).

### Added
- Paint pipeline (wishlist → ordered → sealed → in use → running low → empty) and scheme pipeline (idea → testing → final → archived), editable like the painting pipeline (#33).
- Paints page: ~1,500 bundled paints (Citadel, Army Painter, Vallejo, AK Interactive; from minipainter, MIT) with swatches, search and filters (brand, type, colour, stage, owned, favourites) (#26).
- Paint inventory: stage from the paint pipeline, pots with +/−, purchase date, price, shop, location, barcode, rating, favourite, notes; running low / empty shortcuts; stats (owned, pots, value, running low, wishlist, per brand) (#26).
- Custom paints with colour picker; CSV import/export of the inventory (#26).
- Backups include the paint inventory and custom paints (backup format v2; v1 files still import) (#26).
- Photos for units and painting steps: original kept untouched, compressed copy (max 1600px, WebP/JPEG) shown in the app; gallery, viewer with captions, next/previous, download original, delete (#28).
- Photo file names built from the mini: `<faction>_<unit>_<unit-tag>_<stage>_<date>_<nn>`, where the unit tag (`mt-xxxxxxxx`) is permanent and will be shared with QR/NFC tags (#28).
- Settings → Storage shows photo usage and browser storage, and can remove originals to free space (#28).
- Backups are now one .zip with photos: **Light** (compressed copies, small) or **Full** (with originals), estimated size shown; built one photo at a time to keep memory low; images stored without re-compressing. Restoring a light backup keeps originals still on the device; older .json backups still import (#28).
- Paint schemes: official, community (with source) and personal schemes; areas with ordered steps (technique, paints with mix ratios, thinning, tool, note); status from the scheme pipeline, difficulty, minutes per model, tips, tags; colour strip; missing paints (#27).
- "Make my variant" copies any scheme with a link to the original and shows paints added/dropped; default scheme per faction (pre-selected for new units); scheme shown on units; share/import scheme files (friends' custom paints come along); schemes in backups (#27).
- Scheme library: 40 T'au Empire community schemes (Paint Pad, Tale of Painters) bundled read-only with credit and links; "Save a copy" or "Make my variant" to make them yours; extra paints they use are added to the paint list.
- Recipe extractor (`src/domain/schemes/extract.ts`): turns recipe pages into areas and steps matched to our paints (techniques, mix ratios, spelling slips); scraper tool `npm run schemes:scrape` with Paint Pad and blog adapters.
- A unit's scheme picker only lists schemes that fit it (same faction; unit-type schemes like Vespid or Kroot only on those units), grouped Official / Community / Mine, including library schemes. Schemes get an "applies to unit types" field, filled by the scraper.
- Units and schemes are linked both ways: the unit panel and page show the scheme as a card (cover, colour strip, origin, missing paints) that opens the scheme, with a picker to choose or change it right there; the scheme editor's "used by" opens each unit's page.
- Fixed: saving the same recipe link twice at once could lose its "scheme made" mark.
- Rules: the catalogue now includes every core and faction rule and each ability's text (catalogue format 2; older catalogues ask to re-download). New Rules page (search, groups, which units have each rule). In datasheets, abilities, unit rules and weapon abilities ("Sustained Hits 1", "Melta 2"…) open their explanation with the ▸ arrow (#37).
- Settings → Appearance → Rule explanations: collapsed, always expanded, or on hover (#37).
- Full unit page: double-click a unit (or "⤢ Open page" in the side panel) for a wide view with large photos, the permanent unit tag and a link to its datasheet; back keeps your backlog filters (#39). A single click opens the side panel after a short pause, so a double-click never lands on a control that moved (#39).
- Official T'au studio schemes in the library (T'au Sept, Vior'la, Farsight Enclaves): official colours with a simple recipe written by MiniTracker, linked to the Warhammer Community videos (#27).
- Scheme photos: gallery, cover photo (shown on cards and in the editor), photos per step; names like `scheme_<name>_sc-xxxxxxxx_<date>_<nn>`; deleted with the scheme; in backups (#27).
- Printable recipe cards (print or save as PDF): colour strip, credit, paint checklist with owned marks, steps per area, tips (#27).
- "Add from link": paste any recipe link (always remembered in Saved links) and optionally its text; the app drafts the scheme (areas, steps, paints) for review and keeps the link as source.
- "Send to MiniTracker" bookmarklet: on any recipe page you are reading (Goonhammer, blogs, Paint Pad…), one click opens MiniTracker with the steps read from that page; nothing goes through a server.
- Backlog banner when no unit catalogue is installed, with a one-click download and progress; can be hidden (#33).

## [0.2.0] - 2026-11-01

The unit catalogue.

### Added
- Unit catalogue: download Warhammer 40,000 data from BSData and convert it on the device (in a background worker), with update check and import from local files (#15).
- Add unit: searchable pickers for faction and unit from the catalogue (keyboard and mouse); picking a datasheet fills name, faction, minimum size and wargear suggestions, and shows live points; custom names still allowed; Legends hidden unless asked (#17).
- Info tooltip next to "Show Legends" in the add-unit form explaining what Legends units are.
- Unit details show the linked datasheet, role and current points (#17).
- Catalogue browser: every unit with role, size, points by size, abilities, wargear, keywords and factions; search and filters (faction, role, owned only, Legends); owned counts; "Add to collection" (#16).
- Daily CI check that the BSData link works and the parser still reads real data; opens an issue when it breaks (#15).

## [0.1.0] - 2026-11-01

First release: the backlog tracker.

### Added
- Units with model groups (count, stage, loadout, magnetised slots); split and merge groups as models progress (#1).
- Editable global painting pipeline (sprue → built → primed → basecoated → painted → based → varnished by default) (#2).
- Status history for every move: date (editable), note, direction (forward/backward) (#2).
- Unit states (active, on hold, sold, traded, gifted, lost), favourite and next-up flags, external links ready for QR/NFC/digital twins (#2).
- Local storage in the browser (IndexedDB) with atomic saves and a schema-migration test pattern (#3).
- Backlog screen: painted progress, models per stage, search and filters, unit table (#4).
- Unit details panel, move-models dialog, add/edit unit form, pipeline settings (#4).
- Themes: Grimdark and Forum 2005 (#4).
- Backup: export everything to a versioned JSON file and restore it (#5).
- Installable, offline-capable web app (PWA), deployed to GitHub Pages.

### Tests and tooling
- Unit and component tests (Vitest, Testing Library), Playwright end-to-end tests on desktop and iPad viewports, all in CI (#6).
- Coverage gate of 90% on domain and data code.

[Unreleased]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.26.2...HEAD
[0.26.2]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.26.1...v0.26.2
[0.26.1]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.26.0...v0.26.1
[0.26.0]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.25.0...v0.26.0
[0.25.0]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.24.0...v0.25.0
[0.24.0]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.23.1...v0.24.0
[0.23.1]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.23.0...v0.23.1
[0.23.0]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.22.0...v0.23.0
[0.22.0]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.21.0...v0.22.0
[0.21.0]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.20.0...v0.21.0
[0.20.0]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.19.0...v0.20.0
[0.19.0]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.18.0...v0.19.0
[0.18.0]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.17.0...v0.18.0
[0.17.0]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.16.0...v0.17.0
[0.16.0]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.15.0...v0.16.0
[0.15.0]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.14.0...v0.15.0
[0.14.0]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.13.0...v0.14.0
[0.13.0]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.12.0...v0.13.0
[0.12.0]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.11.2...v0.12.0
[0.11.2]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.11.1...v0.11.2
[0.11.1]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.11.0...v0.11.1
[0.11.0]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.6.1...v0.7.0
[0.6.1]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.5.5...v0.6.0
[0.5.5]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.5.4...v0.5.5
[0.5.4]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.4.2...v0.5.0
[0.4.2]: https://github.com/Giacomo-Antonioli/MiniTracker/releases/tag/v0.4.2
[0.4.1]: https://github.com/Giacomo-Antonioli/MiniTracker/releases/tag/v0.4.1
[0.4.0]: https://github.com/Giacomo-Antonioli/MiniTracker/releases/tag/v0.4.0
[0.3.0]: https://github.com/Giacomo-Antonioli/MiniTracker/releases/tag/v0.3.0
[0.2.0]: https://github.com/Giacomo-Antonioli/MiniTracker/releases/tag/v0.2.0
[0.1.0]: https://github.com/Giacomo-Antonioli/MiniTracker/releases/tag/v0.1.0
