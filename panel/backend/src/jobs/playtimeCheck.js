const { query } = require('../config/database');
const { checkPlayerLimits } = require('../services/playtimeService');
const logger = require('../config/logger');

async function runPlaytimeCheck(io) {
  // Verificar todos los jugadores que tienen límites configurados
  const players = await query(`
    SELECT DISTINCT p.id
    FROM panel_players p
    JOIN panel_playtime_limits l ON l.player_id = p.id
    WHERE p.active = 1
  `);

  for (const { id } of players) {
    try {
      await checkPlayerLimits(id, io);
    } catch (err) {
      logger.error(`Error verificando jugador ${id}: ${err.message}`);
    }
  }
}

module.exports = { runPlaytimeCheck };
