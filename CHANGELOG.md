# Changelog

All notable changes to MiniTracker. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
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

[Unreleased]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.9.0...HEAD
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
