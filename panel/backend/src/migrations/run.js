const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const logger = require('../config/logger');

// Elimina comentarios SQL (-- línea y /* bloque */) antes de parsear
function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')  // /* bloque */
    .replace(/--[^\n]*/g, '');          // -- hasta fin de línea
}

// Divide el SQL en sentencias individuales, ignorando ; dentro de strings
function splitStatements(sql) {
  const cleaned = stripComments(sql);
  const stmts = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const prev = cleaned[i - 1];

    if (ch === "'" && !inDoubleQuote && !inBacktick && prev !== '\\') {
      inSingleQuote = !inSingleQuote;
    } else if (ch === '"' && !inSingleQuote && !inBacktick && prev !== '\\') {
      inDoubleQuote = !inDoubleQuote;
    } else if (ch === '`' && !inSingleQuote && !inDoubleQuote) {
      inBacktick = !inBacktick;
    }

    if (ch === ';' && !inSingleQuote && !inDoubleQuote && !inBacktick) {
      const stmt = current.trim();
      if (stmt.length > 0) stmts.push(stmt);
      current = '';
    } else {
      current += ch;
    }
  }
  const last = current.trim();
  if (last.length > 0) stmts.push(last);
  return stmts;
}

async function runMigrations() {
  // Tabla de control (se crea primero, antes de cualquier fichero SQL)
  await query(`
    CREATE TABLE IF NOT EXISTS panel_migrations (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      filename   VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const migrationsDir = __dirname;
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const applied = await query('SELECT id FROM panel_migrations WHERE filename = ?', [file]);
    if (applied.length > 0) {
      logger.debug(`Migración ya aplicada, saltando: ${file}`);
      continue;
    }

    logger.info(`Aplicando migración: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const statements = splitStatements(sql);

    logger.debug(`  ${statements.length} sentencia(s) encontradas en ${file}`);

    for (const stmt of statements) {
      try {
        await query(stmt);
      } catch (err) {
        // Ignorar errores esperados por idempotencia
        const msg = err.message || '';
        if (
          msg.includes('already exists') ||
          msg.includes('Duplicate entry') ||
          msg.includes('duplicate key')
        ) {
          logger.debug(`  Ignorado (ya existía): ${msg.substring(0, 80)}`);
          continue;
        }
        logger.error(`Error en migración ${file}:\n${stmt.substring(0, 200)}`);
        throw err;
      }
    }

    await query('INSERT INTO panel_migrations (filename) VALUES (?)', [file]);
    logger.info(`✅ Migración aplicada: ${file}`);
  }

  // Crear admin inicial DESPUÉS de que todas las tablas existan
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
