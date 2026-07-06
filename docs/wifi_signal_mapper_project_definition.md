# Campus WiFi Signal Strength Mapper

## Goal

**G1.** A software-only application that maps WiFi signal strength across a college building or hall, visualized as a color-graded heatmap over a floor plan. The goal is to identify weak-signal ("dead") zones, understand what's actually causing them (distance from access point vs. network congestion), and produce actionable recommendations — turning a simple mapping tool into a small diagnostic study of campus WiFi coverage.

No additional hardware is required. The application uses the signal-strength (RSSI) readings already available from a standard laptop WiFi card.

## Core features (MVP)

| ID | Feature | Description |
|----|---------|-------------|
| F01 | Floor plan upload | User uploads an image of the building/hall layout. |
| F02 | Click-to-tag positioning | User walks to a physical location, clicks the corresponding point on the floor plan image, and the app captures a WiFi reading tagged to that point. |
| F03 | RSSI scanning | Reads current WiFi signal strength from the laptop's network interface at the moment of tagging. |
| F04 | Data storage | Every sample (position, signal strength, timestamp) is stored in SQLite. |
| F05 | Interpolation | Inverse distance weighting (IDW) fills in signal estimates between sampled points. |
| F06 | Heatmap rendering | Color-graded overlay (red = weak, green = strong) rendered on the floor plan using canvas. |

## Added features

| ID | Feature | Description |
|----|---------|-------------|
| F07 | Multi-AP / SSID comparison | Each sample also records which access point (SSID/BSSID) it connected to, so the heatmap can show which AP covers which zone, and where handoff/overlap is poor. |
| F08 | Time-of-day congestion tracking | Same points can be re-surveyed at different times of day (e.g. peak lecture hours vs. evening), distinguishing distance-based weak signal from congestion-based weak signal. |
| F09 | Dead-zone detection and auto-report | Zones falling below a configurable signal threshold are automatically flagged, with a generated summary (e.g. "Zone near Block C stairwell: average -78dBm, recommend repeater placement"). |
| F10 | Interpolation method comparison (optional) | Implement IDW alongside a second interpolation method and evaluate accuracy against held-out sample points, for a methodology/evaluation section. |
| F11 | Speed test at each point (optional) | Alongside RSSI, run a quick throughput check to show signal strength and actual usable speed aren't always the same thing. |
| F12 | Multi-floor UI | Add a `floor_id` column to the samples table, with a dropdown to upload and switch between floor plans, each with its own heatmap. |
| F13 | PDF export | Render the floor plan + heatmap to an image/PDF on demand (e.g. via `jsPDF`) so it can be shared without the app installed. |
| F14 | Smoothing-slider controls | UI slider controlling the IDW distance-decay exponent, to adjust how aggressively interpolation spreads between sample points. |

## Out of scope

| ID | Item | Reason |
|----|------|--------|
| X01 | Detecting or counting people (device-free presence sensing) | Requires CSI-capable hardware not available on standard Windows laptops. |
| X02 | Real-time person tracking or motion detection | Same hardware limitation as X01. |

## Tech stack

| ID | Layer | Choice |
|----|-------|--------|
| T01 | Backend | Node.js + Express |
| T02 | Database | SQLite |
| T03 | RSSI scanning | `netsh wlan show interfaces` wrapper, or the `node-wifi` npm package |
| T04 | Interpolation | Inverse distance weighting (custom JS, no ML library needed) |
| T05 | Frontend | HTML canvas for the floor plan + heatmap overlay |

## Project narrative for report/evaluation

**N1.** Data collection — map WiFi signal strength across the hall/building using a laptop-based tool (F01-F04).
**N2.** Visualization — render the color-graded heatmap (F05-F06).
**N3.** Analysis — identify which access points cover which zones (F07), and distinguish distance-based from congestion-based weak signal (F08).
**N4.** Recommendation — generate a dead-zone report with suggestions (F09).

This gives the project a complete arc: data collection → visualization → analysis → recommendation, rather than stopping at "a heatmap generator."
