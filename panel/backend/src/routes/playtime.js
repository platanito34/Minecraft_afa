const express = require('express');
const { query, queryOne } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { getTGEPlaytime, recordLogin, recordLogout } = require('../services/playtimeService');

const router = express.Router();
router.use(authenticate);

// ─── Filtro de jugadores según rol ───────────────────────────────────────────
async function buildPlayerFilter(user) {
  if (user.role === 'admin') return { where: '1=1', params: [] };
  if (user.role === 'teacher') {
    return {
      where: `p.id IN (
        SELECT cp.player_id FROM panel_class_players cp
        JOIN panel_classes c ON c.id = cp.class_id
        WHERE c.teacher_id = ?
      )`,
      params: [user.id],
    };
  }
  // parent
  return {
    where: `p.id IN (
      SELECT pp.player_id FROM panel_parent_players pp
      WHERE pp.parent_id = ?
    )`,
    params: [user.id],
  };
}

// ─── POST /api/playtime/login ─────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { uuid, username, server_id } = req.body;
    if (!uuid || !username) {
      return res.status(400).json({ error: 'uuid y username son obligatorios' });
    }
    const result = await recordLogin(uuid, username, server_id || null);
    res.status(201).json({ player: result.player, sessionId: result.sessionId });
  } catch (err) { next(err); }
});

// ─── POST /api/playtime/logout ────────────────────────────────────────────────
router.post('/logout', async (req, res, next) => {
  try {
    const { uuid } = req.body;
    if (!uuid) return res.status(400).json({ error: 'uuid es obligatorio' });
    const result = await recordLogout(uuid);
    if (!result) return res.status(404).json({ error: 'Jugador no encontrado' });
    res.json({ player: result.player, session: result.session });
  } catch (err) { next(err); }
});

// ─── GET /api/playtime/summary ────────────────────────────────────────────────
// Devuelve por cada jugador:
//   · total_minutes  → acumulado de por vida, leído de PlaytimeTrackerTGE (play_minutes)
//   · last_seen      → última vez visto según TGE (ms Unix convertido a ISO)
//   · minutes_today  → tiempo de HOY desde panel_play_sessions
//   · minutes_week   → tiempo esta semana desde panel_play_sessions
//   · minutes_month  → tiempo este mes  desde panel_play_sessions
//   · limit_reached  → boolean comparando minutes_today con daily_limit_minutes
router.get('/summary', async (req, res, next) => {
  try {
    const { where, params } = await buildPlayerFilter(req.user);

    // Base: jugadores + límites configurados
    const players = await query(`
      SELECT
        p.id,
        p.uuid,
        p.username,
        p.display_name,
        pl.daily_limit_minutes,
        pl.weekly_limit_minutes,
        pl.allowed_start_time,
        pl.allowed_end_time,
        pl.allowed_days,
        pl.kick_on_limit
      FROM panel_players p
      LEFT JOIN panel_playtime_limits pl ON pl.player_id = p.id
      WHERE ${where}
      ORDER BY p.username
    `, params);

    if (!players.length) return res.json([]);

    const playerIds = players.map(p => p.id);
    const placeholders = playerIds.map(() => '?').join(',');

    // ── Tiempo HOY (panel_play_sessions) ─────────────────────────────────────
    const todayRows = await query(`
      SELECT
        player_id,
        COALESCE(SUM(TIMESTAMPDIFF(MINUTE, login_at, IFNULL(logout_at, NOW()))), 0) AS minutes_today
      FROM panel_play_sessions
      WHERE player_id IN (${placeholders})
        AND DATE(login_at) = CURDATE()
      GROUP BY player_id
    `, playerIds);
    const todayMap = Object.fromEntries(todayRows.map(r => [r.player_id, Number(r.minutes_today)]));

    // ── Tiempo SEMANA (panel_play_sessions) ──────────────────────────────────
    const weekRows = await query(`
      SELECT
        player_id,
        COALESCE(SUM(TIMESTAMPDIFF(MINUTE, login_at, IFNULL(logout_at, NOW()))), 0) AS minutes_week
      FROM panel_play_sessions
      WHERE player_id IN (${placeholders})
        AND YEARWEEK(login_at, 1) = YEARWEEK(NOW(), 1)
      GROUP BY player_id
    `, playerIds);
    const weekMap = Object.fromEntries(weekRows.map(r => [r.player_id, Number(r.minutes_week)]));

    // ── Tiempo MES (panel_play_sessions) ─────────────────────────────────────
    const monthRows = await query(`
      SELECT
        player_id,
        COALESCE(SUM(TIMESTAMPDIFF(MINUTE, login_at, IFNULL(logout_at, NOW()))), 0) AS minutes_month
      FROM panel_play_sessions
      WHERE player_id IN (${placeholders})
        AND MONTH(login_at) = MONTH(NOW())
        AND YEAR(login_at)  = YEAR(NOW())
      GROUP BY player_id
    `, playerIds);
    const monthMap = Object.fromEntries(monthRows.map(r => [r.player_id, Number(r.minutes_month)]));

    // ── Total de por vida desde PlaytimeTrackerTGE ────────────────────────────
    // Leemos en paralelo para no encadenar N queries secuenciales
    const tgeResults = await Promise.all(
      players.map(p => getTGEPlaytime(p.uuid))
    );
    const tgeMap = Object.fromEntries(
      players.map((p, i) => [p.id, tgeResults[i]])
    );

    // ── Construir respuesta ───────────────────────────────────────────────────
    const result = players.map(p => {
      const tge          = tgeMap[p.id];
      const minutesToday = todayMap[p.id] || 0;

      return {
        id:              p.id,
        uuid:            p.uuid,
        username:        p.username,
        display_name:    p.display_name,

        // De PlaytimeTrackerTGE
        total_minutes:   tge?.totalMinutes ?? null,
        last_seen:       tge?.lastSeen?.toISOString() ?? null,
        first_join:      tge?.firstJoin?.toISOString() ?? null,
        tge_available:   tge !== null,

        // De panel_play_sessions (periodos parciales)
        minutes_today:   minutesToday,
        minutes_week:    weekMap[p.id]  || 0,
        minutes_month:   monthMap[p.id] || 0,

        // Límites configurados
        daily_limit_minutes:  p.daily_limit_minutes,
        weekly_limit_minutes: p.weekly_limit_minutes,
        allowed_start_time:   p.allowed_start_time,
        allowed_end_time:     p.allowed_end_time,
        allowed_days:         p.allowed_days,
        kick_on_limit:        p.kick_on_limit,

        // Estado
        limit_reached: p.daily_limit_minutes
          ? minutesToday >= p.daily_limit_minutes
          : false,
      };
    });

    res.json(result);
  } catch (err) { next(err); }
});

// ─── GET /api/playtime/alerts ─────────────────────────────────────────────────
// Jugadores que han superado su límite diario hoy
router.get('/alerts', async (req, res, next) => {
  try {
    const { where, params } = await buildPlayerFilter(req.user);

    const rows = await query(`
      SELECT
        p.id,
        p.uuid,
        p.username,
        p.display_name,
        pl.daily_limit_minutes,
        COALESCE(
          SUM(TIMESTAMPDIFF(MINUTE, ps.login_at, IFNULL(ps.logout_at, NOW()))),
          0
        ) AS minutes_today
      FROM panel_players p
      JOIN  panel_playtime_limits pl ON pl.player_id = p.id
      LEFT JOIN panel_play_sessions ps
             ON ps.player_id = p.id AND DATE(ps.login_at) = CURDATE()
      WHERE pl.daily_limit_minutes IS NOT NULL AND ${where}
      GROUP BY p.id, p.uuid, p.username, p.display_name, pl.daily_limit_minutes
      HAVING minutes_today >= pl.daily_limit_minutes
      ORDER BY p.username
    `, params);

    res.json(rows.map(r => ({ ...r, minutes_today: Number(r.minutes_today) })));
  } catch (err) { next(err); }
});

// ─── GET /api/playtime/:playerId ──────────────────────────────────────────────
// Detalle completo de un jugador: datos TGE + sesiones propias
router.get('/:playerId', async (req, res, next) => {
  try {
    const player = await queryOne(
      'SELECT * FROM panel_players WHERE id = ?', [req.params.playerId]
    );
    if (!player) return res.status(404).json({ error: 'Jugador no encontrado' });

    const [tge, todayRow, weekRow, monthRow] = await Promise.all([
      getTGEPlaytime(player.uuid),
      queryOne(`
        SELECT COALESCE(SUM(TIMESTAMPDIFF(MINUTE, login_at, IFNULL(logout_at, NOW()))), 0) AS m
        FROM panel_play_sessions WHERE player_id = ? AND DATE(login_at) = CURDATE()
      `, [player.id]),
      queryOne(`
        SELECT COALESCE(SUM(TIMESTAMPDIFF(MINUTE, login_at, IFNULL(logout_at, NOW()))), 0) AS m
        FROM panel_play_sessions WHERE player_id = ? AND YEARWEEK(login_at, 1) = YEARWEEK(NOW(), 1)
      `, [player.id]),
      queryOne(`
        SELECT COALESCE(SUM(TIMESTAMPDIFF(MINUTE, login_at, IFNULL(logout_at, NOW()))), 0) AS m
        FROM panel_play_sessions
        WHERE player_id = ? AND MONTH(login_at) = MONTH(NOW()) AND YEAR(login_at) = YEAR(NOW())
      `, [player.id]),
    ]);

    res.json({
      id:            player.id,
      uuid:          player.uuid,
      username:      player.username,
      display_name:  player.display_name,
      total_minutes: tge?.totalMinutes ?? null,
      last_seen:     tge?.lastSeen?.toISOString() ?? null,
      first_join:    tge?.firstJoin?.toISOString() ?? null,
      tge_available: tge !== null,
      minutes_today: Number(todayRow?.m) || 0,
      minutes_week:  Number(weekRow?.m)  || 0,
      minutes_month: Number(monthRow?.m) || 0,
    });
  } catch (err) { next(err); }
});

// ─── GET /api/playtime/:playerId/history ─────────────────────────────────────
// Historial diario desde panel_play_sessions (últimos N días)
router.get('/:playerId/history', async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const history = await query(`
      SELECT
        DATE(login_at)                                                         AS date,
        COALESCE(SUM(TIMESTAMPDIFF(MINUTE, login_at, IFNULL(logout_at, NOW()))), 0) AS minutes_played
      FROM panel_play_sessions
      WHERE player_id = ?
        AND login_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(login_at)
      ORDER BY date ASC
    `, [req.params.playerId, parseInt(days)]);

    res.json(history.map(r => ({ ...r, minutes_played: Number(r.minutes_played) })));
  } catch (err) { next(err); }
});

module.exports = router;
