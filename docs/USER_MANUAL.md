# User Manual — Campus WiFi Signal Strength Mapper

This is the day-to-day guide for running a survey with the app. For architecture/build details, see the other files in `docs/`.

## 1. Install and run

```bash
npm install
npm start
```

Then open `http://localhost:3000` in a browser. The server listens on port 3000 by default (override with the `PORT` environment variable).

Requirements:
- Windows laptop connected to the WiFi network you want to survey.
- Node.js 18+.
- A photo per room/area you're surveying (JPG/PNG), taken with any camera or phone.

## 2. Core workflow (always available)

1. **Create a floor.** Type a name in the "New floor name" box and click **Create floor**. It appears in the dropdown next to it and is selected automatically.
2. **Add room photos.** Choose an image file and click **Add room photo**. It appears as a tile on the canvas.
3. **Arrange the composite floor plan.** Drag each room photo on the canvas into the position/shape that matches the real building layout. Positions are saved automatically as you drop each one — reloading the page keeps your arrangement.
4. **Tag a point and take a reading.**
   - Click a point on the canvas where you're physically standing.
   - Click **Take reading at last clicked point**. This reads the laptop's current WiFi signal and stores it at that point.
   - Repeat every 1.5–2 meters across the space you're surveying. Add extra points near walls, corners, and doorways — these are the most common dead zones.
5. **View the heatmap.** After a few points are tagged, a color overlay appears automatically (red = weak signal, green = strong). Drag the **Smoothing** slider to control how sharply the color falls off around each sample point — lower values blend more smoothly across the whole floor.
6. **Switch floors.** Use the floor dropdown to move between floors you've created; each floor has its own rooms, samples, and heatmap.

Aim for at least 20–30 tagged points per floor for a heatmap that looks meaningfully smooth rather than blobby.

## 3. Optional features

These only appear if enabled in `features.config.js` (see `docs/AGENTS.md`/`CLAUDE.md` for the module system). All are enabled by default on `main`.

### Multi-AP / SSID comparison
A **"Filter by AP (SSID)"** dropdown appears above the canvas, populated from every access point your samples have connected to. Selecting one replaces the heatmap with a version built only from readings taken on that AP — useful for seeing where one access point's coverage ends and another's begins. Choose "All access points" to go back to the combined view.

### Dead-zone report
Set a **threshold** (a 0–100 signal quality percentage; default 40) and click **Generate dead-zone report**. Nearby weak points are grouped into zones, each with an average signal reading and a plain-language recommendation (e.g. "consider a repeater or AP placement change nearby"). Use this as the basis for your recommendations section.

### Multi-floor deletion
A **Delete floor** button appears next to the floor dropdown. It removes the selected floor and all of its rooms and samples — this cannot be undone, and you'll be asked to confirm.

### Time-of-day congestion tracking
Pick two date/time ranges (e.g. a busy lecture slot vs. late evening) and click **Compare**. Two small heatmaps render side by side along with average signal for each range, plus a note interpreting the result:
- A **large gap** between the two ranges at the same points suggests **congestion** (the AP didn't move, so something else is degrading the signal — likely other devices on the network).
- A **small gap** suggests the weak zone is **distance/obstruction-based**, not congestion.

To use this, re-survey the same floor (same tagged points, roughly) at two different times of day before comparing.

### Speed test
Check **"Include speed test"** before clicking **Take reading**. When checked, each reading also runs a real download-speed measurement (requires internet access) and records it alongside the signal strength — useful for showing that strong signal and fast usable internet aren't always the same thing. This adds a few seconds to each reading while the test runs; a "(measuring speed…)" note shows while it's in progress.

### PDF export
Click **Export as PDF** to save the current canvas (floor plan + heatmap, exactly as shown on screen) as a PDF file — handy for including figures in a report or sharing results without the app installed.

## 4. Writing up results

A natural report structure, matching what the software actually produces:

1. **Data collection** — how many points, which building/floor, survey method (Section 2).
2. **Visualization** — the heatmap(s) and what the color scale means (Section 2, step 5).
3. **Analysis** — AP coverage comparison (multi-AP) and congestion vs. distance findings (congestion tracking).
4. **Recommendations** — the dead-zone report's output.

Don't claim capabilities the software doesn't have — there is no people-counting or motion-detection feature in this project (see `docs/CLAUDE.md`, "Out of scope").
