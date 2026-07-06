# AGENTS.md

Context for any AI coding agent working in this repository (Copilot, Cursor, or similar VS Code AI tools). Claude Code should use `CLAUDE.md`; the project facts below are the same in both files — keep them in sync if either changes.

## Project overview

**Name:** Campus WiFi Signal Strength Mapper

**Goal:** Software-only app (Windows laptop, no extra hardware) that maps WiFi signal strength across a college building, using a floor plan built from photos of individual rooms arranged manually into a composite canvas. Signal readings are tagged to points on that canvas and rendered as a color-graded heatmap. The project also distinguishes distance-based weak signal from congestion-based weak signal, and produces a dead-zone report with recommendations.

**Explicitly out of scope:** device-free presence/motion detection (would require CSI-capable hardware not available here) and automatic floor-layout inference from photos (would require 3D reconstruction). Do not implement or suggest these unless the user explicitly revisits scope.

## Tech stack

- Backend: Node.js + Express
- Database: SQLite (`sqlite3` package)
- RSSI scanning: `node-wifi`, with `netsh wlan show interfaces` as a Windows fallback
- Interpolation: inverse distance weighting (IDW), plain JS, no ML library
- Frontend: plain HTML + Canvas API, no framework
- File uploads: `multer`
- PDF export: `jspdf`

## Architecture: module-wise, plugin style

Every feature beyond the core loop is an independent module sharing one contract, so features are added/removed via a single config file and never require editing other modules.

```
server/
  core/               db.js, floorplanBuilder.js, wifiScanner.js, interpolation.js
  modules/            multiAP/, congestionTracking/, deadZoneReport/, speedTest/, multiFloor/, pdfExport/
  features.config.js  list of enabled module ids
  index.js            thin loader only — no feature-specific logic here

public/
  core/               canvasEngine.js, floorplanBuilder.js, tagging.js, heatmap.js
  modules/            one file per feature, same names as server modules
  features.config.js
  app.js              thin loader only
```

**Backend module contract:**
```javascript
module.exports = {
  id: 'moduleName',
  dependsOn: [],
  migrate(db) { /* create/alter tables this module owns, if any */ },
  register(app, db) { /* attach routes */ },
};
```

**Frontend module contract:**
```javascript
export default {
  id: 'moduleName',
  init(context) { /* wire up UI using context.canvas, context.state, context.api */ },
};
```

`index.js` and `app.js` must stay thin loaders that only iterate `features.config.js` — if you're about to add an `if` branch for a specific feature into either loader, put that logic inside the module instead.

**To add a feature:** create the module file(s) following the contract above, then add its id to `enabledModules` in both `features.config.js` files. Nothing else changes.

**To remove a feature:** remove its id from both config files. Leave any database columns it added in place — don't write cleanup migrations for this.

## Database schema

```sql
CREATE TABLE floors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

CREATE TABLE rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  floor_id INTEGER NOT NULL,
  image_path TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,
  label TEXT,
  FOREIGN KEY (floor_id) REFERENCES floors(id)
);

CREATE TABLE samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  floor_id INTEGER NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  rssi REAL NOT NULL,
  timestamp INTEGER NOT NULL,
  ssid TEXT,              -- added by multiAP module
  bssid TEXT,             -- added by multiAP module
  download_mbps REAL,     -- added by speedTest module
  FOREIGN KEY (floor_id) REFERENCES floors(id)
);
```

`rooms.x/y/width/height` and `samples.x/y` share the same composite-canvas coordinate space — never store raw screen/viewport pixels.

## Feature-to-module map

| ID | Feature | Module |
|----|---------|--------|
| F01 | Room photo upload | core: floorplanBuilder |
| F02 | Drag/resize arrangement into composite floor | core: floorplanBuilder |
| F03 | RSSI scanning | core: wifiScanner |
| F04 | Sample storage | core: db |
| F05 | IDW interpolation | core: interpolation |
| F06 | Heatmap rendering | core: heatmap (frontend) |
| F07 | Multi-AP/SSID comparison | modules/multiAP |
| F08 | Time-of-day congestion tracking | modules/congestionTracking |
| F09 | Dead-zone detection + report | modules/deadZoneReport |
| F11 | Speed test per point | modules/speedTest |
| F12 | Multi-floor switcher | modules/multiFloor |
| F13 | PDF export | modules/pdfExport |
| F14 | Smoothing (IDW power) control | core: interpolation |

## Git workflow

- `main` stays stable and deployable at all times.
- Every feature module is built on its own branch: `feature/F0X-short-name` (e.g. `feature/F07-multi-ap`).
- Open a pull request into `main` when a module works in isolation with `features.config.js` limited to just that module plus core.
- Since modules are removable by config alone, a branch that doesn't pan out can be abandoned without touching `main`.

## Conventions

- Pick one RSSI scale (dBm or 0-100% quality) at the start and use it consistently across scanner, storage, and heatmap color mapping — do not mix scales.
- Keep loaders (`index.js`, `app.js`) free of feature-specific logic at all times.
- Every optional module must be fully disable-able via config change alone; if disabling one requires touching core files, its contract is broken and should be fixed before merging.
