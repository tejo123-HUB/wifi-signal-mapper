# CLAUDE.md

This file gives Claude (via Claude Code) the context needed to build and modify this project consistently.

## Project overview

**Name:** Campus WiFi Signal Strength Mapper

**Goal:** A software-only application, run from a Windows laptop, that maps WiFi signal strength across a college building using a floor plan built from photos of individual rooms. Signal readings are tagged to points on that composite floor plan and rendered as a color-graded heatmap (red = weak, green = strong). The project also investigates *why* zones are weak — distance from access point vs. network congestion — and produces a dead-zone report with recommendations. This is an academic project; the write-up follows a data collection → visualization → analysis → recommendation narrative.

**No extra hardware.** Everything runs on the built-in WiFi card of a Windows laptop. There is no device-free presence/motion sensing in this project (that would require CSI-capable hardware this laptop doesn't have) — deliberately out of scope.

**Floor plan construction:** the app does not auto-generate a floor layout from photos (that would need real 3D reconstruction, out of scope for this project). Instead, the user uploads a photo per room and manually arranges those photos on a canvas (drag/resize) to approximate the real layout. That composite canvas becomes the "floor plan" that scanning and heatmapping operate on.

## Tech stack

- Backend: Node.js + Express
- Database: SQLite (via `sqlite3` package)
- RSSI scanning: `node-wifi` package, with a `netsh wlan show interfaces` fallback for Windows
- Interpolation: inverse distance weighting (IDW), implemented in plain JS — no ML library
- Frontend: plain HTML + Canvas API (no framework) for the composite floor plan and heatmap
- File uploads: `multer`
- PDF export: `jspdf`

## Architecture: module-wise, plugin style

Every feature beyond the core loop is its own self-contained module, following one shared contract, so features can be added or removed by touching a single config file — never by editing other modules.

```
server/
  core/
    db.js                  shared tables: floors, rooms, samples
    floorplanBuilder.js     room image upload + composite arrangement (F01, F02)
    wifiScanner.js          RSSI reading (F03)
    interpolation.js        IDW heatmap math (F05, F14)
  modules/
    multiAP/                F07
    congestionTracking/     F08
    deadZoneReport/         F09
    speedTest/              F11
    multiFloor/             F12
    pdfExport/              F13
  features.config.js        list of enabled module ids
  index.js                  loader — never edited when adding/removing features

public/
  core/
    canvasEngine.js
    floorplanBuilder.js
    tagging.js
    heatmap.js
  modules/
    multiAP.js
    congestionTracking.js
    deadZoneReport.js
    speedTest.js
    multiFloor.js
    pdfExport.js
  features.config.js
  app.js
```

### The module contract (do not deviate from this shape)

Backend module:
```javascript
module.exports = {
  id: 'moduleName',
  dependsOn: [],
  migrate(db) { /* create/alter tables this module owns, if any */ },
  register(app, db) { /* attach routes */ },
};
```

Frontend module:
```javascript
export default {
  id: 'moduleName',
  init(context) { /* wire up UI, using context.canvas, context.state, context.api */ },
};
```

`server/index.js` and `public/app.js` only ever loop over `features.config.js` and call `migrate`/`register` or `init` — they must never contain feature-specific `if` branches. If you find yourself adding feature-specific logic to the loader, stop — that logic belongs inside the module instead.

### Adding a feature
1. Create `server/modules/<name>/index.js` and, if it has frontend behavior, `public/modules/<name>.js`, following the contracts above.
2. Add `'<name>'` to `enabledModules` in both `features.config.js` files.
3. Nothing else changes.

### Removing a feature
1. Remove `'<name>'` from both `features.config.js` files.
2. Optionally delete the module folder later. Any database columns it added can be left in place unused — do not write migration/cleanup code for this.

## Database schema (owned by core unless noted)

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
  -- columns below added by optional modules via their own migrate():
  ssid TEXT,              -- added by multiAP
  bssid TEXT,             -- added by multiAP
  download_mbps REAL,     -- added by speedTest
  FOREIGN KEY (floor_id) REFERENCES floors(id)
);
```

`rooms.x/y/width/height` are the drag/resize arrangement coordinates within the composite floor canvas — the same coordinate space that `samples.x/y` and heatmap points use.

## Feature reference (IDs used throughout the project)

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
| F14 | Smoothing (IDW power) control | core: interpolation (always present) |

X01/X02 (people detection, motion tracking) are explicitly out of scope — do not implement these or suggest hardware for them unless asked to revisit scope.

## Build order

1. Core: `db.js`, `floorplanBuilder.js`, `wifiScanner.js`, `interpolation.js` — get the full core loop working with zero optional modules enabled first.
2. Verify: upload room photos, arrange them, take a WiFi reading, see it render as a heatmap point. Do this before touching any module.
3. Add modules one at a time, in this order, testing after each: multiAP → deadZoneReport → multiFloor → congestionTracking → speedTest → pdfExport.

## Conventions

- Keep `index.js` (backend) and `app.js` (frontend) as thin loaders — logic belongs in `core/` or `modules/`, never in the loader itself.
- RSSI scale: pick one consistent scale (dBm or 0-100% quality) at the start and use it everywhere — don't mix scales between the scanner, storage, and heatmap color mapping.
- Coordinates are always in the composite floor canvas space (the same space `rooms` and `samples` both use) — never store screen/viewport pixel coordinates directly.
- Every optional module must be safely removable by config change alone — if a module requires editing core files to disable, its contract is broken and should be fixed.
