const mysql = require('mysql2/promise');
const logger = require('./logger');

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT) || 3306,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      waitForConnections: true,
      connectionLimit: 20,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      timezone: 'local',
    });
  }
  return pool;
}

async function testConnection() {
  try {
    const conn = await getPool().getConnection();
    await conn.ping();
    conn.release();
    logger.info(`✅ Base de datos conectada: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
    return true;
  } catch (err) {
    logger.error('❌ Error conectando a la base de datos:', err.message);
    throw err;
  }
}

async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

async function transaction(callback) {
  const conn = await getPool().getConnection();
  await conn.beginTransaction();
  try {
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { getPool, testConnection, query, queryOne, transaction };
