const { query, queryOne } = require('../config/database');
const logger = require('../config/logger');

async function getSecondsPlayedToday(playerUuid, playerId) {
  // Intentar PlaytimeTrackerTGE primero
  try {
    const ptRow = await queryOne('SELECT playtime FROM playtime WHERE uuid = ?', [playerUuid]);
    if (ptRow) {
      // PlaytimeTrackerTGE guarda el total histórico, calculamos solo de hoy
    }
  } catch (_) {}

  // Calcular desde panel_play_sessions
  const row = await queryOne(`
    SELECT COALESCE(SUM(TIMESTAMPDIFF(SECOND, login_at, IFNULL(logout_at, NOW()))), 0) AS seconds
    FROM panel_play_sessions
    WHERE player_id = ? AND DATE(login_at) = CURDATE()
  `, [playerId]);

  return row?.seconds || 0;
}

async function checkPlayerLimits(playerId, io) {
  const player = await queryOne('SELECT * FROM panel_players WHERE id = ?', [playerId]);
  if (!player || !player.active) return;

  const limits = await queryOne(
    'SELECT * FROM panel_playtime_limits WHERE player_id = ?', [playerId]
  );
  if (!limits) return;

  const secondsToday = await getSecondsPlayedToday(player.uuid, playerId);
  const minutesToday = Math.floor(secondsToday / 60);

  const now = new Date();
  const currentTime = now.toTimeString().substring(0, 5); // HH:MM
  const currentDay = String(now.getDay()); // 0=Dom

  // Verificar días permitidos
  if (limits.allowed_days) {
    const allowedDays = limits.allowed_days.split(',');
    if (!allowedDays.includes(currentDay)) {
      await kickPlayerForLimit(player, limits, io, 'Hoy no está permitido jugar');
      return;
    }
  }

  // Verificar horario
  if (limits.allowed_start_time && limits.allowed_end_time) {
    if (currentTime < limits.allowed_start_time || currentTime > limits.allowed_end_time) {
      await kickPlayerForLimit(player, limits, io,
        `Fuera del horario permitido (${limits.allowed_start_time} - ${limits.allowed_end_time})`);
      return;
    }
  }

  // Verificar límite diario
  if (limits.daily_limit_minutes && minutesToday >= limits.daily_limit_minutes) {
    await kickPlayerForLimit(player, limits, io, 'Has alcanzado tu límite de tiempo diario');
    return;
  }

  // Advertencia preventiva
  if (limits.daily_limit_minutes && limits.warn_at_minutes) {
    const minutesLeft = limits.daily_limit_minutes - minutesToday;
    if (minutesLeft <= limits.warn_at_minutes && minutesLeft > 0) {
      await warnPlayer(player, minutesLeft, io);
    }
  }
}

async function kickPlayerForLimit(player, limits, io, reason) {
  if (!limits.kick_on_limit) return;

  const pterodactylService = require('./pterodactyl');

  // Obtener servidores donde está el jugador
  const servers = await query(`
    SELECT s.* FROM panel_servers s
    JOIN panel_player_servers ps ON ps.server_id = s.id
    WHERE ps.player_id = ?
  `, [player.id]);

  for (const server of servers) {
    if (server.pterodactyl_server_id) {
      try {
        await pterodactylService.kickPlayer(server.pterodactyl_server_id, player.username, reason);
        logger.info(`Kick automático: ${player.username} → ${reason}`);
      } catch (err) {
        logger.error(`Error kickeando ${player.username}: ${err.message}`);
      }
    }
  }

  // Emitir evento Socket.io
  if (io) {
    io.emit('playtime:limit_reached', {
      playerId: player.id,
      playerName: player.username,
      reason,
    });
  }

  // Notificar a los padres
  await notifyParents(player, reason);
}

async function warnPlayer(player, minutesLeft, io) {
  if (io) {
    io.emit('playtime:warning', {
      playerId: player.id,
      playerName: player.username,
      minutesLeft,
    });
  }
}

async function notifyParents(player, reason) {
  const emailService = require('./email');
  const parents = await query(`
    SELECT pu.id, pu.name, pu.email
    FROM panel_users pu
    JOIN panel_parent_players pp ON pp.parent_id = pu.id
    WHERE pp.player_id = ?
  `, [player.id]);

  for (const parent of parents) {
    try {
      // Guardar notificación web
      await query(`
        INSERT INTO panel_notifications (user_id, player_id, type, channel, title, body)
        VALUES (?, ?, 'limit_reached', 'web', ?, ?)
      `, [parent.id, player.id,
          `${player.username} ha alcanzado su límite de juego`,
          reason]);

      // Enviar email
      const secondsToday = await getSecondsPlayedToday(player.uuid, player.id);
      await emailService.sendLimitReachedEmail({
        parentEmail: parent.email,
        parentName: parent.name,
        playerName: player.username,
        minutesPlayed: Math.floor(secondsToday / 60),
        limit: '—',
      });
    } catch (err) {
      logger.error(`Error notificando padre ${parent.email}: ${err.message}`);
    }
  }
}

async function recordLogin(playerUuid, username, serverId) {
  let player = await queryOne('SELECT * FROM panel_players WHERE uuid = ?', [playerUuid]);
  if (!player) {
    const [r] = await query(
      'INSERT INTO panel_players (uuid, username) VALUES (?, ?)', [playerUuid, username]
    );
    player = await queryOne('SELECT * FROM panel_players WHERE id = ?', [r.insertId]);
  } else if (player.username !== username) {
    await query('UPDATE panel_players SET username = ? WHERE id = ?', [username, player.id]);
    player.username = username;
  }

  // Cerrar sesiones abiertas (por si acaso)
  await query(`
    UPDATE panel_play_sessions SET logout_at = NOW(),
      duration_s = TIMESTAMPDIFF(SECOND, login_at, NOW())
    WHERE player_id = ? AND logout_at IS NULL
  `, [player.id]);

  // Abrir nueva sesión
  const [sess] = await query(
    'INSERT INTO panel_play_sessions (player_id, server_id, login_at) VALUES (?, ?, NOW())',
    [player.id, serverId || null]
  );

  return { player, sessionId: sess.insertId };
}

async function recordLogout(playerUuid) {
  const player = await queryOne('SELECT * FROM panel_players WHERE uuid = ?', [playerUuid]);
  if (!player) return null;

  const session = await queryOne(`
    SELECT * FROM panel_play_sessions
    WHERE player_id = ? AND logout_at IS NULL
    ORDER BY login_at DESC LIMIT 1
  `, [player.id]);

  if (session) {
    await query(`
      UPDATE panel_play_sessions
      SET logout_at = NOW(), duration_s = TIMESTAMPDIFF(SECOND, login_at, NOW())
      WHERE id = ?
    `, [session.id]);
  }

  return { player, session };
}

module.exports = { checkPlayerLimits, recordLogin, recordLogout, getSecondsPlayedToday };
