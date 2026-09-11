# Repository Guidelines

## Project Structure & Module Organization
- `src/` — main web app source (views, models, workouts, BLE logic). Key entry points: `src/index.html`, `src/neo-simple.html`, `src/tacx-starter.html`.
- `src/workouts/` — workout definitions (`workouts.js`) and ZWO parsing/writing (`zwo.js`).
- `dist/` — built artifacts from Parcel; do not edit manually.
- `test/` — Jest tests.
- `assets/`, root HTML files, and config (`package.json`, `jest.config.js`) live at repo root.

## Build, Test, and Development Commands
- `npm run start` — run Parcel dev server for `src/index.html`.
- `npm run start:tacx` — dev server for `src/tacx-starter.html`.
- `npm run start:neo` — dev server for `src/neo-simple.html`.
- `npm run build` — production build to `dist/` (Parcel).
- `npm test` — run Jest test suite.

## Coding Style & Naming Conventions
- Use 2-space indentation; prefer ES modules and const/let (no var).
- Keep filenames kebab-case for assets/HTML, camelCase for JS identifiers, and PascalCase for classes/custom elements.
- Stick to existing patterns for workouts: metadata + intervals in ZWO-like XML strings.
- No auto-formatter configured; keep changes minimal and idiomatic.

## Testing Guidelines
- Framework: Jest (see `test/`).
- Write focused unit tests alongside modules; name files `<module>.test.js`.
- Run `npm test` locally before pushing significant changes.

## Commit & Pull Request Guidelines
- Commit messages: concise imperative style (e.g., “Add hill workout SIM profile”).
- Pull requests: include a short summary, link related issues, and add screenshots or logs when UI/behavior changes.
- Do not commit built `dist/` artifacts unless explicitly required; prefer source changes.

## Agent-Specific Notes
- Avoid modifying `dist/` directly; regenerate via `npm run build` when needed.
- For workouts, ensure slope/ERG targets align with BLE control paths in `src/neo-simple.js` and ZWO parsing in `src/workouts/zwo.js`.
