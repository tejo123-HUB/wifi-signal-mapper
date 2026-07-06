const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./core/db');
const { enabledModules } = require('./features.config');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../public')));

require('./core/floorplanBuilder').register(app, db);
require('./core/wifiScanner').register(app, db);
require('./core/interpolation').register(app, db);

async function start() {
  for (const name of enabledModules) {
    const mod = require(`./modules/${name}`);
    await mod.migrate?.(db);
    mod.register(app, db);
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

start();
