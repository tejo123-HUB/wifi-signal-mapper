// Inverse distance weighting, computed on a coarse grid for performance.
// power is the F14 smoothing control: higher values fall off more sharply
// around each sample; lower values blend more smoothly across the floor.
function interpolateGrid(samples, { power = 2, gridSize = 20, width = 1000, height = 700 } = {}) {
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

      const value =
        exactMatch !== null ? exactMatch : weightTotal > 0 ? weightedSum / weightTotal : null;

      if (value !== null) {
        grid.push({ x: gx, y: gy, rssi: value });
      }
    }
  }
  return grid;
}

function register(app, db) {
  app.get('/api/floors/:id/heatmap', (req, res) => {
    const power = parseFloat(req.query.power) || 2;
    const width = parseInt(req.query.width, 10) || 1000;
    const height = parseInt(req.query.height, 10) || 700;
    db.all('SELECT x, y, rssi FROM samples WHERE floor_id = ?', [req.params.id], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(interpolateGrid(rows, { power, width, height }));
    });
  });
}

module.exports = { interpolateGrid, register };
