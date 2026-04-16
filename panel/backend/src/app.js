require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const logger = require('./config/logger');
const errorHandler = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const playersRoutes = require('./routes/players');
const serversRoutes = require('./routes/servers');
const classesRoutes = require('./routes/classes');
const playtimeRoutes = require('./routes/playtime');
const moderationRoutes = require('./routes/moderation');
const settingsRoutes = require('./routes/settings');
const notificationsRoutes = require('./routes/notifications');

const app = express();

// ── Seguridad ─────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta de nuevo más tarde.' },
});
app.use('/api/', limiter);

// Límite más estricto para auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Demasiados intentos de inicio de sesión.' },
});
app.use('/api/auth/login', authLimiter);

// ── Parsers ───────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ───────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  }));
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Rutas de la API ───────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/players', playersRoutes);
app.use('/api/servers', serversRoutes);
app.use('/api/classes', classesRoutes);
app.use('/api/playtime', playtimeRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationsRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
