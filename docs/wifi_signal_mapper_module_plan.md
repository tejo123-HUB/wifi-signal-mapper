# Module-wise architecture plan

This plan gives every feature its own folder, on both backend and frontend, following one consistent module contract. Adding a feature means adding a folder and one line to a config file. Removing a feature means deleting that one line — no code elsewhere needs to change.

---

## Folder structure

```
wifi-signal-mapper/
  server/
    core/
      db.js                  (shared tables: floors, rooms, samples)
      floorplanBuilder.js    (F01/F02 - room image upload + arrangement)
      wifiScanner.js         (F03 - RSSI reading)
      interpolation.js       (F05/F14 - IDW heatmap math)
    modules/
      multiAP/               (F07)
      congestionTracking/    (F08)
      deadZoneReport/        (F09)
      speedTest/             (F11)
      multiFloor/            (F12)
      pdfExport/             (F13)
    features.config.js       (list of enabled module ids)
    index.js                 (loads core + enabled modules)

  public/
    core/
      canvasEngine.js        (shared canvas + composite floor drawing)
      floorplanBuilder.js    (F01/F02 - drag/arrange room images)
      tagging.js             (F02/F04 - click-to-tag + save sample)
      heatmap.js             (F06 - render heatmap layer)
    modules/
      multiAP.js             (F07)
      congestionTracking.js  (F08)
      deadZoneReport.js      (F09)
      speedTest.js           (F11)
      multiFloor.js          (F12)
      pdfExport.js           (F13)
    features.config.js       (mirrors backend config)
    app.js                   (loads core + enabled modules)
```

---

## The module contract

Every backend module (core or optional) exports the same shape, so `index.js` never needs feature-specific code:

```javascript
// server/modules/<name>/index.js
module.exports = {
  id: 'multiAP',
  dependsOn: [],          // ids of other modules this needs, if any
  migrate(db) {           // runs once at startup — create/alter tables this module owns
    db.run(`ALTER TABLE samples ADD COLUMN ssid TEXT`);
  },
  register(app, db) {      // attach this module's routes/logic to the running app
    app.get('/api/floors/:id/samples-by-ssid', (req, res) => { /* ... */ });
  },
};
```

`server/index.js` becomes a small loader that never changes when features change:
```javascript
const express = require('express');
const db = require('./core/db');
const { enabledModules } = require('./features.config');

const app = express();
app.use(express.json());

// core modules always load
require('./core/floorplanBuilder').register(app, db);
require('./core/wifiScanner').register(app, db);
require('./core/interpolation').register(app, db);

// optional modules load only if listed in config
for (const name of enabledModules) {
  const mod = require(`./modules/${name}`);
  mod.migrate?.(db);
  mod.register(app, db);
}

app.listen(3000, () => console.log('Server running'));
```

`server/features.config.js` is the single on/off switch:
```javascript
module.exports = {
  enabledModules: [
    'multiAP',
    'deadZoneReport',
    'multiFloor',
    // 'congestionTracking',   <- commented out = disabled, delete the line entirely to remove for good
    // 'speedTest',
    // 'pdfExport',
  ],
};
```

Frontend follows the identical pattern — each module exports `{ id, init(context) }`, and `app.js` loops over `features.config.js` the same way, calling `init()` only for enabled modules. `context` gives every module access to the shared canvas, current floor state, and a small API helper, so modules never reach into each other directly.

---

## Module-by-module breakdown

### Core: floor plan builder (F01, F02)
- **Owns tables:** `floors`, `rooms` (`id`, `floor_id`, `image_path`, `x`, `y`, `width`, `height`, `label`)
- **Backend responsibility:** accept room image uploads, store arrangement coordinates when the user drags/resizes a room tile
- **Frontend responsibility:** upload UI, drag-and-resize canvas for arranging room photos into one composite floor
- **Why core, not optional:** every other module depends on there being a floor/composite canvas to operate on

### Core: WiFi scanner (F03)
- **Owns:** no tables (stateless)
- **Backend responsibility:** reads current signal strength (via `node-wifi` or `netsh`) on demand
- **Frontend responsibility:** "take reading" button, calls the scan endpoint
- **Why core:** every sample depends on this

### Core: data storage (F04)
- **Owns tables:** `samples` (`id`, `floor_id`, `x`, `y`, `rssi`, `timestamp`)
- **Backend responsibility:** insert/query samples
- **Why core:** every feature reads from this table

### Core: interpolation + heatmap (F05, F06, F14)
- **Owns:** no tables
- **Backend responsibility:** IDW calculation, exposes `power` parameter for smoothing (F14)
- **Frontend responsibility:** canvas heatmap rendering, smoothing slider
- **Why core:** the primary visual output of the whole app; not meaningfully optional

### Module: multiAP (F07)
- **Owns columns:** adds `ssid`, `bssid` to `samples` via its own `migrate()`
- **Backend responsibility:** filter heatmap/report queries by SSID
- **Frontend responsibility:** SSID filter dropdown
- **Depends on:** core storage
- **To remove:** delete `modules/multiAP/` and its line in both config files. Columns stay in the table unused — harmless.

### Module: congestionTracking (F08)
- **Owns:** no new tables — uses existing `timestamp` column
- **Backend responsibility:** endpoint to compare two time-range queries on the same floor (e.g. lecture hours vs. evening)
- **Frontend responsibility:** UI to pick two time ranges and show them side by side
- **Depends on:** core storage
- **To remove:** delete its folder + config lines; no schema cleanup needed

### Module: deadZoneReport (F09)
- **Owns:** no new tables
- **Backend responsibility:** threshold-based scan of samples, groups weak points, generates recommendation text
- **Frontend responsibility:** report table/panel
- **Depends on:** core storage
- **To remove:** delete its folder + config lines

### Module: speedTest (F11)
- **Owns columns:** adds `download_mbps` to `samples`
- **Backend responsibility:** optional throughput check alongside RSSI scan
- **Frontend responsibility:** toggle to include speed test when tagging a point
- **Depends on:** core WiFi scanner
- **To remove:** delete its folder + config lines

### Module: multiFloor (F12)
- **Owns tables:** `floors` already supports this via `id`/`name` — this module just adds the floor-switcher UI and floor CRUD endpoints
- **Backend responsibility:** list/create/delete floors
- **Frontend responsibility:** floor dropdown/switcher
- **Depends on:** core floor plan builder
- **To remove:** delete its folder + config lines (you'll just be stuck on one floor, which still works fine)

### Module: pdfExport (F13)
- **Owns:** no tables, no backend route needed (pure frontend, canvas-to-PDF)
- **Frontend responsibility:** export button using `jsPDF`
- **Depends on:** core heatmap rendering
- **To remove:** delete its file + config line

---

## How this makes add/remove easy

**To add a new feature** (say, a future F15): create `server/modules/f15/index.js` and `public/modules/f15.js` following the same contract, add its id to both `features.config.js` files. Nothing else in the codebase changes.

**To remove a feature:** delete or comment out its line in `features.config.js` (backend and frontend). The loader simply won't require that module. Delete the folder entirely later if you want it gone for good — database columns it added are safe to leave unused.

**To test a feature in isolation:** temporarily set `enabledModules` to just `['thatOneFeature']` and confirm it works against core alone, without any other module interfering.

---

## Build order recommendation

Given this structure, build in dependency order:
1. Core: db, floor plan builder, WiFi scanner, interpolation/heatmap (Stages 1-8 from the earlier build guide, adapted to the room-image composite builder instead of single floor plan upload)
2. Confirm core works end to end with zero optional modules enabled
3. Add modules one at a time, enabling each in the config and testing before adding the next: multiAP → deadZoneReport → multiFloor → congestionTracking → speedTest → pdfExport
