function sendError(res, err, status = 500) {
  res.status(status).json({ error: err.message });
}

module.exports = { sendError };
