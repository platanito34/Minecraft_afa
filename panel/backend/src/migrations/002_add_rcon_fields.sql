ALTER TABLE panel_servers
  ADD COLUMN IF NOT EXISTS rcon_host     VARCHAR(255) NULL         AFTER pterodactyl_server_id;

ALTER TABLE panel_servers
  ADD COLUMN IF NOT EXISTS rcon_port     INT UNSIGNED NOT NULL DEFAULT 25575 AFTER rcon_host;

ALTER TABLE panel_servers
  ADD COLUMN IF NOT EXISTS rcon_password VARCHAR(255) NULL         AFTER rcon_port;
