"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
exports.notFoundHandler = notFoundHandler;
function errorHandler(err, _req, res, _next) {
    console.error('Error:', err.message);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
}
function notFoundHandler(_req, res) {
    res.status(404).json({ error: 'Route not found' });
}
//# sourceMappingURL=errorHandler.js.map