-- =============================================================================
-- Velvet Wallet — Esquema relacional (modelo canónico)  ·  PostgreSQL
-- -----------------------------------------------------------------------------
-- Proyecto APT: Velvet Wallet — App de finanzas personales consumidora del SFA
-- Asignatura : Capstone APT122 · Ingeniería en Informática · Duoc UC Pto. Montt
-- Integrantes: PADRON JOSSUE · TORRES PEDRO
-- Fase       : 1 (esquema preliminar) — corresponde al diagrama F1 de BD
-- Fecha      : 2026-09-15
--
-- Notas de diseño:
--  · Motor canónico en PostgreSQL. Los payloads crudos, logs y versiones de
--    modelos viven en MongoDB; aquí solo se referencian por ObjectId (texto).
--  · Se usan CHECK con conjuntos de valores en vez de tipos ENUM nativos,
--    porque ALTER de un CHECK es reversible sin recrear el tipo (RNF-37:
--    migraciones versionadas y reversibles).
--  · Los importes se guardan como NUMERIC. En CLP no hay decimales (RNF-29),
--    pero NUMERIC deja el esquema abierto a otras monedas sin cambios.
--  · Cifrado en reposo (RNF-16 / RF-31): se resuelve a nivel de almacenamiento
--    o con pgcrypto sobre las columnas sensibles en fase de implementación;
--    el esquema deja marcadas cuáles son (ver COMMENT ON).
-- =============================================================================

BEGIN;

-- Extensiones -----------------------------------------------------------------
-- gen_random_uuid() es núcleo desde PostgreSQL 13. citext da un email
-- case-insensitive sin tener que normalizar a mano en cada consulta.
CREATE EXTENSION IF NOT EXISTS citext;

-- =============================================================================
-- 1. USUARIO
-- =============================================================================
CREATE TABLE usuario (
    id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    email            citext        NOT NULL UNIQUE,
    nombre           varchar(120)  NOT NULL,
    hash_password    varchar(255)  NOT NULL,
    sueldo_declarado numeric(15,2)          CHECK (sueldo_declarado >= 0),
    created_at       timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE  usuario                  IS 'Titular de la cuenta Velvet Wallet.';
COMMENT ON COLUMN usuario.hash_password    IS 'Hash de la contraseña (Argon2/bcrypt). Nunca la contraseña en claro.';
COMMENT ON COLUMN usuario.sueldo_declarado IS 'Sueldo configurado por el usuario (RF-36). Dato sensible.';

-- =============================================================================
-- 2. INSTITUCION
-- =============================================================================
CREATE TABLE institucion (
    id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre           varchar(120)  NOT NULL,
    tipo             varchar(40)            CHECK (tipo IN ('banco','emisor_tarjeta','afp','fintech','otro')),
    participante_sfa boolean       NOT NULL DEFAULT false
);

COMMENT ON TABLE  institucion                  IS 'Institución financiera. participante_sfa distingue las que exponen APIs del estándar de las que solo entran por CSV.';
COMMENT ON COLUMN institucion.participante_sfa IS 'true = proveedor de información del SFA; false = ingesta por cartola/manual (RF-12).';

-- =============================================================================
-- 3. CATEGORIA  (jerárquica: subcategoría vía padre_id)
-- =============================================================================
CREATE TABLE categoria (
    id       uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    padre_id uuid         REFERENCES categoria(id) ON DELETE SET NULL,
    nombre   varchar(80)  NOT NULL,
    tipo     varchar(20)  NOT NULL CHECK (tipo IN ('gasto','ingreso'))
);

COMMENT ON TABLE  categoria          IS 'Catálogo de categorías de gasto/ingreso. padre_id modela subcategorías.';
COMMENT ON COLUMN categoria.padre_id IS 'Autoreferencia: categoría padre. NULL = categoría raíz.';

-- =============================================================================
-- 4. CONEXION  (usuario ↔ institución autorizada)
-- =============================================================================
CREATE TABLE conexion (
    id                    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id            uuid         NOT NULL REFERENCES usuario(id)     ON DELETE CASCADE,
    institucion_id        uuid         NOT NULL REFERENCES institucion(id) ON DELETE RESTRICT,
    estado                varchar(20)  NOT NULL DEFAULT 'activa'
                                       CHECK (estado IN ('activa','expirada','revocada','error')),
    ultima_sincronizacion timestamptz
);

COMMENT ON TABLE  conexion                       IS 'Vínculo autorizado entre un usuario y una institución del SFA.';
COMMENT ON COLUMN conexion.estado                IS 'El consentimiento expirado/revocado es un estado del usuario, no un error técnico (RF-03).';
COMMENT ON COLUMN conexion.ultima_sincronizacion IS 'Base para advertir antigüedad del dato (RF-35 / RNF-09).';

-- =============================================================================
-- 5. CUENTA
-- =============================================================================
CREATE TABLE cuenta (
    id                 uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    conexion_id        uuid          NOT NULL REFERENCES conexion(id) ON DELETE CASCADE,
    usuario_id         uuid          NOT NULL REFERENCES usuario(id)  ON DELETE CASCADE,
    tipo               varchar(40)            CHECK (tipo IN ('corriente','vista','ahorro','credito','tarjeta','otro')),
    numero_enmascarado varchar(40),
    moneda             varchar(3)    NOT NULL DEFAULT 'CLP',
    saldo              numeric(15,2),
    actualizado_at     timestamptz
);

COMMENT ON TABLE  cuenta                    IS 'Cuenta o producto financiero obtenido vía SFA o cartola (RF-05).';
COMMENT ON COLUMN cuenta.numero_enmascarado IS 'Solo dígitos finales enmascarados. No se almacena el número completo.';

-- =============================================================================
-- 6. CONSENTIMIENTO  (alcance RAR por conexión)
-- =============================================================================
CREATE TABLE consentimiento (
    id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    conexion_id      uuid         NOT NULL REFERENCES conexion(id) ON DELETE CASCADE,
    alcance_rar      jsonb        NOT NULL,
    fecha_inicio     timestamptz  NOT NULL DEFAULT now(),
    fecha_expiracion timestamptz,
    estado           varchar(20)  NOT NULL DEFAULT 'vigente'
                                  CHECK (estado IN ('vigente','expirado','revocado'))
);

COMMENT ON TABLE  consentimiento             IS 'Consentimiento granular otorgado por el usuario (RF-02 / RF-27).';
COMMENT ON COLUMN consentimiento.alcance_rar IS 'Detalle RAR: a qué cuentas y datos se accede y por cuánto tiempo (Rich Authorization Requests).';

-- =============================================================================
-- 7. SUSCRIPCION  (recurrencias detectadas)
-- =============================================================================
CREATE TABLE suscripcion (
    id                     uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id             uuid          NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    nombre                 varchar(120)  NOT NULL,
    periodicidad           varchar(20)            CHECK (periodicidad IN ('semanal','quincenal','mensual','bimestral','trimestral','anual','otra')),
    monto_esperado         numeric(15,2),
    proxima_fecha_estimada date,
    estado                 varchar(20)   NOT NULL DEFAULT 'detectada'
                                         CHECK (estado IN ('detectada','confirmada','descartada'))
);

COMMENT ON TABLE  suscripcion        IS 'Gasto recurrente detectado por el algoritmo (RF-20…RF-22).';
COMMENT ON COLUMN suscripcion.estado IS 'detectada hasta que el usuario la confirma o descarta (RF-22).';

-- =============================================================================
-- 8. META  (metas de ahorro)
-- =============================================================================
CREATE TABLE meta (
    id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id            uuid          NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    nombre                varchar(120)  NOT NULL,
    monto_objetivo        numeric(15,2) NOT NULL CHECK (monto_objetivo > 0),
    fecha_objetivo        date,
    probabilidad_estimada numeric(5,4)           CHECK (probabilidad_estimada BETWEEN 0 AND 1)
);

COMMENT ON TABLE  meta                       IS 'Meta de ahorro del usuario (RF-26).';
COMMENT ON COLUMN meta.probabilidad_estimada IS 'Probabilidad de cumplimiento que entrega la proyección Monte Carlo (RF-24). 0..1.';

-- =============================================================================
-- 9. TRANSACCION  (ledger canónico)
-- =============================================================================
CREATE TABLE transaccion (
    id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    cuenta_id               uuid          NOT NULL REFERENCES cuenta(id)      ON DELETE CASCADE,
    categoria_id            uuid                   REFERENCES categoria(id)   ON DELETE SET NULL,
    suscripcion_id          uuid                   REFERENCES suscripcion(id) ON DELETE SET NULL,
    payload_crudo_ref       varchar(24),
    monto                   numeric(15,2) NOT NULL,
    moneda                  varchar(3)    NOT NULL DEFAULT 'CLP',
    fecha                   date          NOT NULL,
    glosa_original          varchar(255),
    glosa_normalizada       varchar(255),
    estado                  varchar(20)   NOT NULL DEFAULT 'confirmado'
                                          CHECK (estado IN ('pendiente','confirmado','excluido')),
    hash_dedup              varchar(64)   NOT NULL UNIQUE,
    confianza_clasificacion numeric(5,4)           CHECK (confianza_clasificacion BETWEEN 0 AND 1),
    es_recurrente           boolean       NOT NULL DEFAULT false,
    created_at              timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE  transaccion                         IS 'Movimiento normalizado al modelo canónico (RF-08).';
COMMENT ON COLUMN transaccion.categoria_id            IS 'NULL permitido: el clasificador se abstiene cuando la confianza es baja (RF-17 / RNF-33).';
COMMENT ON COLUMN transaccion.payload_crudo_ref       IS 'ObjectId del documento en MongoDB (PAYLOAD_CRUDO) del que se originó (RF-06 / RNF-32).';
COMMENT ON COLUMN transaccion.hash_dedup              IS 'Clave de deduplicación entre fuentes: un movimiento canónico por hash (RF-09).';
COMMENT ON COLUMN transaccion.confianza_clasificacion IS 'Confianza [0..1] del clasificador para categoria_id.';
COMMENT ON COLUMN transaccion.glosa_normalizada       IS 'Glosa limpia (p. ej. "UBER *EATS 8829" → "Uber Eats") (RF-10).';

-- =============================================================================
-- 10. CORRECCION  (capa de correcciones del usuario, no sobrescribe el origen)
-- =============================================================================
CREATE TABLE correccion (
    id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    transaccion_id uuid         NOT NULL REFERENCES transaccion(id) ON DELETE CASCADE,
    usuario_id     uuid         NOT NULL REFERENCES usuario(id)     ON DELETE CASCADE,
    tipo           varchar(30)  NOT NULL CHECK (tipo IN ('recategorizar','marcar_duplicado','excluir','dividir')),
    valor          jsonb,
    created_at     timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  correccion       IS 'Corrección del usuario como capa separada; el dato de origen no se modifica (RF-14 / RNF-31).';
COMMENT ON COLUMN correccion.valor IS 'Detalle de la corrección (nueva categoría, particiones al dividir, etc.).';

-- =============================================================================
-- 11. BITACORA_AUDITORIA  (registro inmutable de accesos a datos personales)
-- =============================================================================
CREATE TABLE bitacora_auditoria (
    id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id  uuid         REFERENCES usuario(id) ON DELETE SET NULL,
    accion      varchar(60)  NOT NULL,
    recurso     varchar(120) NOT NULL,
    ip_origen   inet,
    ocurrido_at timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  bitacora_auditoria            IS 'Registro de actividades de tratamiento (RNF-18 / RF-28). Solo INSERT; no se actualiza ni borra.';
COMMENT ON COLUMN bitacora_auditoria.usuario_id IS 'ON DELETE SET NULL: al suprimir la cuenta el registro se anonimiza pero sobrevive (RNF-22).';

-- =============================================================================
-- Índices  (además de los UNIQUE/PK ya creados)
-- =============================================================================
CREATE INDEX idx_conexion_usuario        ON conexion (usuario_id);
CREATE INDEX idx_conexion_institucion    ON conexion (institucion_id);
CREATE INDEX idx_cuenta_conexion         ON cuenta (conexion_id);
CREATE INDEX idx_cuenta_usuario          ON cuenta (usuario_id);
CREATE INDEX idx_consentimiento_conexion ON consentimiento (conexion_id);
CREATE INDEX idx_suscripcion_usuario     ON suscripcion (usuario_id);
CREATE INDEX idx_meta_usuario            ON meta (usuario_id);
CREATE INDEX idx_categoria_padre         ON categoria (padre_id);

-- Transacción: los filtros más frecuentes son por cuenta y por rango de fecha.
CREATE INDEX idx_transaccion_cuenta      ON transaccion (cuenta_id);
CREATE INDEX idx_transaccion_categoria   ON transaccion (categoria_id);
CREATE INDEX idx_transaccion_suscripcion ON transaccion (suscripcion_id);
CREATE INDEX idx_transaccion_fecha       ON transaccion (fecha);
CREATE INDEX idx_transaccion_cuenta_fecha ON transaccion (cuenta_id, fecha DESC);
-- Bandeja "Por revisar": movimientos sin categoría (RF-18).
CREATE INDEX idx_transaccion_sin_categoria ON transaccion (cuenta_id) WHERE categoria_id IS NULL;

CREATE INDEX idx_correccion_transaccion  ON correccion (transaccion_id);
CREATE INDEX idx_correccion_usuario      ON correccion (usuario_id);
CREATE INDEX idx_bitacora_usuario        ON bitacora_auditoria (usuario_id);
CREATE INDEX idx_bitacora_ocurrido       ON bitacora_auditoria (ocurrido_at DESC);

COMMIT;

-- =============================================================================
-- Fin del esquema.
-- Fuera de alcance en Fase 1 (según el diagrama entregado): no hay tabla
-- CREDITO independiente. Los productos de crédito se ingieren como CUENTA
-- (tipo='credito'); la cuota mensual entra al excedente vía RF-23. Si en Fase 2
-- se decide persistir plazo/tasa/saldo del crédito, se agrega en una migración.
-- =============================================================================
