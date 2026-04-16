const express = require('express');
const bcrypt = require('bcryptjs');
const { query, queryOne } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRole, requireMinRole } = require('../middleware/roles');

const router = express.Router();
router.use(authenticate);

// GET /api/users — Listar usuarios (admin: todos; teacher: solo padres de su clase)
router.get('/', requireMinRole('teacher'), async (req, res, next) => {
  try {
    let rows;
    if (req.user.role === 'admin') {
      rows = await query(
        'SELECT id, email, name, role, active, language, last_login, created_at FROM panel_users ORDER BY name'
      );
    } else {
      // Teacher: ver padres que tienen hijos en sus clases
      rows = await query(`
        SELECT DISTINCT pu.id, pu.email, pu.name, pu.role, pu.active, pu.language, pu.last_login
        FROM panel_users pu
        JOIN panel_parent_players pp ON pp.parent_id = pu.id
        JOIN panel_class_players cp ON cp.player_id = pp.player_id
        JOIN panel_classes c ON c.id = cp.class_id
        WHERE c.teacher_id = ? AND pu.role = 'parent'
        ORDER BY pu.name
      `, [req.user.id]);
    }
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/users/:id
router.get('/:id', requireMinRole('teacher'), async (req, res, next) => {
  try {
    const user = await queryOne(
      'SELECT id, email, name, role, active, language, last_login, created_at FROM panel_users WHERE id = ?',
      [req.params.id]
    );
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch (err) { next(err); }
});

// POST /api/users — Crear usuario (solo admin)
router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { email, password, name, role, language } = req.body;
    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'Campos obligatorios: email, password, name, role' });
    }
    const validRoles = ['admin', 'teacher', 'parent'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hash = await bcrypt.hash(password, rounds);
    const result = await query(
      'INSERT INTO panel_users (email, password_hash, name, role, language) VALUES (?, ?, ?, ?, ?)',
      [email.toLowerCase().trim(), hash, name, role, language || 'es']
    );
    const newUser = await queryOne(
      'SELECT id, email, name, role, active, language FROM panel_users WHERE id = ?',
      [result.insertId]
    );
    res.status(201).json(newUser);
  } catch (err) { next(err); }
});

// PATCH /api/users/:id
router.patch('/:id', requireMinRole('teacher'), async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.id);
    // Un padre solo puede editar su propio perfil
    if (req.user.role === 'parent' && req.user.id !== targetId) {
      return res.status(403).json({ error: 'Sin permisos' });
    }
    const { name, language, active, role } = req.body;
    const fields = [];
    const values = [];
    if (name !== undefined)     { fields.push('name = ?');     values.push(name); }
    if (language !== undefined) { fields.push('language = ?'); values.push(language); }
    if (active !== undefined && req.user.role === 'admin') {
      fields.push('active = ?'); values.push(active ? 1 : 0);
    }
    if (role !== undefined && req.user.role === 'admin') {
      fields.push('role = ?'); values.push(role);
    }
    if (!fields.length) return res.status(400).json({ error: 'Nada que actualizar' });
    values.push(targetId);
    await query(`UPDATE panel_users SET ${fields.join(', ')} WHERE id = ?`, values);
    const updated = await queryOne(
      'SELECT id, email, name, role, active, language FROM panel_users WHERE id = ?',
      [targetId]
    );
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/users/:id (solo admin)
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
    }
    await query('DELETE FROM panel_users WHERE id = ?', [req.params.id]);
    res.json({ message: 'Usuario eliminado' });
  } catch (err) { next(err); }
});

// GET /api/users/:id/players — Hijos asignados a un padre
router.get('/:id/players', authenticate, async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.id);
    if (req.user.role === 'parent' && req.user.id !== targetId) {
      return res.status(403).json({ error: 'Sin permisos' });
    }
    const players = await query(`
      SELECT p.id, p.uuid, p.username, p.display_name, p.active
      FROM panel_players p
      JOIN panel_parent_players pp ON pp.player_id = p.id
      WHERE pp.parent_id = ?
      ORDER BY p.username
    `, [targetId]);
    res.json(players);
  } catch (err) { next(err); }
});

// POST /api/users/:id/players — Asignar hijo a padre
router.post('/:id/players', requireMinRole('teacher'), async (req, res, next) => {
  try {
    const { playerId } = req.body;
    await query(
      'INSERT IGNORE INTO panel_parent_players (parent_id, player_id) VALUES (?, ?)',
      [req.params.id, playerId]
    );
    res.status(201).json({ message: 'Jugador asignado al padre' });
  } catch (err) { next(err); }
});

// DELETE /api/users/:id/players/:playerId
router.delete('/:id/players/:playerId', requireMinRole('teacher'), async (req, res, next) => {
  try {
    await query(
      'DELETE FROM panel_parent_players WHERE parent_id = ? AND player_id = ?',
      [req.params.id, req.params.playerId]
    );
    res.json({ message: 'Relación eliminada' });
  } catch (err) { next(err); }
});

module.exports = router;
