const { query } = require('../config/database');
const { checkPlayerLimits } = require('../services/playtimeService');
const logger = require('../config/logger');

async function runPlaytimeCheck(io) {
  // Obtener todos los jugadores con sesión activa ahora mismo
  const activeSessions = await query(`
    SELECT DISTINCT ps.player_id
    FROM panel_play_sessions ps
    WHERE ps.logout_at IS NULL
      AND ps.login_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
  `);

  for (const { player_id } of activeSessions) {
    try {
      await checkPlayerLimits(player_id, io);
    } catch (err) {
      logger.error(`Error verificando jugador ${player_id}: ${err.message}`);
    }
  }

  // Cerrar sesiones huérfanas (login hace más de 12h sin logout)
  await query(`
    UPDATE panel_play_sessions
    SET logout_at = NOW(),
        duration_s = TIMESTAMPDIFF(SECOND, login_at, NOW())
    WHERE logout_at IS NULL
      AND login_at < DATE_SUB(NOW(), INTERVAL 12 HOUR)
  `);
}

module.exports = { runPlaytimeCheck };
