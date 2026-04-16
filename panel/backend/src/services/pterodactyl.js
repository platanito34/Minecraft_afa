const axios = require('axios');
const { queryOne } = require('../config/database');
const logger = require('../config/logger');

async function getConfig() {
  const urlRow    = await queryOne("SELECT `value` FROM panel_settings WHERE `key` = 'pterodactyl_url'");
  const keyRow    = await queryOne("SELECT `value` FROM panel_settings WHERE `key` = 'pterodactyl_key'");
  const clientRow = await queryOne("SELECT `value` FROM panel_settings WHERE `key` = 'pterodactyl_client_key'");
  const baseURL = (urlRow?.value || process.env.PTERODACTYL_URL || '').replace(/\/$/, '');
  console.log('DEBUG pterodactyl baseURL:', baseURL, '| urlRow:', urlRow);
  const appKey  = keyRow?.value || process.env.PTERODACTYL_API_KEY || '';
  const clientKey = clientRow?.value || process.env.PTERODACTYL_CLIENT_KEY || '';

  if (!baseURL) throw new Error('URL de Pterodactyl no configurada');

  return { baseURL, appKey, clientKey };
}

function appClient(baseURL, appKey) {
  const https = require('https');
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  return axios.create({
    baseURL: `${baseURL}/api/application`,
    headers: {
      Authorization: `Bearer ${appKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    timeout: 10000,
  });
}

function clientClient(baseURL, clientKey) {
  const https = require('https');
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  return axios.create({
    baseURL: `${baseURL}/api/client`,
    headers: {
      Authorization: `Bearer ${clientKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    httpsAgent,
    timeout: 10000,
  });
}

async function getServerStatus(pterodactylId) {
  try {
    const { baseURL, clientKey } = await getConfig();
    const client = clientClient(baseURL, clientKey);
    const { data } = await client.get(`/servers/${pterodactylId}/resources`);
    return data.attributes;
  } catch (err) {
    logger.warn(`Pterodactyl getServerStatus error: ${err.message}`);
    return { current_state: 'unknown' };
  }
}

async function powerAction(pterodactylId, action) {
  const { baseURL, clientKey } = await getConfig();
  const client = clientClient(baseURL, clientKey);
  await client.post(`/servers/${pterodactylId}/power`, { signal: action });
  logger.info(`Pterodactyl power action '${action}' → server ${pterodactylId}`);
}

async function sendCommand(pterodactylId, command) {
  const { baseURL, clientKey } = await getConfig();
  const client = clientClient(baseURL, clientKey);
  await client.post(`/servers/${pterodactylId}/command`, { command });
  logger.info(`Pterodactyl command → [${pterodactylId}]: ${command}`);
  return '(comando enviado)';
}

async function getOnlinePlayers(pterodactylId) {
  try {
    const { baseURL, clientKey } = await getConfig();
    const client = clientClient(baseURL, clientKey);
    // Enviar "list" command y parsear salida (aproximado)
    await client.post(`/servers/${pterodactylId}/command`, { command: 'list' });
    return [];
  } catch (err) {
    logger.warn(`Pterodactyl getOnlinePlayers error: ${err.message}`);
    return [];
  }
}

async function listServers() {
  const { baseURL, appKey } = await getConfig();
  const client = appClient(baseURL, appKey);
  const { data } = await client.get('/servers?per_page=100');
  return data.data.map(s => ({
    id: s.attributes.identifier,
    uuid: s.attributes.uuid,
    name: s.attributes.name,
    description: s.attributes.description,
    status: s.attributes.status,
  }));
}

async function kickPlayer(pterodactylId, username, reason) {
  return sendCommand(pterodactylId, `kick ${username} ${reason || 'Límite de tiempo alcanzado'}`);
}

module.exports = { getServerStatus, powerAction, sendCommand, getOnlinePlayers, listServers, kickPlayer };
