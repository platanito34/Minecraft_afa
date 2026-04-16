const express = require('express');
const { query, queryOne } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/notifications — Notificaciones del usuario actual
router.get('/', async (req, res, next) => {
  try {
    const { unread_only, limit = 30 } = req.query;
    let sql = `
      SELECT n.*, p.username AS player_name
      FROM panel_notifications n
      LEFT JOIN panel_players p ON p.id = n.player_id
      WHERE n.user_id = ?
    `;
    const params = [req.user.id];
    if (unread_only === 'true') { sql += ' AND n.read_at IS NULL'; }
    sql += ' ORDER BY n.sent_at DESC LIMIT ?';
    params.push(parseInt(limit));
    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req, res, next) => {
  try {
    const row = await queryOne(
      'SELECT COUNT(*) AS count FROM panel_notifications WHERE user_id = ? AND read_at IS NULL',
      [req.user.id]
    );
    res.json({ count: row.count });
  } catch (err) { next(err); }
});

// PATCH /api/notifications/:id/read — Marcar como leída
router.patch('/:id/read', async (req, res, next) => {
  try {
    await query(
      'UPDATE panel_notifications SET read_at = NOW() WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Marcada como leída' });
  } catch (err) { next(err); }
});

// PATCH /api/notifications/read-all — Marcar todas como leídas
router.patch('/read-all', async (req, res, next) => {
  try {
    await query(
      'UPDATE panel_notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL',
      [req.user.id]
    );
    res.json({ message: 'Todas marcadas como leídas' });
  } catch (err) { next(err); }
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await query(
      'DELETE FROM panel_notifications WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Notificación eliminada' });
  } catch (err) { next(err); }
});

module.exports = router;
