process.env.VERCEL = process.env.VERCEL || '1';

const app = require('../ceo-dashboard/backend/dist/server').default;

module.exports = app;
