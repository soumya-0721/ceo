process.env.VERCEL = process.env.VERCEL || '1';

let app;
let startupError;

function loadApp() {
  if (app !== undefined || startupError !== undefined) return app;
  try {
    app = require('../ceo-dashboard/backend/dist/server').default;
  } catch (err) {
    startupError = err;
    console.error('[startup] application failed to initialize:', (err && err.stack) || err);
  }
  return app;
}

module.exports = function handler(req, res) {
  const instance = loadApp();
  if (!instance) {
    const message = (startupError && startupError.message) ? startupError.message : 'application failed to initialize';
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('[startup] ' + message);
    return;
  }
  return instance(req, res);
};
