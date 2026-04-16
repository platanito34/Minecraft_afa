-- ============================================================
-- Panel Minecraft Escolar — Migración inicial
-- Base de datos: s16_escolar
-- ============================================================

-- Usuarios del panel (admins, profesores, padres)
CREATE TABLE IF NOT EXISTS panel_users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(100) NOT NULL,
  role          ENUM('admin','teacher','parent') NOT NULL DEFAULT 'parent',
  active        TINYINT(1) NOT NULL DEFAULT 1,
  language      VARCHAR(5) NOT NULL DEFAULT 'es',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login    TIMESTAMP NULL,
  INDEX idx_email (email),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Jugadores Minecraft vinculados al panel
CREATE TABLE IF NOT EXISTS panel_players (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uuid          VARCHAR(36) NOT NULL UNIQUE COMMENT 'UUID de Minecraft (offline o online)',
  username      VARCHAR(16) NOT NULL,
  display_name  VARCHAR(100) NULL,
  active        TINYINT(1) NOT NULL DEFAULT 1,
  notes         TEXT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_uuid (uuid),
  INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Relación padre/tutor ↔ jugador
CREATE TABLE IF NOT EXISTS panel_parent_players (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_id   INT UNSIGNED NOT NULL,
  player_id   INT UNSIGNED NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_parent_player (parent_id, player_id),
  FOREIGN KEY (parent_id) REFERENCES panel_users(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES panel_players(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clases / grupos
CREATE TABLE IF NOT EXISTS panel_classes (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT NULL,
  teacher_id  INT UNSIGNED NULL COMMENT 'Profesor responsable',
  active      TINYINT(1) NOT NULL DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES panel_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Relación clase ↔ jugador
CREATE TABLE IF NOT EXISTS panel_class_players (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  class_id   INT UNSIGNED NOT NULL,
  player_id  INT UNSIGNED NOT NULL,
  joined_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_class_player (class_id, player_id),
  FOREIGN KEY (class_id) REFERENCES panel_classes(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES panel_players(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Servidores Minecraft (gestionados por Pterodactyl)
CREATE TABLE IF NOT EXISTS panel_servers (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name                  VARCHAR(100) NOT NULL,
  pterodactyl_server_id VARCHAR(36) NULL COMMENT 'UUID del servidor en Pterodactyl',
  rcon_host             VARCHAR(255) NULL,
  rcon_port             SMALLINT UNSIGNED NULL DEFAULT 25575,
  rcon_password         VARCHAR(255) NULL,
  description           TEXT NULL,
  active                TINYINT(1) NOT NULL DEFAULT 1,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Relación jugador ↔ servidor (a qué servidor/es puede entrar)
CREATE TABLE IF NOT EXISTS panel_player_servers (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  player_id  INT UNSIGNED NOT NULL,
  server_id  INT UNSIGNED NOT NULL,
  UNIQUE KEY uk_player_server (player_id, server_id),
  FOREIGN KEY (player_id) REFERENCES panel_players(id) ON DELETE CASCADE,
  FOREIGN KEY (server_id) REFERENCES panel_servers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Límites de tiempo de juego por jugador
CREATE TABLE IF NOT EXISTS panel_playtime_limits (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  player_id             INT UNSIGNED NOT NULL UNIQUE,
  daily_limit_minutes   SMALLINT UNSIGNED NULL COMMENT 'NULL = sin límite',
  weekly_limit_minutes  SMALLINT UNSIGNED NULL,
  allowed_days          SET('0','1','2','3','4','5','6') NULL COMMENT '0=Dom,1=Lun,...,6=Sáb. NULL=todos',
  allowed_start_time    TIME NULL COMMENT 'Hora inicio franja permitida',
  allowed_end_time      TIME NULL COMMENT 'Hora fin franja permitida',
  kick_on_limit         TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Kickear via Pterodactyl al superar límite',
  warn_at_minutes       SMALLINT UNSIGNED NULL COMMENT 'Avisar X minutos antes del límite',
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES panel_players(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Registro de sesiones de juego (complementa PlaytimeTrackerTGE)
CREATE TABLE IF NOT EXISTS panel_play_sessions (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  player_id   INT UNSIGNED NOT NULL,
  server_id   INT UNSIGNED NULL,
  login_at    TIMESTAMP NOT NULL,
  logout_at   TIMESTAMP NULL,
  duration_s  INT UNSIGNED NULL COMMENT 'Calculado al cerrar sesión',
  INDEX idx_player_date (player_id, login_at),
  FOREIGN KEY (player_id) REFERENCES panel_players(id) ON DELETE CASCADE,
  FOREIGN KEY (server_id) REFERENCES panel_servers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sanciones (kick, ban, warn)
CREATE TABLE IF NOT EXISTS panel_sanctions (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  player_id     INT UNSIGNED NOT NULL,
  server_id     INT UNSIGNED NULL,
  type          ENUM('kick','ban','warn','unban') NOT NULL,
  reason        VARCHAR(500) NULL,
  issued_by     INT UNSIGNED NULL COMMENT 'panel_users.id que la emite',
  issued_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at    TIMESTAMP NULL COMMENT 'NULL = permanente (para bans)',
  active        TINYINT(1) NOT NULL DEFAULT 1,
  INDEX idx_player (player_id),
  FOREIGN KEY (player_id) REFERENCES panel_players(id) ON DELETE CASCADE,
  FOREIGN KEY (server_id) REFERENCES panel_servers(id) ON DELETE SET NULL,
  FOREIGN KEY (issued_by) REFERENCES panel_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Log de chat capturado via RCON
CREATE TABLE IF NOT EXISTS panel_chat_log (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  server_id   INT UNSIGNED NULL,
  player_uuid VARCHAR(36) NULL,
  username    VARCHAR(16) NULL,
  message     TEXT NOT NULL,
  logged_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_server_time (server_id, logged_at),
  INDEX idx_player (player_uuid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notificaciones (email) enviadas
CREATE TABLE IF NOT EXISTS panel_notifications (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NULL COMMENT 'Destinatario panel_users.id',
  player_id   INT UNSIGNED NULL,
  type        VARCHAR(50) NOT NULL COMMENT 'limit_reached, login, logout, daily_report',
  channel     ENUM('email','web') NOT NULL DEFAULT 'web',
  title       VARCHAR(255) NOT NULL,
  body        TEXT NULL,
  read_at     TIMESTAMP NULL,
  sent_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_unread (user_id, read_at),
  FOREIGN KEY (user_id) REFERENCES panel_users(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES panel_players(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Configuración global del panel
CREATE TABLE IF NOT EXISTS panel_settings (
  `key`       VARCHAR(100) PRIMARY KEY,
  `value`     TEXT NULL,
  `type`      ENUM('string','number','boolean','json') NOT NULL DEFAULT 'string',
  description VARCHAR(255) NULL,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Valores por defecto de configuración
INSERT IGNORE INTO panel_settings (`key`, `value`, `type`, `description`) VALUES
  ('pterodactyl_url',    '',     'string',  'URL del panel Pterodactyl'),
  ('pterodactyl_key',    '',     'string',  'API Key de Pterodactyl (Application)'),
  ('pterodactyl_client_key', '', 'string',  'Client API Key de Pterodactyl'),
  ('email_enabled',      'false','boolean', 'Activar notificaciones por email'),
  ('max_daily_default',  '120',  'number',  'Límite diario por defecto en minutos (0=sin límite)'),
  ('timezone',           'Europe/Madrid', 'string', 'Zona horaria del panel');
