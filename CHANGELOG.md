# Changelog

## [Unreleased]
- Project scaffold: Vite + React + TypeScript, PWA, Tailwind, CI/CD.
- Domain: owned units with model groups, split/merge and magnetised slots (#1).
- Domain: editable global painting pipeline, status history with date/photo/note, lifecycle states, favourite/next-up flags, external refs for future digital twins (#2).
- Data: IndexedDB storage (Dexie) with unit, history and settings repositories; atomic status moves; migration test pattern (#3).
- UI: backlog table with progress, filters and search; unit details panel with history; move-models dialog; add/edit unit form; pipeline settings; Grimdark and Forum 2005 themes (#4).
- Backup: export all data to a versioned JSON file and restore it (all or nothing, with confirmation) (#5).
- Testing: component tests (Testing Library + jsdom) and Playwright E2E on desktop and iPad viewports, both in CI (#6).
