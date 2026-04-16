const express = require('express');
const { query, queryOne } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

// GET /api/settings
router.get('/', async (req, res, next) => {
  try {
    const rows = await query('SELECT `key`, `value`, `type`, description FROM panel_settings ORDER BY `key`');
    // Ocultar keys sensibles en la respuesta
    const safe = rows.map(r => ({
      ...r,
      value: ['pterodactyl_key', 'pterodactyl_client_key'].includes(r.key)
        ? (r.value ? '***' : '')
        : r.value,
    }));
    res.json(safe);
  } catch (err) { next(err); }
});

// GET /api/settings/:key
router.get('/:key', async (req, res, next) => {
  try {
    const row = await queryOne(
      'SELECT `key`, `value`, `type`, description FROM panel_settings WHERE `key` = ?',
      [req.params.key]
    );
    if (!row) return res.status(404).json({ error: 'Configuración no encontrada' });
    res.json(row);
  } catch (err) { next(err); }
});

// PUT /api/settings/:key
router.put('/:key', async (req, res, next) => {
  try {
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ error: 'value es obligatorio' });

    await query(
      `INSERT INTO panel_settings (\`key\`, \`value\`) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`,
      [req.params.key, String(value)]
    );
    res.json({ key: req.params.key, updated: true });
  } catch (err) { next(err); }
});

// PUT /api/settings — Actualizar múltiples settings de una vez
router.put('/', async (req, res, next) => {
  try {
    const settings = req.body; // { key: value, ... }
    if (typeof settings !== 'object') return res.status(400).json({ error: 'Body debe ser un objeto' });

    for (const [key, value] of Object.entries(settings)) {
      await query(
        `INSERT INTO panel_settings (\`key\`, \`value\`) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`,
        [key, String(value)]
      );
    }
    res.json({ updated: Object.keys(settings).length });
  } catch (err) { next(err); }
});

module.exports = router;
