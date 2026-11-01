# Changelog

All notable changes to MiniTracker. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- 10th and 11th edition catalogues, selectable: Settings → Catalogue data has a card per edition (download, update check, remove, "Use this edition"); both can be installed. The parser reads BSData's new JSON format (11th edition) as well as XML. New downloads default to 11th edition. The daily BSData check covers both (#58).
- Army lists: edition, battle size (Combat Patrol, Incursion, Strike Force, Onslaught), editable points limit, planned/playable; points and owned / partly owned / missing are worked out from the catalogue and your collection; lists are in backups (#51).
- Rule checks per edition from BSData: points limit, unit copies (with Incursion limits), at least one Character, unit sizes, one Character Warlord, Epic Heroes once; Combat Patrol checks points only. Lists that break rules can still be saved (#56). Download your catalogue again to enable checks.
- Armies page: all lists with complete / missing models and rules OK / issues flags, with filters; builder with legal units of the list's faction grouped by role, a "Not owned" switch (off: only units you own), Legends switch, Warlord star, model counts, leader attachment, ownership per unit and a clickable issues panel. The first unit sets the faction (#52).

## [0.3.0] - 2026-11-02

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

[Unreleased]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/Giacomo-Antonioli/MiniTracker/releases/tag/v0.3.0
[0.2.0]: https://github.com/Giacomo-Antonioli/MiniTracker/releases/tag/v0.2.0
[0.1.0]: https://github.com/Giacomo-Antonioli/MiniTracker/releases/tag/v0.1.0
