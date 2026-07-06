function columnExists(db, table, column) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${table})`, [], (err, cols) => {
      if (err) return reject(err);
      resolve(cols.some((c) => c.name === column));
    });
  });
}

async function addColumnIfMissing(db, table, column, definition) {
  if (!(await columnExists(db, table, column))) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

module.exports = { columnExists, addColumnIfMissing };
