const logger = require('../config/logger');

function errorHandler(err, req, res, next) {
  logger.error(err.message, { stack: err.stack, path: req.path });

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message, details: err.details });
  }

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Ya existe un registro con esos datos' });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' && status === 500
      ? 'Error interno del servidor'
      : err.message,
  });
}

module.exports = errorHandler;
