const path = require('path');

// Set VERCEL env var so server.ts knows to use Vercel paths
process.env.VERCEL = process.env.VERCEL || '1';

const app = require('../ceo-dashboard/backend/dist/server').default;

module.exports = app;
