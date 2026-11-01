# Changelog

All notable changes to MiniTracker. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Unit catalogue: download Warhammer 40,000 data from BSData and convert it on the device (in a background worker), with update check and import from local files (#15).
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

[Unreleased]: https://github.com/Giacomo-Antonioli/MiniTracker/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Giacomo-Antonioli/MiniTracker/releases/tag/v0.1.0
