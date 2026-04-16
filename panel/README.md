# Panel de Gestión Minecraft Escolar

Panel web para que padres y profesores supervisen y controlen el tiempo de juego en servidores Minecraft escolares.

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Tailwind CSS v3 + Vite |
| Backend | Node.js + Express |
| Base de datos | MariaDB (existente: `s16_escolar`) |
| Autenticación | JWT |
| Tiempo real | Socket.io |
| Contenedores | Docker + Docker Compose |

---

## Estructura del proyecto

```
panel/
├── backend/
│   └── src/
│       ├── config/          # DB, logger
│       ├── middleware/       # auth, roles, errorHandler
│       ├── migrations/       # SQL + runner
│       ├── routes/           # REST API
│       ├── services/         # pterodactyl, rcon, email, socket
│       └── jobs/             # cron jobs
├── frontend/
│   └── src/
│       ├── components/       # layout, common, dashboard, players…
│       ├── contexts/         # Auth, Theme
│       ├── i18n/             # es.js + ca.js
│       ├── pages/            # Login, Dashboard, Players…
│       └── services/         # api.js, socket.js
├── nginx/
│   └── nginx.conf
├── docker-compose.yml
└── .env.example
```

---

## Instalación rápida con Docker

### 1. Clonar y configurar entorno

```bash
cd panel
cp .env.example .env
# Edita .env con tus valores reales
```

### 2. Variables obligatorias en `.env`

```env
DB_HOST=172.18.0.1        # IP de MariaDB accesible desde Docker
DB_PORT=3306
DB_NAME=s16_escolar
DB_USER=panel_user
DB_PASSWORD=tu_password

JWT_SECRET=min_32_caracteres_aleatorios

PTERODACTYL_URL=https://tu-panel.com
PTERODACTYL_API_KEY=ptla_xxx
PTERODACTYL_CLIENT_KEY=ptlc_xxx

INITIAL_ADMIN_EMAIL=admin@escuela.com
INITIAL_ADMIN_PASSWORD=Admin1234!
```

### 3. Crear usuario de base de datos

Ejecuta en MariaDB:
```sql
CREATE USER 'panel_user'@'%' IDENTIFIED BY 'tu_password';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER
  ON s16_escolar.*
  TO 'panel_user'@'%';
FLUSH PRIVILEGES;
```

### 4. Arrancar

```bash
docker compose up -d --build
```

El panel quedará disponible en **http://localhost** (puerto 80).

---

## Instalación en desarrollo (sin Docker)

### Backend

```bash
cd backend
npm install
cp ../.env.example .env    # ajusta valores
npm run dev                 # http://localhost:3001
```

### Frontend

```bash
cd frontend
npm install
# Crea .env.local con:
# VITE_API_URL=http://localhost:3001
# VITE_WS_URL=http://localhost:3001
npm run dev                 # http://localhost:3000
```

---

## Roles y permisos

| Acción | Admin | Profesor | Padre |
|--------|:-----:|:--------:|:-----:|
| Ver todos los jugadores | ✅ | ✅ (su clase) | ✅ (sus hijos) |
| Crear/editar jugadores | ✅ | ✅ | ❌ |
| Configurar límites | ✅ | ✅ | ❌ |
| Gestionar clases | ✅ | ✅ | ❌ |
| Moderación (kick/ban) | ✅ | ✅ | ❌ |
| Gestión de servidores | ✅ | ❌ | ❌ |
| Configuración del panel | ✅ | ❌ | ❌ |

---

## Integración con PlaytimeTrackerTGE

El panel intentará leer la tabla `playtime` del plugin PlaytimeTrackerTGE automáticamente. Si la tabla tiene una estructura diferente, edita la consulta en [backend/src/routes/playtime.js](backend/src/routes/playtime.js).

Para registrar sesiones en tiempo real, el panel usa `panel_play_sessions`. Puedes integrarlo desde un plugin Minecraft enviando requests a la API:

```http
POST /api/players/login   { "uuid": "...", "username": "...", "serverId": 1 }
POST /api/players/logout  { "uuid": "..." }
```

*(estas rutas las puedes añadir en `backend/src/routes/players.js`)*

---

## Integración con Pterodactyl

1. Accede a **Configuración → API Keys** en Pterodactyl
2. Crea una **Application API Key** (para arrancar/parar servidores)
3. Crea una **Client API Key** (para enviar comandos)
4. Configura ambas desde el panel en **Configuración → Pterodactyl**

---

## Variables de entorno completas

Ver [`.env.example`](.env.example) para la lista completa con descripciones.

---

## Notificaciones por email

El panel usa Nodemailer con SMTP. Para Gmail, crea una **contraseña de aplicación**:
1. Activa la verificación en dos pasos en tu cuenta
2. Ve a Seguridad → Contraseñas de aplicaciones
3. Usa esa contraseña en `SMTP_PASS`

---

## Migraciones de base de datos

Las migraciones se ejecutan automáticamente al arrancar el backend. Los ficheros SQL están en `backend/src/migrations/`. Para ejecutarlas manualmente:

```bash
cd backend
npm run migrate
```

---

## Tecnologías de terceros

- **[@headlessui/react](https://headlessui.com/)** — Componentes accesibles (modales, menús)
- **[@heroicons/react](https://heroicons.com/)** — Iconos SVG
- **[Recharts](https://recharts.org/)** — Gráficas de tiempo de juego
- **[date-fns](https://date-fns.org/)** — Formateo de fechas
- **[i18next](https://www.i18next.com/)** — Internacionalización (ES/CA)
- **[Socket.io](https://socket.io/)** — Chat en tiempo real y notificaciones push
- **[rcon-client](https://github.com/janispritzkau/rcon-client)** — Comandos RCON a Minecraft
