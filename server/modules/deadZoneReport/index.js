const { sendError } = require('../../core/apiError');

// Groups weak samples that are physically close together (within
// clusterRadius canvas units) into named zones, rather than reporting
// every individual weak point separately.
function clusterWeakSpots(weakSamples, clusterRadius = 100) {
  const zones = [];
  for (const s of weakSamples) {
    const zone = zones.find((z) =>
      z.points.some((p) => Math.hypot(p.x - s.x, p.y - s.y) <= clusterRadius)
    );
    if (zone) {
      zone.points.push(s);
    } else {
      zones.push({ points: [s] });
    }
  }

  return zones.map((zone, i) => {
    const n = zone.points.length;
    const centerX = zone.points.reduce((sum, p) => sum + p.x, 0) / n;
    const centerY = zone.points.reduce((sum, p) => sum + p.y, 0) / n;
    const averageRssi = zone.points.reduce((sum, p) => sum + p.rssi, 0) / n;
    return {
      zoneId: i + 1,
      centerX: Math.round(centerX),
      centerY: Math.round(centerY),
      sampleCount: n,
      averageRssi: Math.round(averageRssi * 10) / 10,
      recommendation:
        averageRssi < 20
          ? 'Signal critically weak — recommend adding a repeater or relocating an access point near this zone.'
          : 'Signal below threshold — consider a repeater or AP placement change nearby.',
    };
  });
}

function register(app, db) {
  app.get('/api/floors/:id/report', (req, res) => {
    const threshold = parseFloat(req.query.threshold) || 40;
    db.all('SELECT * FROM samples WHERE floor_id = ?', [req.params.id], (err, rows) => {
      if (err) return sendError(res, err);
      const weakSpots = rows.filter((s) => s.rssi < threshold);
      res.json({
        threshold,
        totalSamples: rows.length,
        weakSpotCount: weakSpots.length,
        zones: clusterWeakSpots(weakSpots),
      });
    });
  });
}

module.exports = { id: 'deadZoneReport', dependsOn: [], register };
