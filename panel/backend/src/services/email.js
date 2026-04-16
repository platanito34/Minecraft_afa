const nodemailer = require('nodemailer');
const { queryOne } = require('../config/database');
const logger = require('../config/logger');

let transporter;

async function getTransporter() {
  if (transporter) return transporter;

  const emailEnabled = await queryOne(
    "SELECT `value` FROM panel_settings WHERE `key` = 'email_enabled'"
  );
  if (!emailEnabled || emailEnabled.value !== 'true') {
    throw new Error('Las notificaciones por email están desactivadas');
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  try {
    const transport = await getTransporter();
    const info = await transport.sendMail({
      from: process.env.EMAIL_FROM || 'Panel Minecraft <no-reply@minecraft.local>',
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ''),
    });
    logger.info(`Email enviado a ${to}: ${subject} [${info.messageId}]`);
    return info;
  } catch (err) {
    logger.error(`Error enviando email: ${err.message}`);
    throw err;
  }
}

async function sendLimitReachedEmail({ parentEmail, parentName, playerName, minutesPlayed, limit }) {
  return sendMail({
    to: parentEmail,
    subject: `⏰ ${playerName} ha alcanzado su límite de juego`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ef4444;">Límite de tiempo alcanzado</h2>
        <p>Hola <strong>${parentName}</strong>,</p>
        <p>Tu hijo/a <strong>${playerName}</strong> ha alcanzado su límite diario de tiempo de juego.</p>
        <table style="border-collapse:collapse; width:100%; margin:16px 0;">
          <tr><td style="padding:8px; background:#f3f4f6;"><strong>Tiempo jugado hoy</strong></td>
              <td style="padding:8px;">${Math.round(minutesPlayed)} minutos</td></tr>
          <tr><td style="padding:8px; background:#f3f4f6;"><strong>Límite diario</strong></td>
              <td style="padding:8px;">${limit} minutos</td></tr>
        </table>
        <p>El jugador ha sido expulsado automáticamente del servidor.</p>
        <hr style="margin:24px 0; border:none; border-top:1px solid #e5e7eb;">
        <p style="color:#6b7280; font-size:12px;">Panel de gestión Minecraft Escolar</p>
      </div>
    `,
  });
}

async function sendLoginEmail({ parentEmail, parentName, playerName, serverName, time }) {
  return sendMail({
    to: parentEmail,
    subject: `🟢 ${playerName} se ha conectado al servidor`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #22c55e;">Conexión al servidor</h2>
        <p>Hola <strong>${parentName}</strong>,</p>
        <p><strong>${playerName}</strong> se ha conectado al servidor <strong>${serverName}</strong>.</p>
        <p style="color:#6b7280;">Hora: ${time}</p>
        <hr style="margin:24px 0; border:none; border-top:1px solid #e5e7eb;">
        <p style="color:#6b7280; font-size:12px;">Panel de gestión Minecraft Escolar</p>
      </div>
    `,
  });
}

async function sendLogoutEmail({ parentEmail, parentName, playerName, serverName, duration, time }) {
  return sendMail({
    to: parentEmail,
    subject: `🔴 ${playerName} se ha desconectado (${duration} min)`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6b7280;">Desconexión del servidor</h2>
        <p>Hola <strong>${parentName}</strong>,</p>
        <p><strong>${playerName}</strong> se ha desconectado del servidor <strong>${serverName}</strong>.</p>
        <table style="border-collapse:collapse; width:100%; margin:16px 0;">
          <tr><td style="padding:8px; background:#f3f4f6;"><strong>Duración de la sesión</strong></td>
              <td style="padding:8px;">${duration} minutos</td></tr>
          <tr><td style="padding:8px; background:#f3f4f6;"><strong>Hora de desconexión</strong></td>
              <td style="padding:8px;">${time}</td></tr>
        </table>
        <hr style="margin:24px 0; border:none; border-top:1px solid #e5e7eb;">
        <p style="color:#6b7280; font-size:12px;">Panel de gestión Minecraft Escolar</p>
      </div>
    `,
  });
}

module.exports = { sendMail, sendLimitReachedEmail, sendLoginEmail, sendLogoutEmail };
