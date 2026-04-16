const express = require('express');
const { query, queryOne } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireMinRole } = require('../middleware/roles');
const { getTGEPlaytime } = require('../services/playtimeService');

const router = express.Router();
router.use(authenticate);

// Helper: filtrar jugadores según rol
async function getAccessiblePlayers(user) {
  if (user.role === 'admin') {
    return query('SELECT id FROM panel_players WHERE active = 1');
  }
  if (user.role === 'teacher') {
    return query(`
      SELECT DISTINCT p.id FROM panel_players p
      JOIN panel_class_players cp ON cp.player_id = p.id
      JOIN panel_classes c ON c.id = cp.class_id
      WHERE c.teacher_id = ? AND p.active = 1
    `, [user.id]);
  }
  // parent
  return query(`
    SELECT p.id FROM panel_players p
    JOIN panel_parent_players pp ON pp.player_id = p.id
    WHERE pp.parent_id = ? AND p.active = 1
  `, [user.id]);
}

// GET /api/players
router.get('/', async (req, res, next) => {
  try {
    let players;
    if (req.user.role === 'admin') {
      players = await query(`
        SELECT p.*,
          (SELECT GROUP_CONCAT(c.name SEPARATOR ', ')
           FROM panel_class_players cp JOIN panel_classes c ON c.id = cp.class_id
           WHERE cp.player_id = p.id) AS classes
        FROM panel_players p ORDER BY p.username
      `);
    } else if (req.user.role === 'teacher') {
      players = await query(`
        SELECT DISTINCT p.*,
          (SELECT GROUP_CONCAT(c2.name SEPARATOR ', ')
           FROM panel_class_players cp2 JOIN panel_classes c2 ON c2.id = cp2.class_id
           WHERE cp2.player_id = p.id) AS classes
        FROM panel_players p
        JOIN panel_class_players cp ON cp.player_id = p.id
        JOIN panel_classes c ON c.id = cp.class_id
        WHERE c.teacher_id = ?
        ORDER BY p.username
      `, [req.user.id]);
    } else {
      players = await query(`
        SELECT p.*
        FROM panel_players p
        JOIN panel_parent_players pp ON pp.player_id = p.id
        WHERE pp.parent_id = ?
        ORDER BY p.username
      `, [req.user.id]);
    }
    const tgeResults = await Promise.all(players.map(p => getTGEPlaytime(p.uuid)));
    const withPlaytime = players.map((p, i) => ({
      ...p,
      total_minutes: tgeResults[i]?.totalMinutes ?? null,
      last_seen:     tgeResults[i]?.lastSeen?.toISOString() ?? null,
    }));
    res.json(withPlaytime);
  } catch (err) { next(err); }
});

// GET /api/players/:id
router.get('/:id', async (req, res, next) => {
  try {
    const player = await queryOne(
      'SELECT * FROM panel_players WHERE id = ?', [req.params.id]
    );
    if (!player) return res.status(404).json({ error: 'Jugador no encontrado' });

    // Verificar acceso
    if (req.user.role === 'parent') {
      const access = await queryOne(
        'SELECT id FROM panel_parent_players WHERE parent_id = ? AND player_id = ?',
        [req.user.id, player.id]
      );
      if (!access) return res.status(403).json({ error: 'Sin acceso a este jugador' });
    }

    const [limits, classes, servers, tge] = await Promise.all([
      queryOne('SELECT * FROM panel_playtime_limits WHERE player_id = ?', [player.id]),
      query(`
        SELECT c.id, c.name FROM panel_classes c
        JOIN panel_class_players cp ON cp.class_id = c.id
        WHERE cp.player_id = ?
      `, [player.id]),
      query(`
        SELECT s.id, s.name FROM panel_servers s
        JOIN panel_player_servers ps ON ps.server_id = s.id
        WHERE ps.player_id = ?
      `, [player.id]),
      getTGEPlaytime(player.uuid),
    ]);

    const totalMinutes = tge?.totalMinutes ?? null;
    res.json({
      ...player,
      limits,
      classes,
      servers,
      total_minutes:   totalMinutes,
      playtime_total:  totalMinutes,
      playtime_today:  totalMinutes,
      playtime_week:   totalMinutes,
      playtime_month:  totalMinutes,
      last_seen:       tge?.lastSeen?.toISOString() ?? null,
      first_join:      tge?.firstJoin?.toISOString() ?? null,
    });
  } catch (err) { next(err); }
});

// POST /api/players
router.post('/', requireMinRole('teacher'), async (req, res, next) => {
  try {
    const { uuid, username, display_name, notes } = req.body;
    if (!uuid || !username) {
      return res.status(400).json({ error: 'uuid y username son obligatorios' });
    }
    const result = await query(
      'INSERT INTO panel_players (uuid, username, display_name, notes) VALUES (?, ?, ?, ?)',
      [uuid, username, display_name || null, notes || null]
    );
    const player = await queryOne('SELECT * FROM panel_players WHERE id = ?', [result.insertId]);
    res.status(201).json(player);
  } catch (err) { next(err); }
});

// PATCH /api/players/:id
router.patch('/:id', requireMinRole('teacher'), async (req, res, next) => {
  try {
    const { username, display_name, notes, active } = req.body;
    const fields = [];
    const values = [];
    if (username !== undefined)     { fields.push('username = ?');     values.push(username); }
    if (display_name !== undefined) { fields.push('display_name = ?'); values.push(display_name); }
    if (notes !== undefined)        { fields.push('notes = ?');        values.push(notes); }
    if (active !== undefined)       { fields.push('active = ?');       values.push(active ? 1 : 0); }
    if (!fields.length) return res.status(400).json({ error: 'Nada que actualizar' });
    values.push(req.params.id);
    await query(`UPDATE panel_players SET ${fields.join(', ')} WHERE id = ?`, values);
    const updated = await queryOne('SELECT * FROM panel_players WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/players/:id
router.delete('/:id', requireMinRole('admin'), async (req, res, next) => {
  try {
    await query('DELETE FROM panel_players WHERE id = ?', [req.params.id]);
    res.json({ message: 'Jugador eliminado' });
  } catch (err) { next(err); }
});

// PUT /api/players/:id/limits — Establecer límites de tiempo
router.put('/:id/limits', requireMinRole('teacher'), async (req, res, next) => {
  try {
    const { daily_limit_minutes, weekly_limit_minutes, allowed_days,
            allowed_start_time, allowed_end_time, kick_on_limit, warn_at_minutes } = req.body;

    await query(`
      INSERT INTO panel_playtime_limits
        (player_id, daily_limit_minutes, weekly_limit_minutes, allowed_days,
         allowed_start_time, allowed_end_time, kick_on_limit, warn_at_minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        daily_limit_minutes = VALUES(daily_limit_minutes),
        weekly_limit_minutes = VALUES(weekly_limit_minutes),
        allowed_days = VALUES(allowed_days),
        allowed_start_time = VALUES(allowed_start_time),
        allowed_end_time = VALUES(allowed_end_time),
        kick_on_limit = VALUES(kick_on_limit),
        warn_at_minutes = VALUES(warn_at_minutes)
    `, [req.params.id, daily_limit_minutes || null, weekly_limit_minutes || null,
        allowed_days || null, allowed_start_time || null, allowed_end_time || null,
        kick_on_limit !== false ? 1 : 0, warn_at_minutes || null]);

    const limits = await queryOne(
      'SELECT * FROM panel_playtime_limits WHERE player_id = ?', [req.params.id]
    );
    res.json(limits);
  } catch (err) { next(err); }
});

// GET /api/players/:id/sessions — Historial de sesiones
router.get('/:id/sessions', async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const sessions = await query(`
      SELECT ps.*, s.name AS server_name
      FROM panel_play_sessions ps
      LEFT JOIN panel_servers s ON s.id = ps.server_id
      WHERE ps.player_id = ? AND ps.login_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      ORDER BY ps.login_at DESC
      LIMIT 200
    `, [req.params.id, parseInt(days)]);
    res.json(sessions);
  } catch (err) { next(err); }
});

module.exports = router;
