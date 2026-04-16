const jwt = require('jsonwebtoken');
const { queryOne, query } = require('../config/database');
const logger = require('../config/logger');

module.exports = function socketHandler(io) {
  // Middleware de autenticación para sockets
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Token requerido'));

      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await queryOne(
        'SELECT id, name, role, active FROM panel_users WHERE id = ?',
        [payload.userId]
      );
      if (!user || !user.active) return next(new Error('Usuario no válido'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket conectado: ${socket.user.name} (${socket.user.role}) [${socket.id}]`);

    // Unir al usuario a su sala privada
    socket.join(`user:${socket.user.id}`);

    // Unir según rol
    if (socket.user.role === 'admin') socket.join('admins');
    if (['admin', 'teacher'].includes(socket.user.role)) socket.join('staff');

    // Suscribirse a eventos de servidor específico
    socket.on('subscribe:server', (serverId) => {
      socket.join(`server:${serverId}`);
      logger.debug(`${socket.user.name} suscrito al servidor ${serverId}`);
    });

    socket.on('unsubscribe:server', (serverId) => {
      socket.leave(`server:${serverId}`);
    });

    // Ping/pong para keep-alive
    socket.on('ping', () => socket.emit('pong'));

    socket.on('disconnect', () => {
      logger.info(`Socket desconectado: ${socket.user.name} [${socket.id}]`);
    });
  });
};
