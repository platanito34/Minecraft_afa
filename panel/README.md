# Minecraft Panel Escolar

Panel web para gestionar servidores de Minecraft en entornos escolares. Permite a familias supervisar el tiempo de juego de los niños, configurar límites horarios y recibir alertas automáticas.

---

## Arquitectura del sistema

```
Servidor Minecraft (PaperMC)
    └── PlaytimeTrackerTGE (plugin) → MariaDB
    └── LuckPerms (plugin) → MariaDB

Pterodactyl (gestión de servidores)
    └── Wings (node) → Docker

Log Watcher (servicio systemd)
    └── Lee logs de Minecraft → API del panel

Panel Web
    ├── Frontend (React + Tailwind) → puerto 3000
    └── Backend (Node.js + Express) → puerto 3001
        └── MariaDB (base de datos compartida)
```

---

## Stack tecnológico

| Componente | Tecnología |
|---|---|
| Servidor Minecraft | PaperMC 1.21.4 |
| Gestión de servidores | Pterodactyl 1.12.1 |
| Base de datos | MariaDB 10.11 |
| Backend | Node.js + Express |
| Frontend | React + Tailwind CSS |
| Contenedores | Docker + docker-compose |
| Plugins | LuckPerms, PlaytimeTrackerTGE, PlaceholderAPI |

---

## Requisitos

- Ubuntu 24.04
- Docker + docker-compose
- MariaDB
- Pterodactyl instalado y funcionando
- Python 3 + pip (para el log watcher)
- Node.js 20+

---

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/platanito34/Minecraft_afa.git
cd Minecraft_afa/panel
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
nano .env
```

Variables importantes a rellenar:

```env
# Base de datos
DB_HOST=172.18.0.1        # IP gateway Docker para MariaDB
DB_PORT=3306
DB_NAME=s16_escolar
DB_USER=panel_user
DB_PASSWORD=tu_contraseña

# JWT
JWT_SECRET=secreto_largo_aleatorio_min_32_chars
JWT_EXPIRES_IN=8h

# URLs (usar IP pública para acceso externo)
CORS_ORIGIN=http://TU_IP_PUBLICA:3000
VITE_API_URL=http://TU_IP_PUBLICA:3001
VITE_WS_URL=http://TU_IP_PUBLICA:3001

# Pterodactyl
PTERODACTYL_URL=https://TU_IP_PUBLICA    # usar HTTPS con IP local
PTERODACTYL_API_KEY=ptla_xxxx
PTERODACTYL_CLIENT_KEY=ptlc_xxxx

# Admin inicial
INITIAL_ADMIN_EMAIL=admin@email.com
INITIAL_ADMIN_PASSWORD=contraseña_segura
INITIAL_ADMIN_NAME=Administrador
```

### 3. Crear usuario de base de datos

```bash
mysql -u root -p
```

```sql
CREATE USER 'panel_user'@'%' IDENTIFIED BY 'tu_contraseña';
GRANT ALL PRIVILEGES ON s16_escolar.* TO 'panel_user'@'%';
FLUSH PRIVILEGES;
EXIT;
```

### 4. Configurar acceso Docker a MariaDB

Permitir conexiones desde la red Docker al puerto 3306:

```bash
sudo iptables -I INPUT -s 172.19.0.0/16 -p tcp --dport 3306 -j ACCEPT
sudo iptables -I DOCKER-USER -s 172.19.0.0/16 -p tcp --dport 3306 -j ACCEPT
```

### 5. Generar package-lock.json

```bash
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 6. Arrancar con Docker

```bash
docker compose up -d --build
```

El backend ejecuta las migraciones SQL automáticamente al arrancar y crea el usuario admin inicial si no existe.

---

## Servidor de Minecraft

### Configuración en Pterodactyl

- **Egg**: Paper
- **Minecraft Version**: 1.21.4
- **Build Number**: latest
- **Java**: 21
- **RAM mínima**: 1024 MB

### Plugins instalados

| Plugin | Versión | Función |
|---|---|---|
| LuckPerms | 5.5.42 | Gestión de roles y permisos |
| PlaytimeTrackerTGE | 1.0.5 | Registro de tiempo de juego |
| PlaceholderAPI | 2.12.2 | Dependencia de PlaytimeTrackerTGE |

### Configuración de LuckPerms (MySQL)

En `plugins/LuckPerms/config.yml`:

```yaml
storage-method: MySQL

data:
  address: 172.18.0.1:3306
  database: s16_escolar
  username: u16_xxxx
  password: tu_contraseña
```

### Configuración de PlaytimeTrackerTGE (MySQL)

En `plugins/PlaytimeTrackerTGE/config.yml`:

```yaml
database:
  use-mysql: true
  mysql:
    host: 172.18.0.1
    port: 3306
    database: s16_escolar
    username: u16_xxxx
    password: tu_contraseña
```

### Activar RCON (para kick automático)

En `server.properties`:

```properties
enable-rcon=true
rcon.password=tu_contraseña_rcon
rcon.port=25576
```

---

## Log Watcher

Servicio que lee los logs de Minecraft en tiempo real y registra sesiones en el panel automáticamente.

### Instalación

```bash
pip3 install requests --break-system-packages
```

### Configuración

Edita `log_watcher.py` con tus valores:

```python
PANEL_URL = "http://localhost:3001"
PANEL_EMAIL = "admin@email.com"
PANEL_PASSWORD = "tu_contraseña"
CONTAINER = "UUID_DEL_CONTENEDOR_DOCKER"   # docker ps para verlo
SERVER_ID = 1
LOG_PATH = "/home/container/logs/latest.log"
```

Para obtener el UUID del contenedor:

```bash
sudo docker ps --format "table {{.ID}}\t{{.Names}}"
```

### Instalar como servicio systemd

```bash
sudo nano /etc/systemd/system/mc-log-watcher.service
```

```ini
[Unit]
Description=Minecraft Log Watcher
After=network.target docker.service

[Service]
Type=simple
ExecStart=/usr/bin/python3 /home/platanito34/Minecraft_afa/log_watcher.py
Restart=always
RestartSec=10
User=platanito34
WorkingDirectory=/home/platanito34/Minecraft_afa
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable mc-log-watcher
sudo systemctl start mc-log-watcher
```

Ver logs del servicio:

```bash
sudo journalctl -u mc-log-watcher -f
```

---

## Panel web

### Acceso

- **Local**: `http://192.168.1.100:3000`
- **Externo**: `http://TU_IP_PUBLICA:3000`

### Roles

| Rol | Permisos |
|---|---|
| Admin | Acceso total |
| Padre/tutor | Solo ve a sus hijos vinculados |

### Funcionalidades

- Dashboard con tiempo de juego (hoy / semana / mes)
- Gestión de jugadores con UUID de Minecraft
- Configuración de límites por jugador: horas diarias, horario permitido, días permitidos
- Kick automático al superar el límite (via RCON)
- Aviso X minutos antes de llegar al límite
- Gestión de servidores integrada con Pterodactyl (estado, arrancar, parar)
- Moderación (kick/ban desde el panel)
- Notificaciones a padres por email (opcional)
- Interfaz en español y catalán con selector de idioma
- Dark mode / light mode con toggle

---

## Base de datos

La base de datos `s16_escolar` en MariaDB contiene tanto las tablas del panel como las de los plugins de Minecraft.

### Tablas del panel

| Tabla | Descripción |
|---|---|
| `panel_users` | Usuarios del panel (admin, padres) |
| `panel_players` | Jugadores de Minecraft registrados |
| `panel_servers` | Servidores de Minecraft |
| `panel_playtime_limits` | Límites configurados por jugador |
| `panel_play_sessions` | Historial de sesiones (login/logout) |
| `panel_player_servers` | Relación jugador-servidor |
| `panel_notifications` | Notificaciones del sistema |
| `panel_settings` | Configuración global del panel |

### Tablas de plugins

| Tabla | Plugin | Descripción |
|---|---|---|
| `playtime` | PlaytimeTrackerTGE | Tiempo acumulado por jugador |
| `luckperms_*` | LuckPerms | Permisos y roles de Minecraft |

---

## Integración Pterodactyl

El panel se comunica con Pterodactyl via API REST. La URL debe apuntar a la IP interna para evitar problemas de resolución DNS en la misma máquina.

### Configuración desde el panel

En **Configuració → Pterodactyl**:

- **URL**: `https://192.168.1.100` (IP local, no el dominio)
- **API Key (Application)**: `ptla_xxxx`
- **Client Key**: `ptlc_xxxx`

### Obtener API keys

- **Admin key** (`ptla_`): Panel Pterodactyl → **Application API**
- **Client key** (`ptlc_`): Panel Pterodactyl → tu usuario → **Account → API Credentials**

---

## Notas de red importantes

### Docker y MariaDB

Los contenedores Docker no pueden conectar a `127.0.0.1` del host. Usar siempre la IP del gateway Docker:

```bash
# Ver gateway de cada red Docker
sudo docker network inspect panel_panel_net | grep Gateway
sudo docker network inspect pterodactyl_nw | grep Gateway
```

### Pterodactyl y DNS

Si el dominio de Pterodactyl está en `/etc/hosts` apuntando a `127.0.0.1`, los contenedores Docker no pueden resolverlo. Solución: usar la IP local (`192.168.1.100`) o la IP de la red Docker (`172.18.0.1`) en lugar del dominio.

### Puertos necesarios abiertos

| Puerto | Servicio | Protocolo |
|---|---|---|
| 3000 | Frontend panel | TCP |
| 3001 | Backend panel API | TCP |
| 25565 | Minecraft Java | TCP/UDP |
| 25576 | RCON Minecraft | TCP |
| 3306 | MariaDB (solo interno) | TCP |

---

## Desarrollo

### Flujo de trabajo

1. Desarrollar en Windows con VSCode
2. `git add . && git commit -m "mensaje" && git push`
3. En el VPS: `git pull`
4. Rebuild si hay cambios en el backend/frontend:

```bash
cd ~/Minecraft_afa/panel
sudo docker compose up -d --build
```

### Ver logs

```bash
# Backend
sudo docker compose logs backend -f

# Frontend
sudo docker compose logs frontend -f

# Log watcher
sudo journalctl -u mc-log-watcher -f
```

### Reiniciar servicios

```bash
# Panel completo
sudo docker compose restart

# Solo backend
sudo docker compose restart backend

# Log watcher
sudo systemctl restart mc-log-watcher
```

---

## Pendiente / Próximos pasos

- Vincular padres a jugadores (relación padre-hijo)
- Mejorar cálculo de tiempo por día/semana/mes (actualmente usa total acumulado de TGE)
- Gráfica de historial de sesiones
- Notificaciones push o WhatsApp
- Soporte multi-servidor (mismo jugador en varios servidores)
- Sistema de whitelist gestionado desde el panel
