# BUILD_STEPS.md

Step-by-step build instructions for an AI coding agent (Claude Code or similar). Follow stages in order. Do not start a stage until the previous stage's verification step passes. Check off each task as it's completed.

---

## Stage 0: Project setup

- [ ] Run `npm init -y`
- [ ] Run `npm install express sqlite3 node-wifi cors multer jspdf`
- [ ] Create `.gitignore` excluding `node_modules/`, `data/*.db`, `uploads/*` (but keep `uploads/.gitkeep`)
- [ ] Create the full folder structure exactly as listed in `PROJECT_STRUCTURE.md`
- [ ] **Verify:** `npm install` completes with no errors; folder structure matches `PROJECT_STRUCTURE.md` exactly

---

## Stage 1: Core — database (F04)

- [ ] Implement `server/core/db.js`: open/create the SQLite file at `data/wifi.db`, create `floors`, `rooms`, and `samples` tables exactly as specified in `CLAUDE.md`
- [ ] **Verify:** running the file (or starting the server) creates `data/wifi.db` with all three tables and no errors

---

## Stage 2: Core — floor plan builder (F01, F02)

- [ ] Implement `server/core/floorplanBuilder.js`: expose a `register(app, db)` function with routes to create a floor, upload a room photo (via `multer`) attached to a floor, and update a room's `x/y/width/height` arrangement
- [ ] Implement `public/core/floorplanBuilder.js`: upload UI for room photos, and a drag/resize interaction on canvas to arrange room images into the composite floor
- [ ] Implement `public/core/canvasEngine.js`: shared function(s) to draw all room images at their stored positions onto the canvas
- [ ] **Verify:** can create a floor, upload 2+ room photos, drag them into position, and reload the page to see the same arrangement persisted

---

## Stage 3: Core — WiFi scanner (F03)

- [ ] Implement `server/core/wifiScanner.js`: a function that returns current RSSI (and SSID/BSSID if available) using `node-wifi`, falling back to parsing `netsh wlan show interfaces` if needed
- [ ] Test this module standalone (a small script calling it every second, logging output) before wiring it into any route
- [ ] **Verify:** scanning returns a consistent, sensible signal value on this machine — confirm the value's scale (dBm vs. percentage) before proceeding, since this scale must be used consistently everywhere downstream

---

## Stage 4: Core — sample storage wiring (F04)

- [ ] Add a route in `server/index.js` (or a small core file) that: accepts `{floor_id, x, y}`, calls the WiFi scanner, inserts the result into `samples`
- [ ] Implement `public/core/tagging.js`: click-to-tag on the canvas, "take reading" button calling this route
- [ ] **Verify:** clicking a point on the composite floor and taking a reading creates a new row in `samples` with the correct floor_id, x, y, and a plausible RSSI value

---

## Stage 5: Core — interpolation and heatmap (F05, F06, F14)

- [ ] Implement `server/core/interpolation.js`: IDW grid interpolation function, accepting a `power` parameter for smoothing
- [ ] Add a route exposing interpolated grid data for a given floor (and optional `power` query param)
- [ ] Implement `public/core/heatmap.js`: fetch the interpolated grid and render it as a color-graded overlay on the canvas (red = weak, green = strong)
- [ ] Add a smoothing slider in the UI wired to the `power` parameter
- [ ] **Verify:** after 5+ tagged samples, a heatmap renders over the composite floor plan, and moving the smoothing slider visibly changes how sharply the heatmap falls off around each point

---

## Stage 6: Core loop checkpoint — do not skip

- [ ] With `features.config.js` (both server and public) left **empty** of optional modules, do a full manual walkthrough: create a floor, upload room photos, arrange them, tag 10+ points across them, view the heatmap, adjust smoothing
- [ ] **Verify:** the entire core loop works end to end with zero modules enabled before any module work begins. Fix any core issues now — they will be harder to isolate once modules are layered on top.

---

## Stage 7: Module — multiAP (F07)

- [ ] Branch: `feature/F07-multi-ap`
- [ ] Implement `server/modules/multiAP/index.js` following the module contract: `migrate(db)` adds `ssid`/`bssid` columns to `samples`; `register(app, db)` adds SSID-filtered heatmap/query routes
- [ ] Implement `public/modules/multiAP.js`: SSID filter dropdown, calling the filtered route
- [ ] Add `'multiAP'` to both `features.config.js` files
- [ ] **Verify:** with only `multiAP` enabled (plus core), filtering the heatmap by SSID works; disabling it (removing from config) leaves core working exactly as in Stage 6
- [ ] Commit, push, open PR into `main`, merge

---

## Stage 8: Module — deadZoneReport (F09)

- [ ] Branch: `feature/F09-dead-zone-report`
- [ ] Implement `server/modules/deadZoneReport/index.js`: threshold-based scan of `samples`, returns flagged weak spots with recommendation text
- [ ] Implement `public/modules/deadZoneReport.js`: report panel/table in the UI
- [ ] Add `'deadZoneReport'` to both config files
- [ ] **Verify:** report correctly flags samples below threshold; disabling the module removes the report UI cleanly with no console errors
- [ ] Commit, push, open PR into `main`, merge

---

## Stage 9: Module — multiFloor (F12)

- [ ] Branch: `feature/F12-multi-floor`
- [ ] Implement `server/modules/multiFloor/index.js`: list/create/delete-floor routes (floors table already exists in core)
- [ ] Implement `public/modules/multiFloor.js`: floor switcher dropdown
- [ ] Add `'multiFloor'` to both config files
- [ ] **Verify:** can create a second floor, switch between floors, and each floor's composite/heatmap is independent
- [ ] Commit, push, open PR into `main`, merge

---

## Stage 10: Module — congestionTracking (F08)

- [ ] Branch: `feature/F08-congestion-tracking`
- [ ] Implement `server/modules/congestionTracking/index.js`: route to compare samples across two time ranges on the same floor
- [ ] Implement `public/modules/congestionTracking.js`: UI to pick two time ranges and view them side by side
- [ ] Add `'congestionTracking'` to both config files
- [ ] **Verify:** re-surveying the same floor at two different times and comparing shows a visible difference where congestion (not distance) is the likely cause
- [ ] Commit, push, open PR into `main`, merge

---

## Stage 11: Module — speedTest (F11)

- [ ] Branch: `feature/F11-speed-test`
- [ ] Implement `server/modules/speedTest/index.js`: `migrate(db)` adds `download_mbps` column; `register` adds an optional throughput check alongside a scan
- [ ] Implement `public/modules/speedTest.js`: toggle to include a speed test when tagging a point
- [ ] Add `'speedTest'` to both config files
- [ ] **Verify:** tagging a point with the toggle on records both RSSI and a throughput value
- [ ] Commit, push, open PR into `main`, merge

---

## Stage 12: Module — pdfExport (F13)

- [ ] Branch: `feature/F13-pdf-export`
- [ ] Implement `public/modules/pdfExport.js`: export button using `jsPDF` to save the current canvas (floor + heatmap) as a PDF
- [ ] Add `'pdfExport'` to `public/features.config.js` (no backend route needed)
- [ ] **Verify:** exported PDF matches what's shown on screen
- [ ] Commit, push, open PR into `main`, merge

---

## Stage 13: Full survey and data collection

- [ ] With all modules enabled, conduct the real survey: upload actual room photos for the target floor, arrange them to match the real layout, tag 20-30+ points, re-survey at a second time of day for congestion comparison
- [ ] **Verify:** heatmap looks reasonably smooth (not blobby — add more sample points near any suspicious gaps), dead-zone report produces sensible recommendations

---

## Stage 14: Report writeup

- [ ] Structure the report around: data collection method → visualization (heatmap + color scale explanation) → analysis (AP coverage comparison + congestion vs. distance findings) → recommendations (dead-zone report output)
- [ ] Include exported PDF heatmaps as figures
- [ ] **Verify:** report explicitly ties each section back to what the software actually produced — no claims the software doesn't support (e.g. do not claim people-counting or motion detection, which are out of scope)
