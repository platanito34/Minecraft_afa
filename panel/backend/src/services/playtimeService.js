const { query, queryOne } = require('../config/database');
const logger = require('../config/logger');

// ─────────────────────────────────────────────────────────────────────────────
// Capa de acceso a PlaytimeTrackerTGE
// Tabla: playtime  (uuid, username, play_minutes, first_join, last_seen)
// Notas:
//   · play_minutes  → entero, acumulado total de por vida, en MINUTOS
//   · first_join    → Unix timestamp en milisegundos
//   · last_seen     → Unix timestamp en milisegundos
//   · No contiene desglose por día; para tiempo diario usamos panel_play_sessions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lee el registro de un jugador en PlaytimeTrackerTGE.
 * Devuelve null si la tabla no existe o el jugador no tiene registro.
 */
async function getTGEPlaytime(uuid) {
  try {
    const row = await queryOne(
      'SELECT play_minutes, first_join, last_seen FROM playtime WHERE uuid = ?',
      [uuid]
    );
    if (!row) return null;
    return {
      totalMinutes: Number(row.play_minutes) || 0,
      firstJoin: row.first_join ? new Date(Number(row.first_join)) : null,
      lastSeen:  row.last_seen  ? new Date(Number(row.last_seen))  : null,
    };
  } catch (err) {
    // La tabla puede no existir en instalaciones sin el plugin
    logger.warn(`PlaytimeTrackerTGE no disponible (${uuid}): ${err.message}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiempo diario — usa panel_play_sessions
// TGE solo guarda el acumulado de por vida; para "hoy" necesitamos las sesiones
// que el propio panel registra en login/logout.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minutos jugados HOY según panel_play_sessions.
 * La sesión abierta (logout_at IS NULL) se cuenta hasta NOW().
 */
async function getMinutesPlayedToday(playerId) {
  const row = await queryOne(`
    SELECT COALESCE(
      SUM(TIMESTAMPDIFF(MINUTE, login_at, IFNULL(logout_at, NOW()))),
      0
    ) AS minutes
    FROM panel_play_sessions
    WHERE player_id = ? AND DATE(login_at) = CURDATE()
  `, [playerId]);
  return Number(row?.minutes) || 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Verificación de límites (ejecutada por el cron cada minuto)
// ─────────────────────────────────────────────────────────────────────────────

async function checkPlayerLimits(playerId, io) {
  const player = await queryOne('SELECT * FROM panel_players WHERE id = ?', [playerId]);
  if (!player || !player.active) return;

  const limits = await queryOne(
    'SELECT * FROM panel_playtime_limits WHERE player_id = ?', [playerId]
  );
  if (!limits) return;

  // Tiempo de hoy en minutos (de panel_play_sessions)
  const minutesToday = await getMinutesPlayedToday(playerId);

  const now = new Date();
  const currentTime = now.toTimeString().substring(0, 5); // "HH:MM"
  const currentDay  = String(now.getDay());               // "0"=Dom … "6"=Sáb

  // ── Días permitidos ───────────────────────────────────────────────────────
  if (limits.allowed_days) {
    const allowedDays = limits.allowed_days.split(',').map(d => d.trim());
    if (!allowedDays.includes(currentDay)) {
      await kickPlayerForLimit(player, limits, io, minutesToday,
        'Hoy no está permitido jugar');
      return;
    }
  }

  // ── Horario permitido ─────────────────────────────────────────────────────
  if (limits.allowed_start_time && limits.allowed_end_time) {
    if (currentTime < limits.allowed_start_time || currentTime > limits.allowed_end_time) {
      await kickPlayerForLimit(player, limits, io, minutesToday,
        `Fuera del horario permitido (${limits.allowed_start_time} - ${limits.allowed_end_time})`);
      return;
    }
  }

  // ── Límite diario ─────────────────────────────────────────────────────────
  if (limits.daily_limit_minutes && minutesToday >= limits.daily_limit_minutes) {
    await kickPlayerForLimit(player, limits, io, minutesToday,
      'Has alcanzado tu límite de tiempo diario');
    return;
  }

  // ── Aviso previo ──────────────────────────────────────────────────────────
  if (limits.daily_limit_minutes && limits.warn_at_minutes) {
    const minutesLeft = limits.daily_limit_minutes - minutesToday;
    if (minutesLeft > 0 && minutesLeft <= limits.warn_at_minutes) {
      await warnPlayer(player, minutesLeft, io);
    }
  }
}

async function kickPlayerForLimit(player, limits, io, minutesToday, reason) {
  if (!limits.kick_on_limit) return;

  const pterodactylService = require('./pterodactyl');

  const servers = await query(`
    SELECT s.* FROM panel_servers s
    JOIN panel_player_servers ps ON ps.server_id = s.id
    WHERE ps.player_id = ?
  `, [player.id]);

  for (const server of servers) {
    if (server.pterodactyl_server_id) {
      try {
        await pterodactylService.kickPlayer(
          server.pterodactyl_server_id, player.username, reason
        );
        logger.info(`Kick automático: ${player.username} → ${reason}`);
      } catch (err) {
        logger.error(`Error kickeando ${player.username}: ${err.message}`);
      }
    }
  }

  if (io) {
    io.emit('playtime:limit_reached', {
      playerId:   player.id,
      playerName: player.username,
      minutesToday,
      reason,
    });
  }

  await notifyParents(player, minutesToday, reason);
}

async function warnPlayer(player, minutesLeft, io) {
  if (io) {
    io.emit('playtime:warning', {
      playerId:   player.id,
      playerName: player.username,
      minutesLeft,
    });
  }
}

async function notifyParents(player, minutesToday, reason) {
  const emailService = require('./email');

  // Obtener total de TGE para el email (enriquece el mensaje)
  const tge = await getTGEPlaytime(player.uuid);

  const parents = await query(`
    SELECT pu.id, pu.name, pu.email
    FROM panel_users pu
    JOIN panel_parent_players pp ON pp.parent_id = pu.id
    WHERE pp.player_id = ?
  `, [player.id]);

  for (const parent of parents) {
    try {
      await query(`
        INSERT INTO panel_notifications (user_id, player_id, type, channel, title, body)
        VALUES (?, ?, 'limit_reached', 'web', ?, ?)
      `, [
        parent.id,
        player.id,
        `${player.username} ha alcanzado su límite de juego`,
        reason,
      ]);

      // Leer límite del jugador para mostrarlo en el email
      const limits = await queryOne(
        'SELECT daily_limit_minutes FROM panel_playtime_limits WHERE player_id = ?',
        [player.id]
      );

      await emailService.sendLimitReachedEmail({
        parentEmail:   parent.email,
        parentName:    parent.name,
        playerName:    player.username,
        minutesPlayed: minutesToday,
        limit:         limits?.daily_limit_minutes ?? '—',
        totalMinutes:  tge?.totalMinutes ?? null,
      });
    } catch (err) {
      logger.error(`Error notificando padre ${parent.email}: ${err.message}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Registro de sesiones (llamado desde eventos del plugin via API)
// ─────────────────────────────────────────────────────────────────────────────

async function recordLogin(playerUuid, username, serverId) {
  // Sincronizar username con TGE si difiere
  let player = await queryOne('SELECT * FROM panel_players WHERE uuid = ?', [playerUuid]);
  if (!player) {
    const r = await query(
      'INSERT INTO panel_players (uuid, username) VALUES (?, ?)',
      [playerUuid, username]
    );
    player = await queryOne('SELECT * FROM panel_players WHERE id = ?', [r.insertId]);
  } else if (player.username !== username) {
    await query('UPDATE panel_players SET username = ? WHERE id = ?', [username, player.id]);
    player.username = username;
  }

  // Cerrar cualquier sesión huérfana
  await query(`
    UPDATE panel_play_sessions
    SET logout_at  = NOW(),
        duration_s = TIMESTAMPDIFF(SECOND, login_at, NOW())
    WHERE player_id = ? AND logout_at IS NULL
  `, [player.id]);

  // Abrir nueva sesión
  const sess = await query(
    'INSERT INTO panel_play_sessions (player_id, server_id, login_at) VALUES (?, ?, NOW())',
    [player.id, serverId || null]
  );

  logger.info(`Login registrado: ${username} (${playerUuid})`);
  return { player, sessionId: sess.insertId };
}

async function recordLogout(playerUuid) {
  const player = await queryOne(
    'SELECT * FROM panel_players WHERE uuid = ?', [playerUuid]
  );
  if (!player) return null;

  const session = await queryOne(`
    SELECT * FROM panel_play_sessions
    WHERE player_id = ? AND logout_at IS NULL
    ORDER BY login_at DESC LIMIT 1
  `, [player.id]);

  if (session) {
    await query(`
      UPDATE panel_play_sessions
      SET logout_at  = NOW(),
          duration_s = TIMESTAMPDIFF(SECOND, login_at, NOW())
      WHERE id = ?
    `, [session.id]);
    logger.info(`Logout registrado: ${player.username} (${playerUuid})`);
  }

  return { player, session };
}

module.exports = {
  getTGEPlaytime,
  getMinutesPlayedToday,
  checkPlayerLimits,
  recordLogin,
  recordLogout,
};
