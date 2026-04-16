const jwt = require('jsonwebtoken');
const { queryOne } = require('../config/database');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticación requerido' });
    }

    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await queryOne(
      'SELECT id, email, name, role, active, language FROM panel_users WHERE id = ?',
      [payload.userId]
    );

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Usuario no encontrado o desactivado' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
}

module.exports = { authenticate };
