CREATE TABLE IF NOT EXISTS panel_users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(100) NOT NULL,
  role          ENUM('admin','teacher','parent') NOT NULL DEFAULT 'parent',
  active        TINYINT(1) NOT NULL DEFAULT 1,
  language      VARCHAR(5) NOT NULL DEFAULT 'es',
  last_login    TIMESTAMP NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_email (email),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS panel_servers (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name                  VARCHAR(100) NOT NULL,
  pterodactyl_server_id VARCHAR(36) NULL,
  rcon_host             VARCHAR(255) NULL,
  rcon_port             SMALLINT UNSIGNED NOT NULL DEFAULT 25575,
  rcon_password         VARCHAR(255) NULL,
  description           TEXT NULL,
  active                TINYINT(1) NOT NULL DEFAULT 1,
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS panel_players (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uuid         VARCHAR(36) NOT NULL,
  username     VARCHAR(16) NOT NULL,
  display_name VARCHAR(100) NULL,
  active       TINYINT(1) NOT NULL DEFAULT 1,
  notes        TEXT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_uuid (uuid),
  INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS panel_classes (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT NULL,
  teacher_id  INT UNSIGNED NULL,
  active      TINYINT(1) NOT NULL DEFAULT 1,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_classes_teacher
    FOREIGN KEY (teacher_id) REFERENCES panel_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS panel_class_players (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  class_id  INT UNSIGNED NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_class_player (class_id, player_id),
  CONSTRAINT fk_cp_class
    FOREIGN KEY (class_id)  REFERENCES panel_classes(id)  ON DELETE CASCADE,
  CONSTRAINT fk_cp_player
    FOREIGN KEY (player_id) REFERENCES panel_players(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS panel_parent_players (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_id INT UNSIGNED NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_parent_player (parent_id, player_id),
  CONSTRAINT fk_pp_parent
    FOREIGN KEY (parent_id) REFERENCES panel_users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_pp_player
    FOREIGN KEY (player_id) REFERENCES panel_players(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS panel_player_servers (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  player_id INT UNSIGNED NOT NULL,
  server_id INT UNSIGNED NOT NULL,
  UNIQUE KEY uq_player_server (player_id, server_id),
  CONSTRAINT fk_ps_player
    FOREIGN KEY (player_id) REFERENCES panel_players(id) ON DELETE CASCADE,
  CONSTRAINT fk_ps_server
    FOREIGN KEY (server_id) REFERENCES panel_servers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS panel_playtime_limits (
  id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  player_id            INT UNSIGNED NOT NULL,
  daily_limit_minutes  SMALLINT UNSIGNED NULL,
  weekly_limit_minutes SMALLINT UNSIGNED NULL,
  allowed_days         VARCHAR(13) NULL,
  allowed_start_time   TIME NULL,
  allowed_end_time     TIME NULL,
  kick_on_limit        TINYINT(1) NOT NULL DEFAULT 1,
  warn_at_minutes      SMALLINT UNSIGNED NULL,
  updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_player (player_id),
  CONSTRAINT fk_pl_player
    FOREIGN KEY (player_id) REFERENCES panel_players(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS panel_play_sessions (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  player_id  INT UNSIGNED NOT NULL,
  server_id  INT UNSIGNED NULL,
  login_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  logout_at  TIMESTAMP NULL,
  duration_s INT UNSIGNED NULL,
  INDEX idx_player_date (player_id, login_at),
  CONSTRAINT fk_sess_player
    FOREIGN KEY (player_id) REFERENCES panel_players(id) ON DELETE CASCADE,
  CONSTRAINT fk_sess_server
    FOREIGN KEY (server_id) REFERENCES panel_servers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS panel_sanctions (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  player_id  INT UNSIGNED NOT NULL,
  server_id  INT UNSIGNED NULL,
  type       ENUM('kick','ban','warn','unban') NOT NULL,
  reason     VARCHAR(500) NULL,
  issued_by  INT UNSIGNED NULL,
  issued_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  active     TINYINT(1) NOT NULL DEFAULT 1,
  INDEX idx_sanctions_player (player_id),
  CONSTRAINT fk_san_player
    FOREIGN KEY (player_id) REFERENCES panel_players(id) ON DELETE CASCADE,
  CONSTRAINT fk_san_server
    FOREIGN KEY (server_id) REFERENCES panel_servers(id) ON DELETE SET NULL,
  CONSTRAINT fk_san_issuer
    FOREIGN KEY (issued_by) REFERENCES panel_users(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS panel_chat_log (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  server_id   INT UNSIGNED NULL,
  player_uuid VARCHAR(36) NULL,
  username    VARCHAR(16) NULL,
  message     TEXT NOT NULL,
  logged_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_chat_server_time (server_id, logged_at),
  INDEX idx_chat_player (player_uuid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS panel_notifications (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id   INT UNSIGNED NULL,
  player_id INT UNSIGNED NULL,
  type      VARCHAR(50) NOT NULL,
  channel   ENUM('email','web') NOT NULL DEFAULT 'web',
  title     VARCHAR(255) NOT NULL,
  body      TEXT NULL,
  read_at   TIMESTAMP NULL,
  sent_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_user_unread (user_id, read_at),
  CONSTRAINT fk_notif_user
    FOREIGN KEY (user_id)   REFERENCES panel_users(id)   ON DELETE CASCADE,
  CONSTRAINT fk_notif_player
    FOREIGN KEY (player_id) REFERENCES panel_players(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS panel_settings (
  `key`       VARCHAR(100) NOT NULL,
  `value`     TEXT NULL,
  `type`      ENUM('string','number','boolean','json') NOT NULL DEFAULT 'string',
  description VARCHAR(255) NULL,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO panel_settings (`key`, `value`, `type`, `description`) VALUES
  ('pterodactyl_url',        '',             'string',  'URL base del panel Pterodactyl');

INSERT IGNORE INTO panel_settings (`key`, `value`, `type`, `description`) VALUES
  ('pterodactyl_key',        '',             'string',  'Application API Key de Pterodactyl');

INSERT IGNORE INTO panel_settings (`key`, `value`, `type`, `description`) VALUES
  ('pterodactyl_client_key', '',             'string',  'Client API Key de Pterodactyl');

INSERT IGNORE INTO panel_settings (`key`, `value`, `type`, `description`) VALUES
  ('email_enabled',          'false',        'boolean', 'Activar notificaciones por email');

INSERT IGNORE INTO panel_settings (`key`, `value`, `type`, `description`) VALUES
  ('max_daily_default',      '120',          'number',  'Limite diario por defecto en minutos');

INSERT IGNORE INTO panel_settings (`key`, `value`, `type`, `description`) VALUES
  ('timezone',               'Europe/Madrid','string',  'Zona horaria del panel');
