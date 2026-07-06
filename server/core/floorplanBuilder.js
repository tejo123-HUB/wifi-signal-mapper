const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { sendError } = require('./apiError');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename(req, file, cb) {
    cb(null, crypto.randomUUID() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

function register(app, db) {
  // F12 groundwork: floors are created here, multiFloor module adds the switcher UI
  app.post('/api/floors', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    db.run('INSERT INTO floors (name) VALUES (?)', [name], function (err) {
      if (err) return sendError(res, err);
      res.json({ id: this.lastID, name });
    });
  });

  app.get('/api/floors', (req, res) => {
    db.all('SELECT * FROM floors', [], (err, rows) => {
      if (err) return sendError(res, err);
      res.json(rows);
    });
  });

  // F01: upload a room photo, attached to a floor, with an initial arrangement
  app.post('/api/floors/:id/rooms', upload.single('photo'), (req, res) => {
    const floorId = Number(req.params.id);
    const { x = 0, y = 0, width = 200, height = 150, label = '' } = req.body;
    if (!req.file) return res.status(400).json({ error: 'photo file is required' });
    const imagePath = `/uploads/${req.file.filename}`;
    db.run(
      `INSERT INTO rooms (floor_id, image_path, x, y, width, height, label) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [floorId, imagePath, x, y, width, height, label],
      function (err) {
        if (err) return sendError(res, err);
        res.json({
          id: this.lastID,
          floor_id: floorId,
          image_path: imagePath,
          x: Number(x),
          y: Number(y),
          width: Number(width),
          height: Number(height),
          label,
        });
      }
    );
  });

  app.get('/api/floors/:id/rooms', (req, res) => {
    db.all('SELECT * FROM rooms WHERE floor_id = ?', [req.params.id], (err, rows) => {
      if (err) return sendError(res, err);
      res.json(rows);
    });
  });

  // F02: persist drag/resize arrangement
  app.put('/api/rooms/:id', (req, res) => {
    const { x, y, width, height } = req.body;
    if ([x, y, width, height].some((v) => v == null)) {
      return res.status(400).json({ error: 'x, y, width, and height are required' });
    }
    db.run(
      `UPDATE rooms SET x = ?, y = ?, width = ?, height = ? WHERE id = ?`,
      [x, y, width, height, req.params.id],
      function (err) {
        if (err) return sendError(res, err);
        if (this.changes === 0) return res.status(404).json({ error: 'room not found' });
        res.json({ id: Number(req.params.id), x, y, width, height });
      }
    );
  });
}

module.exports = { register };
