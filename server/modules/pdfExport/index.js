// pdfExport is a pure frontend feature (canvas-to-PDF, no server data
// needed) — this backend half exists only so the module follows the same
// contract as every other module and is safe to list in either
// features.config.js without special-casing it in server/index.js's loader.
module.exports = { id: 'pdfExport', dependsOn: [], register() {} };
