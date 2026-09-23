-- ============================================================
-- SISTEMA DE CONTROL DE ASISTENCIA
-- Esquema de Base de Datos (MySQL)
-- Módulos: Empleados, Horarios, Dispositivos, Jornadas,
--          Anuncios, Multimedia, Playlists, TV, Admins
-- ============================================================

-- ------------------------------------------------------------
-- MÓDULO: ADMINISTRADORES (Panel Web)
-- ------------------------------------------------------------
CREATE TABLE admins (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    nombre          VARCHAR(150) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    rol             ENUM('super_admin', 'rh', 'supervisor') NOT NULL DEFAULT 'rh',
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- MÓDULO: HORARIOS Y TOLERANCIA
-- ------------------------------------------------------------
CREATE TABLE horarios (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    nombre              VARCHAR(100) NOT NULL,           -- ej: "Turno Matutino"
    hora_entrada        TIME NOT NULL,                   -- ej: 08:00:00
    hora_salida         TIME NOT NULL,                   -- ej: 18:00:00 (referencia, no bloquea)
    tolerancia_minutos  INT NOT NULL DEFAULT 10,
    duracion_jornada_horas INT NOT NULL DEFAULT 10,       -- vida del token de jornada
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Días de la semana en que aplica cada horario (L-V, etc.)
CREATE TABLE horarios_dias (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    horario_id  INT NOT NULL,
    dia_semana  TINYINT NOT NULL,   -- 1=Lunes ... 7=Domingo
    FOREIGN KEY (horario_id) REFERENCES horarios(id) ON DELETE CASCADE,
    UNIQUE KEY uq_horario_dia (horario_id, dia_semana)
);

-- ------------------------------------------------------------
-- MÓDULO: EMPLEADOS
-- ------------------------------------------------------------
CREATE TABLE departamentos (
    id      INT AUTO_INCREMENT PRIMARY KEY,
    nombre  VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE empleados (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    nombre          VARCHAR(150) NOT NULL,
    puesto          VARCHAR(100) NOT NULL,
    departamento_id INT NOT NULL,
    horario_id      INT NOT NULL,
    estado          ENUM('activo', 'inactivo', 'baja') NOT NULL DEFAULT 'activo',
    fecha_ingreso   DATE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (departamento_id) REFERENCES departamentos(id),
    FOREIGN KEY (horario_id) REFERENCES horarios(id)
);

-- ------------------------------------------------------------
-- MÓDULO: DISPOSITIVOS (sesión larga por teléfono / PIN)
-- ------------------------------------------------------------
CREATE TABLE dispositivos_empleado (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    empleado_id         INT NOT NULL,
    device_id           VARCHAR(255) NOT NULL,          -- identificador único del teléfono
    device_info         VARCHAR(255),                   -- modelo, OS, versión app
    pin_hash            VARCHAR(255) NOT NULL,           -- PIN de activación (hasheado)
    pin_usado           BOOLEAN NOT NULL DEFAULT FALSE,
    refresh_token_hash  VARCHAR(255),                    -- token de sesión larga (hasheado)
    fecha_activacion    TIMESTAMP NULL,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,   -- FALSE = revocado por admin
    fecha_revocacion    TIMESTAMP NULL,
    revocado_por        INT NULL,                        -- admin que revocó
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE,
    FOREIGN KEY (revocado_por) REFERENCES admins(id),
    INDEX idx_empleado_activo (empleado_id, activo)
);

-- ------------------------------------------------------------
-- MÓDULO: JORNADAS / ASISTENCIA (token corto de 10h, 1 por día)
-- ------------------------------------------------------------
CREATE TABLE jornadas (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    empleado_id             INT NOT NULL,
    dispositivo_id          INT NOT NULL,               -- desde qué dispositivo se generó
    fecha                   DATE NOT NULL,
    hora_entrada            DATETIME NOT NULL,
    hora_expiracion_token   DATETIME NOT NULL,          -- hora_entrada + duracion_jornada_horas
    hora_salida             DATETIME NULL,
    token_jornada_hash      VARCHAR(255) NOT NULL,
    estado                  ENUM('activa', 'cerrada', 'expirada_sin_salida') NOT NULL DEFAULT 'activa',
    puntualidad             ENUM('a_tiempo', 'tarde') NOT NULL,
    minutos_retardo         INT NOT NULL DEFAULT 0,
    foto_entrada_url        VARCHAR(500) NOT NULL,
    foto_salida_url         VARCHAR(500) NULL,
    revisada_por_admin      BOOLEAN NOT NULL DEFAULT FALSE,  -- flag para casos "expirada_sin_salida"
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empleado_id) REFERENCES empleados(id),
    FOREIGN KEY (dispositivo_id) REFERENCES dispositivos_empleado(id),
    UNIQUE KEY uq_empleado_fecha (empleado_id, fecha),   -- garantiza 1 jornada/día/empleado
    INDEX idx_fecha_estado (fecha, estado)
);

-- ------------------------------------------------------------
-- MÓDULO: ANUNCIOS (para TV)
-- ------------------------------------------------------------
CREATE TABLE anuncios (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    titulo       VARCHAR(200) NOT NULL,
    contenido    TEXT NOT NULL,
    fecha_inicio DATETIME NOT NULL,
    fecha_fin    DATETIME NOT NULL,
    activo       BOOLEAN NOT NULL DEFAULT TRUE,
    creado_por   INT NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creado_por) REFERENCES admins(id)
);

-- ------------------------------------------------------------
-- MÓDULO: MULTIMEDIA Y PLAYLISTS (para TV)
-- ------------------------------------------------------------
CREATE TABLE multimedia (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    tipo         ENUM('imagen', 'musica', 'video') NOT NULL,
    nombre       VARCHAR(200) NOT NULL,
    url          VARCHAR(500) NOT NULL,
    duracion_seg INT NULL,                 -- para video/musica
    tamano_bytes BIGINT NULL,
    subido_por   INT NOT NULL,
    activo       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subido_por) REFERENCES admins(id)
);

CREATE TABLE playlists (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    nombre     VARCHAR(150) NOT NULL,
    activo     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE playlist_items (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    playlist_id       INT NOT NULL,
    multimedia_id     INT NOT NULL,
    orden             INT NOT NULL,
    duracion_override INT NULL,            -- sobreescribe duración default si aplica
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (multimedia_id) REFERENCES multimedia(id) ON DELETE CASCADE,
    UNIQUE KEY uq_playlist_orden (playlist_id, orden)
);

-- ------------------------------------------------------------
-- MÓDULO: DISPOSITIVOS TV
-- ------------------------------------------------------------
CREATE TABLE dispositivos_tv (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    nombre            VARCHAR(100) NOT NULL,      -- ej: "TV Recepción"
    ubicacion         VARCHAR(150),
    playlist_activa_id INT NULL,
    ultimo_ping       TIMESTAMP NULL,
    activo            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlist_activa_id) REFERENCES playlists(id)
);

-- ============================================================
-- NOTAS DE IMPLEMENTACIÓN
-- ============================================================
-- 1. La UNIQUE KEY (empleado_id, fecha) en `jornadas` garantiza
--    1 sola jornada por empleado por día a nivel de base de datos,
--    no solo a nivel de lógica de aplicación.
--
-- 2. `puntualidad` y `minutos_retardo` se calculan UNA VEZ al
--    momento del check-in (comparando hora_entrada contra
--    horarios.hora_entrada + tolerancia_minutos) y quedan fijos,
--    para que cambios futuros en tolerancia no alteren historial.
--
-- 3. Un job programado (cron) debe revisar jornadas con
--    estado='activa' y hora_expiracion_token < NOW(), y marcarlas
--    como 'expirada_sin_salida' para que el admin las revise.
--
-- 4. `dispositivos_empleado.activo = FALSE` es la revocación
--    manual del admin; no tiene expiración automática por tiempo.
-- ============================================================
