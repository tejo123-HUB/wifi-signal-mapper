const { sendError } = require('../../core/apiError');

function register(app, db) {
  // Core already supports creating/listing/switching floors (floor_id has
  // been part of the schema from the start). This module's incremental
  // addition is floor deletion.
  app.delete('/api/floors/:id', (req, res) => {
    const floorId = req.params.id;
    let failed = false;
    const failIfError = (err) => {
      if (err && !failed) {
        failed = true;
        sendError(res, err);
      }
    };
    db.serialize(() => {
      db.run('DELETE FROM samples WHERE floor_id = ?', [floorId], (err) => failIfError(err));
      db.run('DELETE FROM rooms WHERE floor_id = ?', [floorId], (err) => failIfError(err));
      db.run('DELETE FROM floors WHERE id = ?', [floorId], function (err) {
        if (failed) return;
        if (err) return failIfError(err);
        if (this.changes === 0) return res.status(404).json({ error: 'floor not found' });
        res.json({ deleted: Number(floorId) });
      });
    });
  });
}

module.exports = { id: 'multiFloor', dependsOn: [], register };
