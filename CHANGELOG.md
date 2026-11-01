# Changelog

All notable changes to MiniTracker. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed
- Settings is now one page: Appearance (theme), Pipelines, Catalogue data and Backup; theme moved there from the sidebar (#33).

### Added
- Paint pipeline (wishlist → ordered → sealed → in use → running low → empty) and scheme pipeline (idea → testing → final → archived), editable like the painting pipeline (#33).
- Paints page: ~1,500 bundled paints (Citadel, Army Painter, Vallejo, AK Interactive; from minipainter, MIT) with swatches, search and filters (brand, type, colour, stage, owned, favourites) (#26).
- Paint inventory: stage from the paint pipeline, pots with +/−, purchase date, price, shop, location, barcode, rating, favourite, notes; running low / empty shortcuts; stats (owned, pots, value, running low, wishlist, per brand) (#26).
- Custom paints with colour picker; CSV import/export of the inventory (#26).
- Backups include the paint inventory and custom paints (backup format v2; v1 files still import) (#26).
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

[Unreleased]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Giacomo-Antonioli/MiniTracker/releases/tag/v0.2.0
[0.1.0]: https://github.com/Giacomo-Antonioli/MiniTracker/releases/tag/v0.1.0
