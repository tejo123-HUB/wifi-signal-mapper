const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new sqlite3.Database(path.join(dataDir, 'wifi.db'));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS floors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      floor_id INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      width REAL NOT NULL,
      height REAL NOT NULL,
      label TEXT,
      FOREIGN KEY (floor_id) REFERENCES floors(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      floor_id INTEGER NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      rssi REAL NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (floor_id) REFERENCES floors(id)
    )
  `);
});

module.exports = db;
