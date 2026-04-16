const express = require('express');
const { query, queryOne } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRole, requireMinRole } = require('../middleware/roles');
const pterodactylService = require('../services/pterodactyl');

const router = express.Router();
router.use(authenticate);

// GET /api/servers
router.get('/', async (req, res, next) => {
  try {
    const servers = await query(
      'SELECT id, name, pterodactyl_server_id, rcon_host, rcon_port, description, active FROM panel_servers ORDER BY name'
    );

    // Intentar obtener estado en tiempo real de Pterodactyl
    const withStatus = await Promise.all(servers.map(async (srv) => {
      if (srv.pterodactyl_server_id) {
        try {
          const status = await pterodactylService.getServerStatus(srv.pterodactyl_server_id);
          return { ...srv, status };
        } catch (_) {
          return { ...srv, status: { current_state: 'unknown' } };
        }
      }
      return { ...srv, status: { current_state: 'unknown' } };
    }));

    res.json(withStatus);
  } catch (err) { next(err); }
});

// GET /api/servers/:id
router.get('/:id', async (req, res, next) => {
  try {
    const server = await queryOne(
      'SELECT id, name, pterodactyl_server_id, rcon_host, rcon_port, description, active FROM panel_servers WHERE id = ?',
      [req.params.id]
    );
    if (!server) return res.status(404).json({ error: 'Servidor no encontrado' });

    if (server.pterodactyl_server_id) {
      try {
        const status = await pterodactylService.getServerStatus(server.pterodactyl_server_id);
        return res.json({ ...server, status });
      } catch (_) {}
    }
    res.json({ ...server, status: { current_state: 'unknown' } });
  } catch (err) { next(err); }
});

// POST /api/servers (solo admin)
router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { name, pterodactyl_server_id, rcon_host, rcon_port, rcon_password, description } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });

    const [result] = await query(
      `INSERT INTO panel_servers (name, pterodactyl_server_id, rcon_host, rcon_port, rcon_password, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, pterodactyl_server_id || null, rcon_host || null,
       rcon_port || 25575, rcon_password || null, description || null]
    );
    const server = await queryOne(
      'SELECT id, name, pterodactyl_server_id, rcon_host, rcon_port, description, active FROM panel_servers WHERE id = ?',
      [result.insertId]
    );
    res.status(201).json(server);
  } catch (err) { next(err); }
});

// PATCH /api/servers/:id
router.patch('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const allowed = ['name', 'pterodactyl_server_id', 'rcon_host', 'rcon_port', 'rcon_password', 'description', 'active'];
    const fields = [];
    const values = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(req.body[key]);
      }
    }
    if (!fields.length) return res.status(400).json({ error: 'Nada que actualizar' });
    values.push(req.params.id);
    await query(`UPDATE panel_servers SET ${fields.join(', ')} WHERE id = ?`, values);
    const server = await queryOne(
      'SELECT id, name, pterodactyl_server_id, rcon_host, rcon_port, description, active FROM panel_servers WHERE id = ?',
      [req.params.id]
    );
    res.json(server);
  } catch (err) { next(err); }
});

// DELETE /api/servers/:id
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    await query('DELETE FROM panel_servers WHERE id = ?', [req.params.id]);
    res.json({ message: 'Servidor eliminado' });
  } catch (err) { next(err); }
});

// POST /api/servers/:id/power — Arrancar/parar servidor
router.post('/:id/power', requireMinRole('teacher'), async (req, res, next) => {
  try {
    const { action } = req.body; // start | stop | restart | kill
    const validActions = ['start', 'stop', 'restart', 'kill'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: 'Acción inválida. Usa: start, stop, restart, kill' });
    }

    const server = await queryOne(
      'SELECT pterodactyl_server_id FROM panel_servers WHERE id = ?', [req.params.id]
    );
    if (!server) return res.status(404).json({ error: 'Servidor no encontrado' });
    if (!server.pterodactyl_server_id) {
      return res.status(400).json({ error: 'Servidor sin ID de Pterodactyl configurado' });
    }

    await pterodactylService.powerAction(server.pterodactyl_server_id, action);
    res.json({ message: `Acción '${action}' enviada al servidor` });
  } catch (err) { next(err); }
});

// GET /api/servers/:id/players — Jugadores online (via Pterodactyl/RCON)
router.get('/:id/players', requireMinRole('teacher'), async (req, res, next) => {
  try {
    const server = await queryOne(
      'SELECT pterodactyl_server_id FROM panel_servers WHERE id = ?', [req.params.id]
    );
    if (!server) return res.status(404).json({ error: 'Servidor no encontrado' });

    const players = await pterodactylService.getOnlinePlayers(server.pterodactyl_server_id);
    res.json(players);
  } catch (err) { next(err); }
});

module.exports = router;
