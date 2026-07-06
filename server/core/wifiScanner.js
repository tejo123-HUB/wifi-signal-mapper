const wifi = require('node-wifi');
const { exec } = require('child_process');
const { sendError } = require('./apiError');

wifi.init({ iface: null });

// RSSI scale used consistently everywhere downstream: 0-100 quality percentage
// (not dBm). node-wifi's quality is used when available; the netsh fallback
// already reports a 0-100 "Signal" percentage on Windows.
async function scanCurrentSignal() {
  try {
    const connections = await wifi.getCurrentConnections();
    if (connections && connections.length > 0) {
      const conn = connections[0];
      // node-wifi's Windows netsh parser is unreliable across netsh output
      // variants and can report NaN (typeof 'number' but useless) — require
      // a real finite value before trusting it, otherwise fall back below.
      if (Number.isFinite(conn.quality)) {
        return {
          ssid: conn.ssid || null,
          bssid: conn.bssid || null,
          rssi: conn.quality,
          timestamp: Date.now(),
        };
      }
    }
  } catch (e) {
    // fall through to netsh
  }
  return scanViaNetsh();
}

function scanViaNetsh() {
  return new Promise((resolve, reject) => {
    exec('netsh wlan show interfaces', (err, stdout) => {
      if (err) return reject(new Error('Unable to read WiFi interface: ' + err.message));
      const ssidMatch = stdout.match(/^\s*SSID\s*:\s*(.+)$/m);
      const bssidMatch = stdout.match(/^\s*(?:AP )?BSSID\s*:\s*(.+)$/m);
      const signalMatch = stdout.match(/^\s*Signal\s*:\s*(\d+)%/m);
      if (!signalMatch) return reject(new Error('No signal data found — is WiFi connected?'));
      resolve({
        ssid: ssidMatch ? ssidMatch[1].trim() : null,
        bssid: bssidMatch ? bssidMatch[1].trim() : null,
        rssi: parseInt(signalMatch[1], 10),
        timestamp: Date.now(),
      });
    });
  });
}

function register(app, db) {
  app.get('/api/scan', async (req, res) => {
    try {
      res.json(await scanCurrentSignal());
    } catch (e) {
      sendError(res, e);
    }
  });

  // F02/F03/F04: capture a reading at a tagged point and store it
  app.post('/api/samples', async (req, res) => {
    const { floor_id, x, y } = req.body;
    if (floor_id == null || x == null || y == null) {
      return res.status(400).json({ error: 'floor_id, x, and y are required' });
    }
    try {
      const reading = await scanCurrentSignal();
      db.run(
        `INSERT INTO samples (floor_id, x, y, rssi, timestamp) VALUES (?, ?, ?, ?, ?)`,
        [floor_id, x, y, reading.rssi, reading.timestamp],
        function (err) {
          if (err) return sendError(res, err);
          res.json({ id: this.lastID, floor_id, x, y, ...reading });
        }
      );
    } catch (e) {
      sendError(res, e);
    }
  });

  app.get('/api/floors/:id/samples', (req, res) => {
    db.all(
      'SELECT * FROM samples WHERE floor_id = ? ORDER BY timestamp',
      [req.params.id],
      (err, rows) => {
        if (err) return sendError(res, err);
        res.json(rows);
      }
    );
  });
}

module.exports = { scanCurrentSignal, register };
