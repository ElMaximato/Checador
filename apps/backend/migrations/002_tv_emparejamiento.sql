-- ============================================================
-- Migración 002: emparejamiento de pantallas de TV
-- Ejecutar UNA sola vez sobre una base ya creada con el esquema anterior.
-- (Si creas la base desde cero con database_schema.sql, ya lo incluye.)
-- ============================================================
USE control_asistencia;

ALTER TABLE dispositivos_tv
  ADD COLUMN estado ENUM('pendiente', 'emparejado', 'revocado') NOT NULL DEFAULT 'pendiente' AFTER ubicacion,
  ADD COLUMN codigo_emparejamiento VARCHAR(8) NULL AFTER estado,
  ADD COLUMN codigo_expira DATETIME NULL AFTER codigo_emparejamiento,
  ADD COLUMN claim_hash CHAR(64) NULL AFTER codigo_expira,
  ADD UNIQUE KEY uq_tv_codigo (codigo_emparejamiento);

-- Las filas que existieran antes nunca se emparejaron (la tabla no tenía uso).
DELETE FROM dispositivos_tv WHERE estado = 'pendiente' AND codigo_emparejamiento IS NULL;
