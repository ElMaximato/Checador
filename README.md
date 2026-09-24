# Sistema de Control de Asistencia

Monorepo del proyecto: 3 apps + backend compartido.

## Estructura

```
apps/
  mobile/    → App del Checador (Expo / React Native)
  tv/        → App para TV OS — pendiente
  admin/     → Panel administrativo Web — pendiente
  backend/   → API central + WebSocket (Node/Express + MySQL)
packages/
  shared/    → Código compartido entre apps (tipos, cliente de API, constantes) — pendiente
```

Cada carpeta bajo `apps/` es un proyecto independiente: tiene su propio
`package.json`, sus propias dependencias (`node_modules` no se comparte)
y corre con su propio comando. Lo único que comparten es este repositorio
y, más adelante, lo que pongamos en `packages/shared`.

## Cómo correr cada app

### Backend
```bash
cd apps/backend
cp .env.example .env      # llenar credenciales de MySQL
mysql -u root -p control_asistencia < database_schema.sql
npm install
npm run dev                # puerto 4000
```

### Mobile (Checador)
```bash
cd apps/mobile
npm install
npx expo start
```
Necesita que `apps/backend` esté corriendo. **Importante:** en
`apps/mobile/src/api/client.ts`, `API_BASE_URL` apunta a
`http://localhost:4000`. En dispositivo físico eso NO funciona
(localhost sería el propio teléfono) — cámbialo por la IP local de tu
computadora en la red (ej. `http://192.168.1.50:4000`). En emulador de
Android, usa `http://10.0.2.2:4000`.

**Flujo para probarla de punta a punta:**
1. Levanta el backend y da de alta un empleado + horario directo en
   MySQL (aún no hay UI de Admin — ver pendientes).
2. Genera su PIN: `POST /api/auth/dispositivos/:empleadoId/generar-pin`.
3. Abre la app → pantalla de Activación → ingresa el ID de empleado y
   el PIN → queda vinculada.
4. Cierra y vuelve a abrir la app: pedirá tu huella (candado diario) y
   entrarás a Home, ya con la jornada real consultada al backend.
5. "Registrar entrada/salida" → huella → foto real → el backend calcula
   puntualidad y la Confirmation muestra la respuesta real.

### TV y Admin
Aún no iniciados.

## Flujo de trabajo en equipo (sugerido)

- Cada quien trabaja en su carpeta (`apps/mobile`, `apps/backend`, etc.)
  sin afectar las demás.
- Rama por feature: `feature/mobile-login`, `feature/backend-auth`, etc.
- Antes de un PR grande a una app, verificar que las demás sigan
  corriendo (sobre todo si se toca `packages/shared` o el contrato de
  la API en `apps/backend`).

## Estado del móvil

La app ya está **conectada al backend real**: activación por PIN,
sesión guardada con `expo-secure-store`, candado biométrico diario,
consulta de jornada del día, y envío real de entrada/salida con foto.
Pendiente: nombre de perfil y resumen mensual en Home/Profile siguen
usando datos de ejemplo (faltan esos endpoints en el backend).
