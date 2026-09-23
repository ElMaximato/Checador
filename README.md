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
Necesita que `apps/backend` esté corriendo. En dispositivo físico,
apunta la URL de la API a la IP local de tu máquina (no `localhost`).

### TV y Admin
Aún no iniciados.

## Flujo de trabajo en equipo (sugerido)

- Cada quien trabaja en su carpeta (`apps/mobile`, `apps/backend`, etc.)
  sin afectar las demás.
- Rama por feature: `feature/mobile-login`, `feature/backend-auth`, etc.
- Antes de un PR grande a una app, verificar que las demás sigan
  corriendo (sobre todo si se toca `packages/shared` o el contrato de
  la API en `apps/backend`).
