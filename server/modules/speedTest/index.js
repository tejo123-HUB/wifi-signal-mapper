const { sendError } = require('../../core/apiError');
const { addColumnIfMissing } = require('../../core/schema');

async function migrate(db) {
  await addColumnIfMissing(db, 'samples', 'download_mbps', 'REAL');
}

function register(app, db) {
  // The actual throughput measurement happens client-side (it needs to
  // measure the real link the surveyor's laptop has at that point); this
  // just persists the result against an already-created sample.
  app.patch('/api/samples/:id/speed', (req, res) => {
    const { download_mbps } = req.body;
    if (download_mbps == null) {
      return res.status(400).json({ error: 'download_mbps is required' });
    }
    db.run(
      'UPDATE samples SET download_mbps = ? WHERE id = ?',
      [download_mbps, req.params.id],
      function (err) {
        if (err) return sendError(res, err);
        if (this.changes === 0) return res.status(404).json({ error: 'sample not found' });
        res.json({ id: Number(req.params.id), download_mbps });
      }
    );
  });
}

module.exports = { id: 'speedTest', dependsOn: [], migrate, register };
