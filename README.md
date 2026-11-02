# MiniTracker

**Track your miniature backlog, from sprue to varnish, and (soon) build armies from the models you actually own.**

[![CI](https://github.com/Giacomo-Antonioli/MiniTracker/actions/workflows/ci.yml/badge.svg)](https://github.com/Giacomo-Antonioli/MiniTracker/actions/workflows/ci.yml)
[![Deploy](https://github.com/Giacomo-Antonioli/MiniTracker/actions/workflows/deploy.yml/badge.svg)](https://github.com/Giacomo-Antonioli/MiniTracker/actions/workflows/deploy.yml)
[![Release](https://img.shields.io/github/v/release/Giacomo-Antonioli/MiniTracker?sort=semver)](https://github.com/Giacomo-Antonioli/MiniTracker/releases)
[![License: PolyForm Noncommercial](https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-blue)](LICENSE.md)

### ▶ [Open the app](https://giacomo-antonioli.github.io/MiniTracker/)

No account, no server: your collection stays in your browser. Install it from the browser menu ("Install app" / "Add to Home Screen") and it works offline on desktop, iPad and phone.

![Backlog in the Grimdark theme](docs/screenshots/backlog-grimdark.png)

## Features

**v0.1**

- **Units with model groups.** "6 built + 4 painted" in one unit, each group with its own loadout and magnetised weapon slots.
- **Painting pipeline.** Move models through your stages (sprue → built → primed → basecoated → painted → based → varnished). Rename, reorder or add your own stages.
- **History.** Every move is saved with date, note and direction, so going back (stripping, repainting) is recorded too.
- **Backlog dashboard.** Overall painted progress, models per stage, search and filters by faction, stage, state, favourites and "next up".
- **Unit states.** Active, on hold, sold, traded, gifted, lost.
- **Tutorials and notes.** Keep build and painting guide links on each unit.
- **Backup.** Export everything to one JSON file; restore it on any device.
- **Themes.** *Grimdark* (modern dark) and *Forum 2005* (old-school fantasy forum).

**New in v0.2**

- **Unit catalogue.** Download every Warhammer 40,000 datasheet (10th and/or 11th edition) (unit sizes, points, keywords, wargear, abilities) from BSData in Settings → Catalogue data. The data is downloaded and converted on your device; MiniTracker never hosts it.
- **Searchable unit picker.** Type to find the exact datasheet when adding a unit; faction, size and live points fill in.
- **Catalogue browser.** Every unit with points by size, abilities, wargear and keywords, plus how many you own.

**New in v0.3**

- **Rules.** Every core and faction rule and ability explained, in the catalogue and on a searchable Rules page.
- **Schemes.** Official, community and personal paint schemes with variants; a bundled library of community recipes (credited); "Add from link" and a **Send to MiniTracker** bookmarklet that turns any recipe page you're reading into a draft scheme.
- **Paints.** ~1,500 Citadel, Army Painter, Vallejo and AK paints with colour swatches; inventory with stages (wishlist → in use → running low → empty), pots, price, shop, storage location, barcode, rating and notes; custom paints; CSV import/export.

**New in v0.5**

- **Wargear loadouts.** Set the models and weapons of each list unit; starts from your linked models or the datasheet default, checked against the datasheet limits, and read from imported rosters.

**New in v0.4**

- **Army lists.** Build lists for 10th or 11th edition, Combat Patrol to Onslaught, from legal units of your faction; owned / partly owned / missing per unit, painted progress, "Add all my units".
- **Rule checks.** Points, unit limits per battle size, Characters and Warlord, detachments and detachment points, enhancements, Leaders — read from BSData for each edition. Lists that break rules can still be saved; problems are flagged.
- **Buy list.** What you still need for a list, as text or a printable PDF.
- **Import / export.** BattleScribe and NewRecruit rosters (`.rosz`), GW-app / NewRecruit text lists, and MiniTracker files.
- **Datasheets on your units.** Stats, weapons, abilities, rules and wargear on every backlog unit.

| Forum 2005 theme | Moving models |
|---|---|
| ![Forum 2005 theme](docs/screenshots/backlog-forum2005.png) | ![Move models dialog](docs/screenshots/move-models.png) |

## Roadmap

| Version | Focus | Status |
|---|---|---|
| [v0.1](https://github.com/Giacomo-Antonioli/MiniTracker/milestone/1) | Backlog tracker | ✅ released |
| [v0.2](https://github.com/Giacomo-Antonioli/MiniTracker/milestone/2) | Warhammer 40k catalogue from BSData, searchable unit picker, catalogue browser | ✅ released |
| [v0.3](https://github.com/Giacomo-Antonioli/MiniTracker/milestone/3) | Paint inventory (pre-filled Citadel, Army Painter, Vallejo, Green Stuff World…), paint schemes and recipes, photos | ✅ released |
| [v0.4](https://github.com/Giacomo-Antonioli/MiniTracker/milestone/4) | Army builder from owned models: points, rules, "what's missing", import/export BattleScribe `.rosz` and text lists | ✅ released |
| [v0.5](https://github.com/Giacomo-Antonioli/MiniTracker/milestone/5) | Wargear loadouts (v0.5.0 ✅), shopping list, game tracking, sharing via files | 🔨 in progress |
| [v0.6](https://github.com/Giacomo-Antonioli/MiniTracker/milestone/6) | Desktop app (Tauri), Google Drive sync | planned |

Later ideas: QR/NFC tags under bases linking each mini to its page ([#10](https://github.com/Giacomo-Antonioli/MiniTracker/issues/10)), storage boxes with pick and put-back lists ([#18](https://github.com/Giacomo-Antonioli/MiniTracker/issues/18)), Age of Sigmar and Kill Team.

## How it works

```
React UI (features/)  →  domain logic (pure TypeScript)  →  repositories  →  IndexedDB in your browser
```

- **`src/domain/`**: all the rules (groups, pipeline, progress, filters). No React, no storage, heavily tested.
- **`src/data/`**: storage behind small repository interfaces, so sync or a desktop backend can plug in later.
- **`src/features/`**: one folder per screen.

**Stack:** React 19, TypeScript, Vite, Tailwind CSS, Zustand, Dexie (IndexedDB), vite-plugin-pwa. Tests with Vitest, Testing Library and Playwright.

## Development

Needs Node.js 24.

```bash
git clone https://github.com/Giacomo-Antonioli/MiniTracker.git
cd MiniTracker
npm install
npm run dev            # http://localhost:5173/MiniTracker/
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm test` | Unit and component tests |
| `npm run test:coverage` | Tests with coverage (fails under 90% on domain/data) |
| `npm run e2e` | Playwright end-to-end tests (desktop + iPad viewports) |
| `npm run check:bsdata` | Live check: download real BSData and parse it (needs internet) |
| `npm run lint` / `npm run typecheck` | Static checks |
| `npm run build` | Production build into `dist/` |

### Workflow

Work is planned in two-week sprints on [GitHub issues](https://github.com/Giacomo-Antonioli/MiniTracker/issues) grouped by milestone. Each issue gets a branch and a pull request; CI (lint, typecheck, tests, coverage, build, end-to-end) must pass before merging. Every merge to `main` deploys the app to GitHub Pages.

### Releasing

1. Move the `[Unreleased]` entries in [CHANGELOG.md](CHANGELOG.md) under a new `## [x.y.z] - YYYY-MM-DD` heading.
2. Set the same version: `npm version x.y.z --no-git-tag-version`.
3. Merge that to `main`, then tag it: `git tag vx.y.z && git push origin vx.y.z`.
4. The [Release workflow](.github/workflows/release.yml) checks the version, runs the tests, builds, and publishes a GitHub release with the changelog section and a zip of the web app. Tags with a suffix (e.g. `v0.2.0-beta.1`) become pre-releases.

## Contributing

Bug reports and ideas are welcome as [issues](https://github.com/Giacomo-Antonioli/MiniTracker/issues/new/choose). Pull requests should follow the PR template checklist.

## Credits

- Paint list: [minipainter](https://github.com/ArturSkowronski/minipainter) by Artur Skowronski (MIT), see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Scheme library: recipe facts (areas, steps, paints) from community authors on [Paint Pad](https://paintpad.app) and [Tale of Painters](https://taleofpainters.com), each credited and linked to its source inside the app. No text or images are copied. Authors who want a recipe removed can [open an issue](https://github.com/Giacomo-Antonioli/MiniTracker/issues/new/choose). Rebuilt with `npm run schemes:scrape` (polite: identifies itself, waits between requests, respects robots.txt and sites that block bots).
- Unit and points data: the community-maintained [BSData](https://github.com/BSData) files ([wh40k-10e](https://github.com/BSData/wh40k-10e)). MiniTracker does not include or redistribute this data: each user's browser downloads it from BSData. A [daily check](.github/workflows/bsdata-check.yml) makes sure the download still works.

## License

[PolyForm Noncommercial 1.0.0](LICENSE.md). Free to use, study, modify and share for noncommercial purposes, keeping the copyright notice. No commercial use. Provided as is, with no warranty or liability.

Because commercial use is not allowed, this is *source-available* rather than OSI "open source".

## Disclaimer

MiniTracker is an unofficial fan project, not affiliated with or endorsed by Games Workshop. Warhammer, Warhammer 40,000 and related names are trademarks of Games Workshop Ltd. No Games Workshop artwork or rules text is included.
