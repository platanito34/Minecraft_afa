const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const logger = require('../config/logger');

async function runMigrations() {
  // Tabla de control de migraciones
  await query(`
    CREATE TABLE IF NOT EXISTS panel_migrations (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      filename   VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const migrationsDir = __dirname;
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const applied = await query('SELECT id FROM panel_migrations WHERE filename = ?', [file]);
    if (applied.length > 0) continue;

    logger.info(`Aplicando migración: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    // Ejecutar cada statement por separado
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      try {
        await query(stmt);
      } catch (err) {
        // Ignorar errores de "ya existe" para idempotencia
        if (!err.message.includes('already exists') && !err.message.includes('Duplicate entry')) {
          throw err;
        }
      }
    }

    await query('INSERT INTO panel_migrations (filename) VALUES (?)', [file]);
    logger.info(`✅ Migración aplicada: ${file}`);
  }

  // Crear admin inicial si no existe
  await createInitialAdmin();
}

async function createInitialAdmin() {
  const bcrypt = require('bcryptjs');
  const email = process.env.INITIAL_ADMIN_EMAIL;
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  const name = process.env.INITIAL_ADMIN_NAME || 'Administrador';

  if (!email || !password) return;

  const existing = await query('SELECT id FROM panel_users WHERE email = ?', [email]);
  if (existing.length > 0) return;

  const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
  await query(
    'INSERT INTO panel_users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
    [email, hash, name, 'admin']
  );
  logger.info(`👤 Admin inicial creado: ${email}`);
}

module.exports = { runMigrations };
