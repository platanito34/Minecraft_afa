const express = require('express');
const { query, queryOne } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRole, requireMinRole } = require('../middleware/roles');

const router = express.Router();
router.use(authenticate);

// GET /api/classes
router.get('/', async (req, res, next) => {
  try {
    let classes;
    if (req.user.role === 'admin') {
      classes = await query(`
        SELECT c.*, u.name AS teacher_name,
          (SELECT COUNT(*) FROM panel_class_players WHERE class_id = c.id) AS player_count
        FROM panel_classes c
        LEFT JOIN panel_users u ON u.id = c.teacher_id
        ORDER BY c.name
      `);
    } else if (req.user.role === 'teacher') {
      classes = await query(`
        SELECT c.*, u.name AS teacher_name,
          (SELECT COUNT(*) FROM panel_class_players WHERE class_id = c.id) AS player_count
        FROM panel_classes c
        LEFT JOIN panel_users u ON u.id = c.teacher_id
        WHERE c.teacher_id = ?
        ORDER BY c.name
      `, [req.user.id]);
    } else {
      // parent: ver clases donde están sus hijos
      classes = await query(`
        SELECT DISTINCT c.*, u.name AS teacher_name
        FROM panel_classes c
        LEFT JOIN panel_users u ON u.id = c.teacher_id
        JOIN panel_class_players cp ON cp.class_id = c.id
        JOIN panel_parent_players pp ON pp.player_id = cp.player_id
        WHERE pp.parent_id = ?
        ORDER BY c.name
      `, [req.user.id]);
    }
    res.json(classes);
  } catch (err) { next(err); }
});

// GET /api/classes/:id
router.get('/:id', async (req, res, next) => {
  try {
    const cls = await queryOne(`
      SELECT c.*, u.name AS teacher_name
      FROM panel_classes c
      LEFT JOIN panel_users u ON u.id = c.teacher_id
      WHERE c.id = ?
    `, [req.params.id]);
    if (!cls) return res.status(404).json({ error: 'Clase no encontrada' });

    const players = await query(`
      SELECT p.id, p.uuid, p.username, p.display_name, p.active
      FROM panel_players p
      JOIN panel_class_players cp ON cp.player_id = p.id
      WHERE cp.class_id = ?
      ORDER BY p.username
    `, [req.params.id]);

    res.json({ ...cls, players });
  } catch (err) { next(err); }
});

// POST /api/classes
router.post('/', requireMinRole('teacher'), async (req, res, next) => {
  try {
    const { name, description, teacher_id } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });

    const tid = req.user.role === 'admin' ? (teacher_id || req.user.id) : req.user.id;
    const [result] = await query(
      'INSERT INTO panel_classes (name, description, teacher_id) VALUES (?, ?, ?)',
      [name, description || null, tid]
    );
    const cls = await queryOne('SELECT * FROM panel_classes WHERE id = ?', [result.insertId]);
    res.status(201).json(cls);
  } catch (err) { next(err); }
});

// PATCH /api/classes/:id
router.patch('/:id', requireMinRole('teacher'), async (req, res, next) => {
  try {
    const { name, description, teacher_id, active } = req.body;
    const fields = [];
    const values = [];
    if (name !== undefined)       { fields.push('name = ?');        values.push(name); }
    if (description !== undefined){ fields.push('description = ?'); values.push(description); }
    if (active !== undefined)     { fields.push('active = ?');      values.push(active ? 1 : 0); }
    if (teacher_id !== undefined && req.user.role === 'admin') {
      fields.push('teacher_id = ?'); values.push(teacher_id);
    }
    if (!fields.length) return res.status(400).json({ error: 'Nada que actualizar' });
    values.push(req.params.id);
    await query(`UPDATE panel_classes SET ${fields.join(', ')} WHERE id = ?`, values);
    const updated = await queryOne('SELECT * FROM panel_classes WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/classes/:id
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    await query('DELETE FROM panel_classes WHERE id = ?', [req.params.id]);
    res.json({ message: 'Clase eliminada' });
  } catch (err) { next(err); }
});

// POST /api/classes/:id/players — Añadir jugador a clase
router.post('/:id/players', requireMinRole('teacher'), async (req, res, next) => {
  try {
    const { player_id } = req.body;
    if (!player_id) return res.status(400).json({ error: 'player_id requerido' });
    await query(
      'INSERT IGNORE INTO panel_class_players (class_id, player_id) VALUES (?, ?)',
      [req.params.id, player_id]
    );
    res.status(201).json({ message: 'Jugador añadido a la clase' });
  } catch (err) { next(err); }
});

// DELETE /api/classes/:id/players/:playerId
router.delete('/:id/players/:playerId', requireMinRole('teacher'), async (req, res, next) => {
  try {
    await query(
      'DELETE FROM panel_class_players WHERE class_id = ? AND player_id = ?',
      [req.params.id, req.params.playerId]
    );
    res.json({ message: 'Jugador eliminado de la clase' });
  } catch (err) { next(err); }
});

module.exports = router;
