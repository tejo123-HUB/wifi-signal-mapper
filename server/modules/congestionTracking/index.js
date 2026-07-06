const { interpolateGrid } = require('../../core/interpolation');
const { sendError } = require('../../core/apiError');

function averageRssi(rows) {
  if (rows.length === 0) return null;
  return Math.round((rows.reduce((sum, r) => sum + r.rssi, 0) / rows.length) * 10) / 10;
}

function fetchRange(db, floorId, start, end) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT x, y, rssi FROM samples WHERE floor_id = ? AND timestamp BETWEEN ? AND ?',
      [floorId, start, end],
      (err, rows) => (err ? reject(err) : resolve(rows))
    );
  });
}

function register(app, db) {
  // F08: re-survey the same floor at two different times (e.g. peak lecture
  // hours vs. evening) and compare, to help tell distance-based weak signal
  // apart from congestion-based weak signal.
  app.get('/api/floors/:id/congestion', async (req, res) => {
    const { range1Start, range1End, range2Start, range2End } = req.query;
    if ([range1Start, range1End, range2Start, range2End].some((v) => v == null)) {
      return res
        .status(400)
        .json({ error: 'range1Start, range1End, range2Start, and range2End are required' });
    }
    const power = parseFloat(req.query.power) || 2;
    const width = parseInt(req.query.width, 10) || 1000;
    const height = parseInt(req.query.height, 10) || 700;
    const floorId = req.params.id;

    try {
      const [rows1, rows2] = await Promise.all([
        fetchRange(db, floorId, range1Start, range1End),
        fetchRange(db, floorId, range2Start, range2End),
      ]);
      res.json({
        range1: {
          sampleCount: rows1.length,
          averageRssi: averageRssi(rows1),
          grid: interpolateGrid(rows1, { power, width, height }),
        },
        range2: {
          sampleCount: rows2.length,
          averageRssi: averageRssi(rows2),
          grid: interpolateGrid(rows2, { power, width, height }),
        },
      });
    } catch (err) {
      sendError(res, err);
    }
  });
}

module.exports = { id: 'congestionTracking', dependsOn: [], register };
