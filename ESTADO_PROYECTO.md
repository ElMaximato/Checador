# Checador — Estado del proyecto

Sistema interno de control de asistencia con tres interfaces: app móvil para
empleados, panel web para administradores y (pendiente) una pantalla de TV
para anuncios. Este documento resume qué está hecho, cómo levantar cada
parte y qué falta, para que cualquiera que entre al repo pueda ubicarse
rápido.

> Última actualización: 24 de septiembre de 2026 · Rama de trabajo:
> `feat/movil-conectado` (aún no mezclada a `main`).

---

## 1. Estructura del monorepo

```
checador-monorepo/
├── apps/
│   ├── backend/    Node + Express + MySQL — API para las 3 interfaces
│   ├── mobile/     Expo (React Native) — app del empleado
│   ├── admin/      React + Vite — panel de administración
│   └── tv/         Sin empezar — pantalla de anuncios/multimedia
├── packages/       Código compartido (sin uso todavía)
├── database_schema.sql (dentro de apps/backend)
└── README.md
```

---

## 2. Backend (`apps/backend`)

**Estado: funcional para empleados y administración.**

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

UPLOADS_DIR=./uploads/asistencia
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

### Pendiente en el backend

- [ ] HTTPS y despliegue en un servidor real (hoy corre en local, por HTTP).
- [ ] CORS está abierto a cualquier origen (`app.use(cors())`); hay que restringirlo antes de exponerlo fuera de la red local.
- [ ] Turnos que cruzan la medianoche no están soportados (la salida se busca por la fecha de hoy).
- [ ] No hay límite de intentos (rate limiting) en login ni en activación por PIN.
- [ ] Alta de administradores solo por script de terminal; no hay pantalla para gestionarlos.

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

- [ ] Turnos nocturnos (cruzan medianoche) no funcionan para registrar la salida.
- [ ] La cámara no verifica que haya un rostro real en la foto; cualquier imagen cuenta como evidencia.
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

- [ ] Sin pantalla para dar de alta o gestionar otros administradores (solo por script).
- [ ] Sin dashboard/reportes (gráficas de asistencia, retardos por departamento, etc.).
- [ ] Listado de asistencias limitado a 500 registros, sin paginación.
- [ ] Horarios y Asistencias no tienen aún el mismo nivel de validación de formulario que Empleados.

---

## 5. App de TV (`apps/tv`)

**Estado: no empezada.**

Pendiente todo: anuncios, subida de multimedia, armado de playlists y la
app que se instalaría en las pantallas físicas. El esquema de base de datos
(`database_schema.sql`) ya tiene las tablas para esto (`anuncios`,
`multimedia`, `playlists`, `playlist_items`, `dispositivos_tv`), pero no hay
backend ni frontend construidos todavía.

---

## 6. Base de datos

MySQL, esquema en `apps/backend/database_schema.sql`. Tablas ya en uso:
`admins`, `horarios`, `horarios_dias`, `departamentos`, `empleados`,
`dispositivos_empleado`, `jornadas`. Las de TV (`anuncios`, `multimedia`,
`playlists`, `playlist_items`, `dispositivos_tv`) existen en el esquema
pero aún sin uso.

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
5. **App de TV:** anuncios, multimedia y playlists — el módulo que falta por completo.
6. **Mezclar `feat/movil-conectado` a `main`** una vez validado todo lo anterior.
