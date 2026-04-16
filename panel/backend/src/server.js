require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');

const app = require('./app');
const logger = require('./config/logger');
const { testConnection } = require('./config/database');
const { startJobs } = require('./jobs');
const socketHandler = require('./services/socketHandler');
const { runMigrations } = require('./migrations/run');

const PORT = process.env.PORT || 3001;

async function bootstrap() {
  try {
    // Verificar conexión DB
    await testConnection();

    // Ejecutar migraciones
    await runMigrations();

    // Crear servidor HTTP + Socket.io
    const server = http.createServer(app);
    const io = new Server(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    // Adjuntar io a app para usarlo en rutas
    app.set('io', io);

    // Configurar handlers de sockets
    socketHandler(io);

    // Arrancar jobs programados
    startJobs(io);

    server.listen(PORT, () => {
      logger.info(`🚀 Servidor escuchando en http://localhost:${PORT}`);
      logger.info(`📡 WebSocket listo`);
      logger.info(`🌍 Entorno: ${process.env.NODE_ENV}`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} recibido — cerrando servidor...`);
      server.close(() => {
        logger.info('Servidor HTTP cerrado');
        process.exit(0);
      });
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    logger.error('Error fatal al arrancar:', err);
    process.exit(1);
  }
}

bootstrap();
