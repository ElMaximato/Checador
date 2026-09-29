# Checador — Estado del proyecto

Sistema interno de control de asistencia con tres interfaces: app móvil para
empleados, panel web para administradores y una pantalla de TV para
anuncios y multimedia. Este documento resume qué está hecho, cómo levantar cada
parte y qué falta, para que cualquiera que entre al repo pueda ubicarse
rápido.

> Última actualización: 28 de septiembre de 2026 · Rama de trabajo:
> `feat/movil-conectado` (aún no mezclada a `main`).

---

## 1. Estructura del monorepo

```
checador-monorepo/
├── apps/
│   ├── backend/    Node + Express + MySQL — API para las 3 interfaces
│   ├── mobile/     Expo (React Native) — app del empleado
│   ├── admin/      React + Vite — panel de administración
│   └── tv/         HTML/JS sin build — pantalla de anuncios y multimedia (modo kiosco)
├── packages/       Código compartido (sin uso todavía)
├── database_schema.sql (dentro de apps/backend)
└── README.md
```

---

## 2. Backend (`apps/backend`)

**Estado: funcional para empleados, administración y TV.**

### Módulos implementados

| Módulo | Qué hace |
|---|---|
| **Auth de dispositivo** | Activación con ID de empleado (`NX-1001`) + PIN de un solo uso. Al activar un teléfono nuevo, se revoca automáticamente el anterior del mismo empleado (un solo teléfono activo por persona). |
| **Asistencia** | Registrar entrada/salida con foto (`multipart/form-data`), una jornada por empleado por día. Calcula puntualidad y minutos de retardo contra el horario asignado, una sola vez, al momento del check-in. |
| **Jornada de hoy** (`GET /api/attendance/hoy`) | Da el estado actual (activa/cerrada/expirada) y minutos trabajados, para que la app decida qué botón mostrar. |
| **Historial** (`GET /api/attendance/historial`) | Registros del mes + resumen (días laborados, horas, % puntualidad, % asistencia). |
| **Perfil** (`GET /api/me`) | Nombre, puesto, departamento, código NX y horario del empleado autenticado. |
| **Job programado** | Cada 10 min marca como `expirada_sin_salida` las jornadas activas cuyo token ya venció (alguien que olvidó registrar salida). |
| **Admin — login** | JWT propio de 8 h, contraseña con bcrypt. |
| **Admin — empleados** | Alta, edición, baja/reactivación (la baja revoca sus teléfonos), generar PIN. |
| **Admin — horarios** | Alta y edición: hora entrada/salida, tolerancia, vigencia de jornada, días de la semana. |
| **Admin — dispositivos** | Ver los teléfonos vinculados a un empleado y revocarlos manualmente. |
| **Admin — asistencias** | Listado por rango de fechas con las fotos de entrada y salida. |
| **Verificación de rostro** | Antes de guardar entrada/salida, el backend detecta rostros en la foto (`@vladmandic/human`); rechaza fotos sin rostro, con varios o con el rostro muy pequeño. No es reconocimiento facial. Modo con `VERIFICAR_ROSTRO` (`permisivo` / `estricto` / `desactivado`). |
| **TV — emparejamiento** | La pantalla pide un código de 6 caracteres (`POST /api/tv/codigo`, con límite de solicitudes); el admin lo captura en el panel; la TV lo detecta (`POST /api/tv/estado`) y recibe su token una sola vez. Tercera capa de autenticación: JWT de TV (`JWT_TV_SECRET`) sin expiración, revocable desde el panel. |
| **TV — contenido** | `GET /api/tv/playlist` (con token de TV) devuelve la playlist asignada y los anuncios vigentes; actualiza `ultimo_ping`. |
| **Admin — TV** | CRUD de anuncios (con vigencia), subida de multimedia (imagen/video/música, `multer`), playlists con orden y duración por imagen, y pantallas (emparejar, editar, asignar playlist, revocar). Rutas en `/api/admin/tv/*`. |

### Variables de entorno (`.env`, no se sube al repo)

```
PORT=4000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=control_asistencia

JWT_DEVICE_SECRET=   # sesión larga del teléfono del empleado
JWT_JORNADA_SECRET=  # token corto de la jornada del día
JWT_ADMIN_SECRET=    # sesión del panel de administración
JWT_TV_SECRET=       # sesión de las pantallas de TV
MULTIMEDIA_MAX_MB=100  # tamaño máximo por archivo multimedia

UPLOADS_DIR=./uploads/asistencia

CORS_ORIGINS=        # orígenes de navegador permitidos: panel y también la TV (ver sección 5)
VERIFICAR_ROSTRO=permisivo
```

`apps/backend/.env.example` tiene la plantilla completa.

### Cómo levantarlo

```powershell
cd apps/backend
npm install
npm run dev
```

Crear el primer administrador (una sola vez):

```powershell
node scripts/crearAdmin.js "Nombre" correo@ejemplo.com contraseña
```

### Base de datos existente: migración de TV

Si tu base ya estaba creada antes del módulo de TV, corre **una sola vez**
`apps/backend/migrations/002_tv_emparejamiento.sql` (agrega estado, código de
emparejamiento y claim a `dispositivos_tv`). Si la creas desde cero con
`database_schema.sql`, ya lo incluye.

### Pendiente en el backend

- [ ] HTTPS y despliegue en un servidor real (hoy corre en local, por HTTP).


---

## 3. App móvil (`apps/mobile`)

**Estado: flujo completo del empleado funcionando, probado con Expo Go (SDK 52).**

### Qué hace

- **Activación:** ID de empleado (`NX-XXXX`) + PIN, genera y guarda un `deviceId`.
- **Candado diario:** biometría real (`expo-local-authentication`), no simulada.
- **Inicio:** saludo, turno asignado, estado de la jornada de hoy, tiempo trabajado (en vivo si la jornada sigue activa) y % de asistencia del mes — todo desde la base de datos.
- **Cámara:** toma la foto real y la sube al backend, con reintento y tiempo límite (12 s normal, 30 s en fotos).
- **Confirmación:** hora, puntualidad y jornada, con datos reales de la respuesta.
- **Historial:** navegación por mes, con resumen y detalle de cada registro.
- **Perfil:** nombre, puesto, departamento y código NX real. Sin foto de perfil.
- **Cerrar sesión / Desvincular:** dos acciones distintas — cerrar sesión solo bloquea (vuelve al candado); desvincular revoca el teléfono en el servidor y hay que activarlo de nuevo con un PIN.
- **Manejo de errores:** si el backend revoca el dispositivo (o el admin lo desactiva), la app avisa y manda a Activación; si no hay conexión, Inicio y Historial muestran un aviso con opción de reintentar en vez de quedarse cargando.

### Configuración necesaria para probar

`apps/mobile/src/api/config.ts`:

```ts
export const API_BASE_URL = "http://TU_IP_LOCAL:4000";
```

Esta IP cambia según la red WiFi a la que esté conectada la PC que corre el backend — hay que actualizarla cada vez que se cambia de red. Se puede tomar del `ipconfig` de Windows o de la línea `Metro waiting on exp://...` que muestra `npx expo start`.

### Cómo levantarla

```powershell
cd apps/mobile
npm install
npx expo start
```

Requiere **Expo Go para SDK 52** en el teléfono (la versión más reciente de Expo Go en las tiendas ya no es compatible con este proyecto).

### Pendiente en la app móvil

- [ ] Empaquetado para producción: generar APK / build de iOS con EAS Build (hoy solo corre con Expo Go, modo desarrollo).
- [ ] `API_BASE_URL` fija por archivo; para producción debe apuntar a un dominio real con HTTPS.

---

## 4. Panel de administración (`apps/admin`)

**Estado: funcional — login, empleados, horarios y asistencias.**

### Qué hace

- **Login** con JWT de administrador.
- **Empleados:** tabla con alta, edición, baja (revoca sus teléfonos) y reactivación; botón para generar PIN (muestra ID y PIN una sola vez); ver y revocar los teléfonos vinculados a cada empleado.
  - El nombre tiene un límite de 80 caracteres con contador visible.
  - Puesto y departamento son listas cerradas, alimentadas por lo que ya existe en la base, con opción de "Agregar nuevo…" para dar de alta un valor que todavía no existe.
  - La fecha de ingreso solo permite elegir días del año en curso (validado también en el backend).
- **Horarios:** alta y edición, con selección de días de la semana, tolerancia y vigencia de la jornada.
- **Asistencias:** listado por rango de fechas, con miniaturas de las fotos de entrada y salida (clic para ampliar).
- **Anuncios TV:** alta, edición y borrado, con fecha de inicio/fin y activo/inactivo. El estado (vigente, programado, vencido, inactivo) se calcula en el servidor.
- **Multimedia:** subida de imágenes, videos y música con miniatura; renombrar, activar/desactivar y eliminar (no deja eliminar un archivo que esté en una playlist).
- **Playlists:** armado con orden (↑/↓), duración en segundos por imagen (por defecto 10 s); videos y música se reproducen completos.
- **Pantallas TV:** emparejar con el código que muestra la TV, nombre, ubicación, playlist asignada, indicador en línea / sin señal (sin ping en 3 min) y revocación.

### Cómo levantarlo

```powershell
cd apps/admin
npm install
npm run dev
```

Abre `http://localhost:5173`. Si el backend corre en otra IP o puerto, crear `apps/admin/.env` con:

```
VITE_API_URL=http://TU_IP:4000
```

### Pendiente en el panel



---

## 5. App de TV (`apps/tv`)

**Estado: implementada; falta probarla con el backend, MySQL y una TV reales.**

Es una página web (HTML/CSS/JS sin build), pensada para abrirse en modo
kiosco en el navegador del Android TV, no una app nativa. Detalles y
alternativas en `apps/tv/README.md`.

### Qué hace

- **Emparejamiento:** muestra un código de 6 caracteres; al capturarlo en el panel (Pantallas TV → Emparejar TV) guarda su token y empieza a reproducir. Si el código vence, pide otro solo.
- **Reproducción en bucle** de la playlist asignada: imágenes (10 s o la duración indicada), videos y música (completos). Cada 3 elementos intercala un anuncio vigente; si la playlist tiene menos de 3, los anuncios van al final del ciclo.
- **Actualización:** consulta al servidor cada 60 s (esto es también su "ping"); si el contenido cambió, aplica la cola nueva al terminar el elemento en curso.
- **Sin conexión:** sigue reproduciendo lo que ya tiene y muestra un aviso discreto.
- **Revocada:** si el admin la revoca, vuelve sola a la pantalla de emparejamiento.

### Cómo levantarla

El backend ya sirve la carpeta en `/tv`:

```
http://IP_DEL_SERVIDOR:4000/tv/
```

Ese origen (`http://IP_DEL_SERVIDOR:4000`, sin barra final) **debe estar en `CORS_ORIGINS`** del `.env` del backend, o el navegador de la TV será bloqueado. Si la app se sirve desde otro lugar, abrirla una vez con `?api=http://IP_DEL_SERVIDOR:4000`. Para desvincular una TV desde la propia pantalla: `?reset=1`.

### Pendiente en la app de TV

- [ ] Probarla en el Android TV real (autoplay con sonido, modo kiosco, reinicio tras corte de luz).
- [ ] Si el navegador de la TV resulta limitado, empaquetarla como app nativa o WebView.
- [ ] Actualización inmediata por Socket.IO (hoy es por consulta cada 60 s).

---

## 6. Base de datos

MySQL, esquema en `apps/backend/database_schema.sql`. Tablas ya en uso:
`admins`, `horarios`, `horarios_dias`, `departamentos`, `empleados`,
`dispositivos_empleado`, `jornadas`, y las de TV: `anuncios`, `multimedia`,
`playlists`, `playlist_items` y `dispositivos_tv` (esta última con estado,
código de emparejamiento y claim; ver migración `002_tv_emparejamiento.sql`).
Los archivos multimedia se guardan en `apps/backend/uploads/multimedia/`
(fuera de git) y la BD guarda solo su ruta. Las fechas de los anuncios se
comparan con la hora del servidor MySQL: debe tener la misma zona horaria
que quienes usan el panel.

---

## 7. Estado de Git

Todo el trabajo de este documento vive en la rama **`feat/movil-conectado`**,
sobre `origin/feat/movil-conectado`. **Todavía no se ha mezclado a `main`.**

Antes de hacer el merge, conviene:
1. Terminar de probar el Admin Web (empleados, horarios, asistencias, PIN, revocación).
2. Confirmar que no queden archivos sueltos fuera de `apps/` en el commit (revisar con `git status`).
3. Hacer el merge por Pull Request en GitHub, para dejar el historial de revisión.

```powershell
git checkout main
git pull
git merge feat/movil-conectado
git push
```

---

## 8. Próximos pasos sugeridos (en orden)

1. **Cerrar el Admin Web:** pulir Horarios y Asistencias al mismo nivel que Empleados; agregar gestión de administradores.
2. **Seguridad para producción:** restringir CORS, límite de intentos en login/activación, HTTPS.
3. **Turnos nocturnos** en backend y app móvil.
4. **Empaquetar la app móvil** con EAS Build (APK / iOS) en vez de depender de Expo Go.
5. **Probar el módulo de TV** de punta a punta (migración, subir multimedia, emparejar una TV real) y, si el navegador de la TV se queda corto, evaluar app nativa.
6. **Mezclar `feat/movil-conectado` a `main`** una vez validado todo lo anterior.
