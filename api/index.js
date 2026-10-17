process.env.VERCEL = process.env.VERCEL || '1';

let app;
try {
  app = require('../ceo-dashboard/backend/dist/server').default;
} catch (err) {
  const message = (err && err.message) ? err.message : String(err);
  console.error('[startup] application failed to initialize:', message);
  app = (req, res) => {
    res.status(500).type('text/plain').send('[startup] ' + message);
  };
}

module.exports = app;
