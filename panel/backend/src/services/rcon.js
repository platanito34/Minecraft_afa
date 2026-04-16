const { Rcon } = require('rcon-client');
const logger = require('../config/logger');

async function sendCommand(server, command) {
  const host     = server.rcon_host || 'localhost';
  const port     = server.rcon_port || parseInt(process.env.RCON_DEFAULT_PORT) || 25575;
  const password = server.rcon_password || process.env.RCON_DEFAULT_PASSWORD || '';
  const timeout  = parseInt(process.env.RCON_TIMEOUT) || 5000;

  const rcon = new Rcon({ host, port, password, timeout });

  try {
    await rcon.connect();
    const response = await rcon.send(command);
    await rcon.end();
    logger.debug(`RCON [${host}:${port}] > ${command} → ${response}`);
    return response;
  } catch (err) {
    logger.error(`RCON error [${host}:${port}]: ${err.message}`);
    try { await rcon.end(); } catch (_) {}
    throw err;
  }
}

async function getOnlinePlayers(server) {
  try {
    const response = await sendCommand(server, 'list');
    // Formato: "There are X of a max of Y players online: player1, player2"
    const match = response.match(/players online:\s*(.+)/i);
    if (!match || !match[1].trim()) return [];
    return match[1].split(',').map(p => p.trim()).filter(Boolean);
  } catch (_) {
    return [];
  }
}

async function testConnection(server) {
  try {
    await sendCommand(server, 'list');
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = { sendCommand, getOnlinePlayers, testConnection };
