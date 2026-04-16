const express = require('express');
const { query, queryOne } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireMinRole } = require('../middleware/roles');
const rconService = require('../services/rcon');
const pterodactylService = require('../services/pterodactyl');

const router = express.Router();
router.use(authenticate, requireMinRole('teacher'));

// GET /api/moderation/sanctions — Historial de sanciones
router.get('/sanctions', async (req, res, next) => {
  try {
    const { player_id, type, limit = 50, offset = 0 } = req.query;
    let sql = `
      SELECT s.*, p.username AS player_name, u.name AS issued_by_name, srv.name AS server_name
      FROM panel_sanctions s
      JOIN panel_players p ON p.id = s.player_id
      LEFT JOIN panel_users u ON u.id = s.issued_by
      LEFT JOIN panel_servers srv ON srv.id = s.server_id
      WHERE 1=1
    `;
    const params = [];
    if (player_id) { sql += ' AND s.player_id = ?'; params.push(player_id); }
    if (type)      { sql += ' AND s.type = ?';      params.push(type); }
    sql += ' ORDER BY s.issued_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const sanctions = await query(sql, params);
    res.json(sanctions);
  } catch (err) { next(err); }
});

// POST /api/moderation/kick — Kickear jugador
router.post('/kick', async (req, res, next) => {
  try {
    const { player_id, server_id, reason } = req.body;
    if (!player_id || !server_id) {
      return res.status(400).json({ error: 'player_id y server_id son obligatorios' });
    }

    const player = await queryOne('SELECT * FROM panel_players WHERE id = ?', [player_id]);
    const server = await queryOne('SELECT * FROM panel_servers WHERE id = ?', [server_id]);
    if (!player || !server) return res.status(404).json({ error: 'Jugador o servidor no encontrado' });

    // Ejecutar kick via RCON
    const kickReason = reason || 'Expulsado por el administrador';
    try {
      await rconService.sendCommand(server, `kick ${player.username} ${kickReason}`);
    } catch (rconErr) {
      // Si falla RCON, intentar via Pterodactyl console
      if (server.pterodactyl_server_id) {
        await pterodactylService.sendCommand(server.pterodactyl_server_id, `kick ${player.username} ${kickReason}`);
      } else {
        throw rconErr;
      }
    }

    // Registrar sanción
    await query(
      `INSERT INTO panel_sanctions (player_id, server_id, type, reason, issued_by)
       VALUES (?, ?, 'kick', ?, ?)`,
      [player_id, server_id, kickReason, req.user.id]
    );

    // Notificar via Socket.io
    const io = req.app.get('io');
    if (io) io.emit('moderation:kick', { player, server, reason: kickReason, by: req.user.name });

    res.json({ message: `${player.username} ha sido kickeado` });
  } catch (err) { next(err); }
});

// POST /api/moderation/ban — Banear jugador
router.post('/ban', async (req, res, next) => {
  try {
    const { player_id, server_id, reason, expires_at } = req.body;
    if (!player_id || !server_id) {
      return res.status(400).json({ error: 'player_id y server_id son obligatorios' });
    }

    const player = await queryOne('SELECT * FROM panel_players WHERE id = ?', [player_id]);
    const server = await queryOne('SELECT * FROM panel_servers WHERE id = ?', [server_id]);
    if (!player || !server) return res.status(404).json({ error: 'Jugador o servidor no encontrado' });

    const banReason = reason || 'Baneado por el administrador';
    try {
      await rconService.sendCommand(server, `ban ${player.username} ${banReason}`);
    } catch (rconErr) {
      if (server.pterodactyl_server_id) {
        await pterodactylService.sendCommand(server.pterodactyl_server_id, `ban ${player.username} ${banReason}`);
      } else {
        throw rconErr;
      }
    }

    await query(
      `INSERT INTO panel_sanctions (player_id, server_id, type, reason, issued_by, expires_at)
       VALUES (?, ?, 'ban', ?, ?, ?)`,
      [player_id, server_id, banReason, req.user.id, expires_at || null]
    );

    const io = req.app.get('io');
    if (io) io.emit('moderation:ban', { player, server, reason: banReason, by: req.user.name });

    res.json({ message: `${player.username} ha sido baneado` });
  } catch (err) { next(err); }
});

// POST /api/moderation/unban
router.post('/unban', async (req, res, next) => {
  try {
    const { player_id, server_id } = req.body;
    const player = await queryOne('SELECT * FROM panel_players WHERE id = ?', [player_id]);
    const server = await queryOne('SELECT * FROM panel_servers WHERE id = ?', [server_id]);
    if (!player || !server) return res.status(404).json({ error: 'Jugador o servidor no encontrado' });

    try {
      await rconService.sendCommand(server, `pardon ${player.username}`);
    } catch (_) {
      if (server.pterodactyl_server_id) {
        await pterodactylService.sendCommand(server.pterodactyl_server_id, `pardon ${player.username}`);
      }
    }

    await query(
      'UPDATE panel_sanctions SET active = 0 WHERE player_id = ? AND server_id = ? AND type = ? AND active = 1',
      [player_id, server_id, 'ban']
    );
    await query(
      `INSERT INTO panel_sanctions (player_id, server_id, type, reason, issued_by)
       VALUES (?, ?, 'unban', 'Desbanear', ?)`,
      [player_id, server_id, req.user.id]
    );

    res.json({ message: `${player.username} ha sido desbaneado` });
  } catch (err) { next(err); }
});

// POST /api/moderation/command — Enviar comando RCON libre (solo admin)
router.post('/command', requireMinRole('admin'), async (req, res, next) => {
  try {
    const { server_id, command } = req.body;
    if (!server_id || !command) {
      return res.status(400).json({ error: 'server_id y command son obligatorios' });
    }
    const server = await queryOne('SELECT * FROM panel_servers WHERE id = ?', [server_id]);
    if (!server) return res.status(404).json({ error: 'Servidor no encontrado' });

    let response;
    try {
      response = await rconService.sendCommand(server, command);
    } catch (_) {
      if (server.pterodactyl_server_id) {
        response = await pterodactylService.sendCommand(server.pterodactyl_server_id, command);
      } else {
        throw _;
      }
    }

    res.json({ response: response || '(sin respuesta)' });
  } catch (err) { next(err); }
});

// GET /api/moderation/chat — Últimas líneas de chat almacenadas
router.get('/chat', async (req, res, next) => {
  try {
    const { server_id, limit = 100 } = req.query;
    let sql = `
      SELECT cl.*, s.name AS server_name
      FROM panel_chat_log cl
      LEFT JOIN panel_servers s ON s.id = cl.server_id
      WHERE 1=1
    `;
    const params = [];
    if (server_id) { sql += ' AND cl.server_id = ?'; params.push(server_id); }
    sql += ' ORDER BY cl.logged_at DESC LIMIT ?';
    params.push(parseInt(limit));
    const rows = await query(sql, params);
    res.json(rows.reverse());
  } catch (err) { next(err); }
});

module.exports = router;
