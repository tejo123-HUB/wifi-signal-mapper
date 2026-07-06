# Build guide: Campus WiFi Signal Strength Mapper

This guide walks through building the project end to end, in the order you should actually build it. Each stage references the feature IDs from the project definition document (F01-F14) so you can track progress against it.

---

## Stage 0: Prerequisites

- Node.js (v18+) and npm installed
- A code editor (VS Code recommended)
- Windows laptop with WiFi (this guide assumes Windows, since that's your setup)
- A floor plan image of the hall/building you're surveying (photo, scan, or simple drawing — JPG/PNG)

Verify Node is installed:
```bash
node -v
npm -v
```

---

## Stage 1: Project setup

Create the project folder and initialize it:
```bash
mkdir wifi-signal-mapper
cd wifi-signal-mapper
npm init -y
npm install express sqlite3 node-wifi cors
```

Folder structure to create:
```
wifi-signal-mapper/
  server/
    index.js
    db.js
    wifiScanner.js
    interpolation.js
  public/
    index.html
    app.js
    style.css
  uploads/        (floor plan images get saved here)
  data/           (SQLite database file lives here)
```

---

## Stage 2: Database schema (F04, F12)

`server/db.js`:
```javascript
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '../data/wifi.db'));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS floors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      image_path TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      floor_id INTEGER NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      rssi REAL NOT NULL,
      ssid TEXT,
      bssid TEXT,
      download_mbps REAL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (floor_id) REFERENCES floors(id)
    )
  `);
});

module.exports = db;
```

Note: `ssid`/`bssid` support F07, `download_mbps` supports F11, `floor_id` supports F12. Building these columns in now avoids a schema migration later.

---

## Stage 3: RSSI scanning module (F02, F03, F07)

`server/wifiScanner.js`:
```javascript
const wifi = require('node-wifi');

wifi.init({ iface: null }); // null = auto-pick the default WiFi interface

async function scanCurrentSignal() {
  const connections = await wifi.getCurrentConnections();
  if (!connections || connections.length === 0) {
    throw new Error('Not connected to any WiFi network');
  }
  const conn = connections[0];
  return {
    ssid: conn.ssid,
    bssid: conn.bssid,
    rssi: conn.signal_level ?? conn.quality, // dBm if available, else quality %
    timestamp: Date.now(),
  };
}

module.exports = { scanCurrentSignal };
```

If `node-wifi` has trouble reading dBm directly on your machine, fall back to parsing `netsh` output:
```javascript
const { exec } = require('child_process');

function scanViaNetsh() {
  return new Promise((resolve, reject) => {
    exec('netsh wlan show interfaces', (err, stdout) => {
      if (err) return reject(err);
      const ssidMatch = stdout.match(/SSID\s*:\s*(.+)/);
      const signalMatch = stdout.match(/Signal\s*:\s*(\d+)%/);
      if (!signalMatch) return reject(new Error('No signal data found'));
      resolve({
        ssid: ssidMatch ? ssidMatch[1].trim() : null,
        rssi: parseInt(signalMatch[1], 10), // percentage; convert to dBm if needed
        timestamp: Date.now(),
      });
    });
  });
}

module.exports = { scanViaNetsh };
```

Test this module standalone before wiring it into the API — run a small script that calls it every second and prints the result, so you know scanning works before adding complexity on top.

---

## Stage 4: Backend API (F01-F04)

`server/index.js`:
```javascript
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const { scanCurrentSignal } = require('./wifiScanner');
const { interpolateGrid } = require('./interpolation');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../public')));

const upload = multer({ dest: path.join(__dirname, '../uploads') });

// F12: create a floor (upload a floor plan)
app.post('/api/floors', upload.single('floorplan'), (req, res) => {
  const { name } = req.body;
  const imagePath = `/uploads/${req.file.filename}`;
  db.run(
    'INSERT INTO floors (name, image_path) VALUES (?, ?)',
    [name, imagePath],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, name, image_path: imagePath });
    }
  );
});

app.get('/api/floors', (req, res) => {
  db.all('SELECT * FROM floors', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// F02, F03: tag a position and take a reading
app.post('/api/samples', async (req, res) => {
  const { floor_id, x, y } = req.body;
  try {
    const reading = await scanCurrentSignal();
    db.run(
      `INSERT INTO samples (floor_id, x, y, rssi, ssid, bssid, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [floor_id, x, y, reading.rssi, reading.ssid, reading.bssid, reading.timestamp],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, ...reading, x, y, floor_id });
      }
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// F04: fetch all samples for a floor
app.get('/api/floors/:id/samples', (req, res) => {
  db.all(
    'SELECT * FROM samples WHERE floor_id = ? ORDER BY timestamp',
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// F05, F06: get interpolated heatmap grid for rendering
app.get('/api/floors/:id/heatmap', (req, res) => {
  const power = parseFloat(req.query.power) || 2; // F14: smoothing exponent
  db.all(
    'SELECT x, y, rssi FROM samples WHERE floor_id = ?',
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const grid = interpolateGrid(rows, power);
      res.json(grid);
    }
  );
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
```

Install the extra dependency this uses:
```bash
npm install multer
```

---

## Stage 5: Interpolation (F05, F14)

`server/interpolation.js`:
```javascript
// Inverse distance weighting, computed on a coarse grid for performance.
// gridSize controls resolution; smaller = finer but slower.
function interpolateGrid(samples, power = 2, gridSize = 20, width = 800, height = 600) {
  const grid = [];
  for (let gx = 0; gx <= width; gx += gridSize) {
    for (let gy = 0; gy <= height; gy += gridSize) {
      let weightedSum = 0;
      let weightTotal = 0;
      let exactMatch = null;

      for (const s of samples) {
        const dist = Math.hypot(gx - s.x, gy - s.y);
        if (dist < 1) {
          exactMatch = s.rssi;
          break;
        }
        const weight = 1 / Math.pow(dist, power);
        weightedSum += weight * s.rssi;
        weightTotal += weight;
      }

      const value = exactMatch !== null
        ? exactMatch
        : (weightTotal > 0 ? weightedSum / weightTotal : null);

      if (value !== null) {
        grid.push({ x: gx, y: gy, rssi: value });
      }
    }
  }
  return grid;
}

module.exports = { interpolateGrid };
```

`power` is your F14 smoothing control — higher values make the heatmap fall off more sharply around each sample point; lower values blend more smoothly across the whole floor plan.

---

## Stage 6: Frontend — floor plan and tagging UI (F01, F02)

`public/index.html`:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>WiFi Signal Mapper</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Campus WiFi Signal Mapper</h1>

  <div id="upload-section">
    <input type="file" id="floorplan-input" accept="image/*">
    <input type="text" id="floor-name" placeholder="Floor name">
    <button id="upload-btn">Upload floor plan</button>
  </div>

  <div id="controls">
    <label>Smoothing: <input type="range" id="smoothing" min="1" max="4" step="0.5" value="2"></label>
    <button id="scan-btn">Take reading at last clicked point</button>
    <span id="status"></span>
  </div>

  <canvas id="canvas" width="800" height="600"></canvas>

  <script src="app.js"></script>
</body>
</html>
```

---

## Stage 7: Frontend — canvas heatmap rendering (F06)

`public/app.js`:
```javascript
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let currentFloorId = null;
let floorImage = new Image();
let lastClick = null;

document.getElementById('upload-btn').onclick = async () => {
  const file = document.getElementById('floorplan-input').files[0];
  const name = document.getElementById('floor-name').value || 'Floor 1';
  if (!file) return alert('Choose an image first');

  const formData = new FormData();
  formData.append('floorplan', file);
  formData.append('name', name);

  const res = await fetch('/api/floors', { method: 'POST', body: formData });
  const floor = await res.json();
  currentFloorId = floor.id;
  floorImage.src = floor.image_path;
  floorImage.onload = drawFloorPlan;
};

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  lastClick = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  document.getElementById('status').textContent = `Point selected: (${Math.round(lastClick.x)}, ${Math.round(lastClick.y)})`;
});

document.getElementById('scan-btn').onclick = async () => {
  if (!currentFloorId) return alert('Upload a floor plan first');
  if (!lastClick) return alert('Click a point on the floor plan first');

  const res = await fetch('/api/samples', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ floor_id: currentFloorId, x: lastClick.x, y: lastClick.y }),
  });
  const sample = await res.json();
  document.getElementById('status').textContent = `Recorded: ${sample.rssi} at (${lastClick.x}, ${lastClick.y})`;
  loadHeatmap();
};

document.getElementById('smoothing').oninput = loadHeatmap;

function drawFloorPlan() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(floorImage, 0, 0, canvas.width, canvas.height);
}

function rssiToColor(rssi) {
  // Adjust this range to match whatever scale your scanner returns
  // (dBm typically -30 strong to -90 weak, or 0-100% quality)
  const clamped = Math.max(0, Math.min(100, rssi));
  const hue = (clamped / 100) * 120; // 0 = red (weak), 120 = green (strong)
  return `hsla(${hue}, 80%, 50%, 0.45)`;
}

async function loadHeatmap() {
  if (!currentFloorId) return;
  const power = document.getElementById('smoothing').value;
  const res = await fetch(`/api/floors/${currentFloorId}/heatmap?power=${power}`);
  const grid = await res.json();

  drawFloorPlan();
  const cellSize = 20;
  for (const point of grid) {
    ctx.fillStyle = rssiToColor(point.rssi);
    ctx.fillRect(point.x - cellSize / 2, point.y - cellSize / 2, cellSize, cellSize);
  }
}
```

---

## Stage 8: Conducting the actual survey

This is the data-collection phase, and the quality of your final heatmap depends entirely on it:

1. Upload your floor plan and give the floor a name.
2. Walk to a physical location in the room.
3. Click the matching point on the floor plan image on screen (as accurately as you can).
4. Click "Take reading" — this captures the WiFi signal at that instant.
5. Repeat every 1.5-2 meters across the whole space. More points near walls, corners, and doorways (common dead zones) than in open floor area.
6. For F08 (congestion tracking), repeat the entire walk at a different time of day (e.g. during a busy lecture slot vs. after hours) on the same floor, and compare the two heatmaps.

Aim for at least 20-30 points for a single hall to get a heatmap that looks meaningfully smooth rather than blobby.

---

## Stage 9: Adding F07 (multi-AP comparison)

The schema already stores `ssid`/`bssid` per sample. Add a dropdown in the UI populated from distinct SSIDs seen so far, and filter the heatmap query by SSID:
```javascript
app.get('/api/floors/:id/heatmap', (req, res) => {
  const { ssid } = req.query;
  let query = 'SELECT x, y, rssi FROM samples WHERE floor_id = ?';
  const params = [req.params.id];
  if (ssid) {
    query += ' AND ssid = ?';
    params.push(ssid);
  }
  db.all(query, params, (err, rows) => {
    // ...interpolate and return as before
  });
});
```

---

## Stage 10: Adding F09 (dead-zone report)

Add an endpoint that scans all samples on a floor, flags anything below a threshold, and groups nearby weak points into named zones:
```javascript
app.get('/api/floors/:id/report', (req, res) => {
  const threshold = parseFloat(req.query.threshold) || 40; // adjust to your RSSI scale
  db.all('SELECT * FROM samples WHERE floor_id = ?', [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const weakSpots = rows.filter(s => s.rssi < threshold);
    res.json({
      totalSamples: rows.length,
      weakSpotCount: weakSpots.length,
      weakSpots: weakSpots.map(s => ({
        x: s.x, y: s.y, rssi: s.rssi, ssid: s.ssid,
        recommendation: 'Signal below threshold — consider a repeater or AP relocation nearby.',
      })),
    });
  });
});
```

For your report, present this as a table alongside the heatmap image.

---

## Stage 11: Adding F13 (PDF export)

```bash
npm install jspdf
```

In `app.js`, capture the canvas and export it:
```javascript
import { jsPDF } from 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm';

document.getElementById('export-btn').onclick = () => {
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'landscape' });
  pdf.addImage(imgData, 'PNG', 10, 10, 270, 180);
  pdf.save('wifi-heatmap.pdf');
};
```
(Add a matching `<button id="export-btn">Export as PDF</button>` to your HTML.)

---

## Stage 12: Running the app

```bash
node server/index.js
```
Then open `http://localhost:3000` in your browser and start the survey.

---

## Stage 13: Writing up the report

Structure your report around the narrative already defined in the project document (N1-N4):
1. **Data collection** — describe the survey method, how many points, which building/hall.
2. **Visualization** — show the heatmap(s), explain the color scale and IDW interpolation.
3. **Analysis** — compare AP coverage zones (F07) and congestion vs. distance (F08) with before/after heatmaps.
4. **Recommendations** — present the dead-zone report (F09) as your conclusion, with suggested fixes.

---

## Suggested build order recap

1. Stage 1-2: project + database
2. Stage 3: verify RSSI scanning works standalone (don't skip this test)
3. Stage 4-5: backend API + interpolation
4. Stage 6-7: frontend upload, tagging, heatmap
5. Stage 8: run a real survey to confirm the full loop works
6. Stage 9-11: layer in F07, F09, F13 once the core loop is solid
7. Stage 12-13: run properly, then write up results
