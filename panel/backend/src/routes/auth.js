const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, queryOne } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    const user = await queryOne(
      'SELECT id, email, name, role, active, language, password_hash FROM panel_users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    await query('UPDATE panel_users SET last_login = NOW() WHERE id = ?', [user.id]);

    const token = signToken(user.id);
    const { password_hash, ...userData } = user;

    res.json({ token, user: userData });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Contraseñas requeridas' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
    }

    const user = await queryOne('SELECT password_hash FROM panel_users WHERE id = ?', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hash = await bcrypt.hash(newPassword, rounds);
    await query('UPDATE panel_users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);

    res.json({ message: 'Contraseña cambiada correctamente' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
