const { query } = require('../config/database');
const emailService = require('../services/email');
const logger = require('../config/logger');

async function runDailyReport(io) {
  // Obtener padres con notificaciones de informe activas
  const parents = await query(`
    SELECT pu.id, pu.name, pu.email FROM panel_users pu
    WHERE pu.role = 'parent' AND pu.active = 1
  `);

  for (const parent of parents) {
    try {
      const players = await query(`
        SELECT p.id, p.uuid, p.username,
          COALESCE(SUM(TIMESTAMPDIFF(SECOND, ps.login_at,
            IFNULL(ps.logout_at, NOW()))), 0) AS seconds_today,
          pl.daily_limit_minutes
        FROM panel_players p
        JOIN panel_parent_players pp ON pp.player_id = p.id
        LEFT JOIN panel_play_sessions ps ON ps.player_id = p.id
          AND DATE(ps.login_at) = CURDATE()
        LEFT JOIN panel_playtime_limits pl ON pl.player_id = p.id
        WHERE pp.parent_id = ?
        GROUP BY p.id, pl.daily_limit_minutes
      `, [parent.id]);

      if (!players.length) continue;

      const rows = players.map(p => {
        const mins = Math.floor(p.seconds_today / 60);
        const limitStr = p.daily_limit_minutes ? `${p.daily_limit_minutes} min` : 'Sin límite';
        const status = p.daily_limit_minutes && mins >= p.daily_limit_minutes ? '⚠️' : '✅';
        return `<tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${p.username}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${mins} min</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${limitStr}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${status}</td>
        </tr>`;
      }).join('');

      await emailService.sendMail({
        to: parent.email,
        subject: `📊 Informe diario de juego — ${new Date().toLocaleDateString('es-ES')}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#3b82f6;">Informe diario de tiempo de juego</h2>
            <p>Hola <strong>${parent.name}</strong>, aquí tienes el resumen de hoy:</p>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:#f3f4f6;">
                  <th style="padding:8px;text-align:left;">Jugador</th>
                  <th style="padding:8px;text-align:left;">Tiempo hoy</th>
                  <th style="padding:8px;text-align:left;">Límite</th>
                  <th style="padding:8px;text-align:left;">Estado</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;">
            <p style="color:#6b7280;font-size:12px;">Panel de gestión Minecraft Escolar</p>
          </div>
        `,
      });

      // Guardar como notificación web
      await query(`
        INSERT INTO panel_notifications (user_id, type, channel, title, body)
        VALUES (?, 'daily_report', 'web', ?, ?)
      `, [parent.id, 'Informe diario de juego',
          `${players.length} jugador(es) — ${new Date().toLocaleDateString('es-ES')}`]);

    } catch (err) {
      logger.error(`Error en informe diario para ${parent.email}: ${err.message}`);
    }
  }

  // Notificar via socket
  if (io) io.emit('report:daily_sent', { date: new Date().toISOString() });
}

module.exports = { runDailyReport };
