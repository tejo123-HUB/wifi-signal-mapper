// parseFloat(x) || default treats an explicit 0 the same as missing/invalid —
// this only falls back to the default when the param is actually absent.
function queryNumber(req, key, defaultValue) {
  const raw = req.query[key];
  if (raw === undefined || raw === '') return defaultValue;
  const parsed = parseFloat(raw);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

module.exports = { queryNumber };
