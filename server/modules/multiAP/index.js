const { interpolateGrid } = require('../../core/interpolation');
const { sendError } = require('../../core/apiError');

function columnExists(db, table, column) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${table})`, [], (err, cols) => {
      if (err) return reject(err);
      resolve(cols.some((c) => c.name === column));
    });
  });
}

async function migrate(db) {
  if (!(await columnExists(db, 'samples', 'ssid'))) {
    db.run('ALTER TABLE samples ADD COLUMN ssid TEXT');
  }
  if (!(await columnExists(db, 'samples', 'bssid'))) {
    db.run('ALTER TABLE samples ADD COLUMN bssid TEXT');
  }
}

function register(app, db) {
  app.get('/api/floors/:id/ssids', (req, res) => {
    db.all(
      'SELECT DISTINCT ssid FROM samples WHERE floor_id = ? AND ssid IS NOT NULL',
      [req.params.id],
      (err, rows) => {
        if (err) return sendError(res, err);
        res.json(rows.map((r) => r.ssid));
      }
    );
  });

  app.get('/api/floors/:id/heatmap-by-ssid', (req, res) => {
    const { ssid } = req.query;
    const power = parseFloat(req.query.power) || 2;
    const width = parseInt(req.query.width, 10) || 1000;
    const height = parseInt(req.query.height, 10) || 700;
    let query = 'SELECT x, y, rssi FROM samples WHERE floor_id = ?';
    const params = [req.params.id];
    if (ssid) {
      query += ' AND ssid = ?';
      params.push(ssid);
    }
    db.all(query, params, (err, rows) => {
      if (err) return sendError(res, err);
      res.json(interpolateGrid(rows, { power, width, height }));
    });
  });
}

module.exports = { id: 'multiAP', dependsOn: [], migrate, register };
