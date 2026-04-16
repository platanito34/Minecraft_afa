const express = require('express');
const { query, queryOne } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Construir WHERE según rol
async function buildPlayerFilter(user) {
  if (user.role === 'admin') return { where: '1=1', params: [] };
  if (user.role === 'teacher') {
    return {
      where: `p.id IN (
        SELECT cp.player_id FROM panel_class_players cp
        JOIN panel_classes c ON c.id = cp.class_id WHERE c.teacher_id = ?
      )`,
      params: [user.id],
    };
  }
  return {
    where: `p.id IN (
      SELECT pp.player_id FROM panel_parent_players pp WHERE pp.parent_id = ?
    )`,
    params: [user.id],
  };
}

// GET /api/playtime/summary — Resumen hoy/semana/mes por jugador accesible
router.get('/summary', async (req, res, next) => {
  try {
    const { where, params } = await buildPlayerFilter(req.user);

    // Intentar obtener de PlaytimeTrackerTGE si existe, sino de panel_play_sessions
    let playtimeData;
    try {
      // PlaytimeTrackerTGE guarda el tiempo en segundos
      playtimeData = await query(`
        SELECT
          p.id, p.uuid, p.username, p.display_name,
          COALESCE(pt.playtime, 0) AS total_seconds,
          pl.daily_limit_minutes,
          pl.allowed_start_time,
          pl.allowed_end_time,
          pl.allowed_days
        FROM panel_players p
        LEFT JOIN playtime pt ON pt.uuid = p.uuid
        LEFT JOIN panel_playtime_limits pl ON pl.player_id = p.id
        WHERE ${where}
        ORDER BY p.username
      `, params);
    } catch (_) {
      // Tabla PlaytimeTrackerTGE no disponible — usar solo sesiones del panel
      playtimeData = await query(`
        SELECT
          p.id, p.uuid, p.username, p.display_name,
          0 AS total_seconds,
          pl.daily_limit_minutes,
          pl.allowed_start_time,
          pl.allowed_end_time,
          pl.allowed_days
        FROM panel_players p
        LEFT JOIN panel_playtime_limits pl ON pl.player_id = p.id
        WHERE ${where}
        ORDER BY p.username
      `, params);
    }

    // Tiempo hoy desde panel_play_sessions
    const today = await query(`
      SELECT ps.player_id,
        COALESCE(SUM(TIMESTAMPDIFF(SECOND, ps.login_at,
          IFNULL(ps.logout_at, NOW()))), 0) AS seconds_today
      FROM panel_play_sessions ps
      JOIN panel_players p ON p.id = ps.player_id
      WHERE DATE(ps.login_at) = CURDATE() AND ${where}
      GROUP BY ps.player_id
    `, params);

    const todayMap = Object.fromEntries(today.map(r => [r.player_id, r.seconds_today]));

    // Tiempo semana
    const week = await query(`
      SELECT ps.player_id,
        COALESCE(SUM(TIMESTAMPDIFF(SECOND, ps.login_at,
          IFNULL(ps.logout_at, NOW()))), 0) AS seconds_week
      FROM panel_play_sessions ps
      JOIN panel_players p ON p.id = ps.player_id
      WHERE YEARWEEK(ps.login_at, 1) = YEARWEEK(NOW(), 1) AND ${where}
      GROUP BY ps.player_id
    `, params);

    const weekMap = Object.fromEntries(week.map(r => [r.player_id, r.seconds_week]));

    // Tiempo mes
    const month = await query(`
      SELECT ps.player_id,
        COALESCE(SUM(TIMESTAMPDIFF(SECOND, ps.login_at,
          IFNULL(ps.logout_at, NOW()))), 0) AS seconds_month
      FROM panel_play_sessions ps
      JOIN panel_players p ON p.id = ps.player_id
      WHERE MONTH(ps.login_at) = MONTH(NOW())
        AND YEAR(ps.login_at) = YEAR(NOW()) AND ${where}
      GROUP BY ps.player_id
    `, params);

    const monthMap = Object.fromEntries(month.map(r => [r.player_id, r.seconds_month]));

    const result = playtimeData.map(p => ({
      ...p,
      seconds_today: todayMap[p.id] || 0,
      seconds_week: weekMap[p.id] || 0,
      seconds_month: monthMap[p.id] || 0,
      limit_reached: p.daily_limit_minutes
        ? (todayMap[p.id] || 0) >= p.daily_limit_minutes * 60
        : false,
    }));

    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/playtime/:playerId/history — Historial diario (últimos N días)
router.get('/:playerId/history', async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const history = await query(`
      SELECT
        DATE(login_at) AS date,
        SUM(TIMESTAMPDIFF(SECOND, login_at, IFNULL(logout_at, NOW()))) AS seconds_played
      FROM panel_play_sessions
      WHERE player_id = ?
        AND login_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(login_at)
      ORDER BY date ASC
    `, [req.params.playerId, parseInt(days)]);
    res.json(history);
  } catch (err) { next(err); }
});

// GET /api/playtime/alerts — Jugadores que han superado su límite hoy
router.get('/alerts', async (req, res, next) => {
  try {
    const { where, params } = await buildPlayerFilter(req.user);
    const alerts = await query(`
      SELECT
        p.id, p.uuid, p.username, p.display_name,
        pl.daily_limit_minutes,
        COALESCE(SUM(TIMESTAMPDIFF(SECOND, ps.login_at,
          IFNULL(ps.logout_at, NOW()))), 0) AS seconds_today
      FROM panel_players p
      JOIN panel_playtime_limits pl ON pl.player_id = p.id
      LEFT JOIN panel_play_sessions ps ON ps.player_id = p.id
        AND DATE(ps.login_at) = CURDATE()
      WHERE pl.daily_limit_minutes IS NOT NULL AND ${where}
      GROUP BY p.id, pl.daily_limit_minutes
      HAVING seconds_today >= pl.daily_limit_minutes * 60
      ORDER BY p.username
    `, params);
    res.json(alerts);
  } catch (err) { next(err); }
});

module.exports = router;
