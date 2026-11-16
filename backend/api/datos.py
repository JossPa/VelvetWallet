# -*- coding: utf-8 -*-
"""
Endpoints de datos del usuario: movimientos, cuentas y un resumen.

Todos exigen sesión (dependen de `usuario_actual`) y TODAS las consultas filtran
por el usuario del token. Ese filtro (WHERE usuario_id = <token>) es lo que
garantiza que cada usuario vea únicamente su propia información.

  GET    /api/movimientos                  -> lista de movimientos del usuario
  POST   /api/movimientos                  -> registra un gasto en efectivo (RF-13)
  DELETE /api/movimientos/{id}             -> borra un gasto registrado a mano
  PUT    /api/movimientos/{id}/categoria   -> el usuario corrige la categoría
  GET    /api/cuentas                      -> cuentas del usuario
  GET    /api/resumen                      -> totales (ingresos, gastos, saldo)
"""
import hashlib
import uuid
from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from psycopg.rows import dict_row
from psycopg.types.json import Json
from pydantic import BaseModel, Field

from . import bitacora, config, db
from .sesion_actual import usuario_actual

import psycopg

router = APIRouter(prefix="/api", tags=["Datos del usuario"])


def _conectar_dict():
    """Conexión que devuelve filas como diccionarios (más cómodo para armar JSON)."""
    return db.conectar(diccionarios=True)


# Equivalencia entre la taxonomía del banco y la nuestra. Es la **primera capa
# de la cascada** del clasificador (E2): lo que la institución ya clasificó se
# resuelve sin modelo. Cada proveedor usa su propia taxonomía y no hay
# equivalencia común, así que esta tabla es parte del trabajo de normalizar.
#
# El clasificador (backend/clasificador) llena `categoria_id` al ingerir; esta
# tabla solo cubre lo que el clasificador dejó sin categoría pero el banco sí
# mandó categorizado.
_CATEGORIA_PROPIA = {
    "Alimentos": "Supermercado",
    "Restaurantes": "Delivery",
    "Entretenimiento": "Entretención",
    "Servicios": "Servicios",
    "Vivienda": "Vivienda",
    "Transporte": "Transporte",
    "Vestuario": "Vestuario",
    "Salud": "Salud",
    "Educacion": "Educación",
    "Educación": "Educación",
}


def _movimiento(r: dict) -> dict:
    """Pasa una fila de la consulta a la forma que espera la app (camelCase)."""
    categoria_banco = r.get("categoria_origen")

    # Primero lo que diga el clasificador; si todavía no clasificó, lo que
    # mandó el banco traducido a nuestra taxonomía. Si no hay ninguna de las
    # dos, queda sin categoría: el sistema se abstiene en vez de inventar
    # (RF-17 / RNF-33) y el movimiento aparece en la bandeja Por revisar.
    categoria = r["categoria"] or _CATEGORIA_PROPIA.get(categoria_banco or "")
    tiene_categoria = categoria is not None

    # Quién decidió la categoría. Es trazabilidad de la decisión: permite
    # responder "¿por qué esto quedó en Supermercado?".
    #
    # La confianza solo tiene sentido para el modelo: una regla o una
    # corrección del usuario no son parciales, aciertan o no.
    confianza = float(r["confianza"]) if r.get("confianza") is not None else None
    # Un gasto registrado a mano lo categorizó la persona al anotarlo: cuenta
    # como decisión suya, no como acierto del clasificador.
    corregida = bool(r.get("corregida")) or not r["participante_sfa"]
    if corregida and r["categoria"] is not None:
        origen_clasificacion = "usuario"
        confianza = None
    elif r["categoria"] is not None:
        origen_clasificacion = "modelo" if confianza is not None else "regla"
    elif tiene_categoria:
        origen_clasificacion = "banco"
    else:
        origen_clasificacion = None

    return {
        "id": str(r["id"]),
        "cuentaId": r["cuenta_externa"],
        "institucion": r["institucion"],
        "fecha": (r["fecha"].isoformat() + "T12:00:00-03:00") if r["fecha"] else None,
        "monto": float(r["monto"]),
        "moneda": r["moneda"],
        "comercio": r["glosa_normalizada"] or r["glosa_original"],
        "glosaOriginal": r["glosa_original"],
        "categoria": categoria,
        "categoriaBanco": categoria_banco,
        "estadoCategoria": ("corregida" if corregida and r["categoria"] is not None
                            else "automatica" if tiene_categoria else "sin_categoria"),
        "origenClasificacion": origen_clasificacion,
        "confianza": confianza,
        "esRecurrente": r["es_recurrente"],
        "excluido": r["estado"] == "excluido",
        "origen": "sfa" if r["participante_sfa"] else "manual",
        "recibidoEn": r["created_at"].isoformat() if r["created_at"] else None,
        "payloadCrudoRef": r["payload_crudo_ref"],
        "correcciones": r.get("correcciones") or [],
    }


# Lo que se lee de cada movimiento. `corr` trae las correcciones del usuario:
# si recategorizó, la categoría es la de él (origen "usuario").
_SELECT_MOVIMIENTOS = """
    SELECT t.id, t.monto, t.moneda, t.fecha, t.glosa_original,
           t.glosa_normalizada, t.estado, t.es_recurrente,
           t.payload_crudo_ref, t.created_at, t.categoria_origen,
           t.confianza_clasificacion AS confianza,
           c.id_externo        AS cuenta_externa,
           cat.nombre          AS categoria,
           inst.nombre         AS institucion,
           inst.participante_sfa,
           corr.corregida, corr.correcciones
    FROM transaccion t
    JOIN cuenta c         ON c.id  = t.cuenta_id
    JOIN conexion cx      ON cx.id = c.conexion_id
    JOIN institucion inst ON inst.id = cx.institucion_id
    LEFT JOIN categoria cat ON cat.id = t.categoria_id
    LEFT JOIN LATERAL (
        SELECT bool_or(co.tipo = 'recategorizar') AS corregida,
               json_agg(json_build_object(
                   'tipo', co.tipo,
                   'fecha', to_char(co.created_at AT TIME ZONE 'UTC',
                                    'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                   'detalle', co.valor->>'categoria')
                   ORDER BY co.created_at) AS correcciones
        FROM correccion co WHERE co.transaccion_id = t.id
    ) corr ON true
"""


@router.get("/movimientos", summary="Movimientos del usuario autenticado")
def listar_movimientos(
    peticion: Request,
    usuario_id: str = Depends(usuario_actual),
    limite: int = Query(100, ge=1, le=500),
    desplazamiento: int = Query(0, ge=0),
):
    with _conectar_dict() as conn:
        filas = conn.execute(
            _SELECT_MOVIMIENTOS + """
            WHERE c.usuario_id = %s
            ORDER BY t.fecha DESC, t.created_at DESC
            LIMIT %s OFFSET %s
            """,
            (usuario_id, limite, desplazamiento),
        ).fetchall()

        # Leer los movimientos es un tratamiento de datos personales y queda
        # registrado (Ley 21.719). Solo la primera página —paginar hacia abajo
        # es la misma consulta— y agrupado por media hora, porque la app
        # recarga esta lista cada vez que se abre y una entrada por recarga
        # haría la bitácora ilegible para la persona.
        if desplazamiento == 0:
            bitacora.registrar(conn, usuario_id, "datos.leer",
                               f"{len(filas)} movimientos", bitacora.ip_de(peticion),
                               agrupar_minutos=30)
            conn.commit()

    return {"movimientos": [_movimiento(r) for r in filas], "total": len(filas)}


# ───────────────────── gastos registrados a mano (RF-13) ─────────────────────
#
# El efectivo no pasa por ningún banco, así que no llega por el estándar: la
# persona lo anota. Para que cuente igual que el resto —en el resumen del mes,
# el flujo, las metas y la detección de recurrencias— entra al mismo modelo
# canónico: una transacción de una cuenta "Efectivo", de una institución que
# NO es participante del SFA. Eso basta para distinguirla en todo el sistema
# (origen "manual") sin tablas ni caminos aparte.

INSTITUCION_EFECTIVO = "Efectivo"
CUENTA_EFECTIVO = "EFECTIVO"
ZONA = ZoneInfo("America/Santiago")


def _cuenta_efectivo(conn, usuario_id: str):
    """Get-or-create de la cuenta Efectivo del usuario. Devuelve cuenta_id."""
    # Serializa la creación por usuario: dos registros simultáneos no deben
    # crear dos cuentas Efectivo.
    conn.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", ("efectivo:" + usuario_id,))
    fila = conn.execute(
        """SELECT c.id FROM cuenta c
           JOIN conexion cx      ON cx.id = c.conexion_id
           JOIN institucion inst ON inst.id = cx.institucion_id
           WHERE c.usuario_id = %s AND inst.nombre = %s AND NOT inst.participante_sfa
           LIMIT 1""",
        (usuario_id, INSTITUCION_EFECTIVO)).fetchone()
    if fila:
        return fila["id"]

    inst = conn.execute(
        "SELECT id FROM institucion WHERE nombre = %s AND NOT participante_sfa LIMIT 1",
        (INSTITUCION_EFECTIVO,)).fetchone()
    if inst is None:
        inst = conn.execute(
            """INSERT INTO institucion (nombre, tipo, participante_sfa)
               VALUES (%s, 'otro', false) RETURNING id""",
            (INSTITUCION_EFECTIVO,)).fetchone()
    cx = conn.execute(
        """INSERT INTO conexion (usuario_id, institucion_id, estado)
           VALUES (%s, %s, 'activa') RETURNING id""",
        (usuario_id, inst["id"])).fetchone()
    return conn.execute(
        """INSERT INTO cuenta (conexion_id, usuario_id, id_externo, tipo, moneda)
           VALUES (%s, %s, %s, 'otro', 'CLP') RETURNING id""",
        (cx["id"], usuario_id, CUENTA_EFECTIVO)).fetchone()["id"]


def _categoria_id(conn, nombre: str):
    """Id de la categoría de gasto con ese nombre; la crea si no existe."""
    fila = conn.execute(
        "SELECT id FROM categoria WHERE nombre = %s AND tipo = 'gasto' ORDER BY id LIMIT 1",
        (nombre,)).fetchone()
    if fila is None:
        fila = conn.execute(
            "INSERT INTO categoria (nombre, tipo) VALUES (%s, 'gasto') RETURNING id",
            (nombre,)).fetchone()
    return fila["id"]


class GastoManual(BaseModel):
    monto: int = Field(gt=0, le=50_000_000, description="En pesos, positivo: se guarda como cargo.")
    descripcion: str = Field(min_length=1, max_length=120, description="En qué se gastó.")
    fecha: date
    categoria: str | None = Field(None, max_length=80,
                                  description="Si falta, queda en Por revisar como cualquier otro.")


@router.post("/movimientos", status_code=201, summary="Registrar un gasto en efectivo")
def registrar_gasto(datos: GastoManual, peticion: Request,
                    usuario_id: str = Depends(usuario_actual)):
    descripcion = " ".join(datos.descripcion.split())
    if not descripcion:
        raise HTTPException(status_code=422, detail="Escribe en qué gastaste.")
    hoy = datetime.now(ZONA).date()
    if datos.fecha > hoy:
        raise HTTPException(status_code=422, detail="La fecha no puede ser futura.")
    if datos.fecha.year < 2000:
        raise HTTPException(status_code=422, detail="Revisa la fecha.")
    categoria = (datos.categoria or "").strip() or None

    with _conectar_dict() as conn:
        cuenta_id = _cuenta_efectivo(conn, usuario_id)
        categoria_id = _categoria_id(conn, categoria) if categoria else None
        # hash_dedup es único en todo el ledger. Un gasto anotado a mano no
        # tiene con qué deduplicarse (no llega por otra fuente), así que se le
        # da uno propio: dos cafés iguales el mismo día son dos cafés.
        huella = hashlib.sha256(("manual:" + uuid.uuid4().hex).encode()).hexdigest()
        nuevo = conn.execute(
            """INSERT INTO transaccion
                 (cuenta_id, categoria_id, monto, moneda, fecha,
                  glosa_original, glosa_normalizada, estado, hash_dedup)
               VALUES (%s, %s, %s, 'CLP', %s, %s, %s, 'confirmado', %s)
               RETURNING id""",
            (cuenta_id, categoria_id, -datos.monto, datos.fecha,
             descripcion, descripcion, huella)).fetchone()
        # Sin la descripción: la bitácora dice qué se hizo, no copia los datos.
        bitacora.registrar(conn, usuario_id, "movimiento.crear",
                           "gasto en efectivo", bitacora.ip_de(peticion))
        r = conn.execute(_SELECT_MOVIMIENTOS + " WHERE t.id = %s", (nuevo["id"],)).fetchone()
    return _movimiento(r)


@router.delete("/movimientos/{movimiento_id}", status_code=204,
               summary="Borrar un gasto registrado a mano")
def borrar_gasto(movimiento_id: str, peticion: Request,
                 usuario_id: str = Depends(usuario_actual)):
    """
    Solo lo que la persona anotó. Un movimiento del banco no se borra: si no
    corresponde, se corrige (excluir, marcar duplicado) y el dato de origen se
    conserva (RF-14).
    """
    with _conectar_dict() as conn:
        fila = conn.execute(
            """SELECT t.id, inst.participante_sfa
               FROM transaccion t
               JOIN cuenta c         ON c.id = t.cuenta_id
               JOIN conexion cx      ON cx.id = c.conexion_id
               JOIN institucion inst ON inst.id = cx.institucion_id
               WHERE t.id::text = %s AND c.usuario_id = %s""",
            (movimiento_id, usuario_id)).fetchone()
        if fila is None:
            raise HTTPException(status_code=404, detail="Movimiento no encontrado.")
        if fila["participante_sfa"]:
            raise HTTPException(
                status_code=409,
                detail="Solo se pueden borrar los gastos que registraste tú. "
                       "Un movimiento del banco se corrige, no se borra.")
        conn.execute("DELETE FROM transaccion WHERE id = %s", (fila["id"],))
        bitacora.registrar(conn, usuario_id, "movimiento.borrar",
                           "gasto en efectivo", bitacora.ip_de(peticion))
    return Response(status_code=204)


class NuevaCategoria(BaseModel):
    categoria: str = Field(min_length=1, max_length=80)


@router.put("/movimientos/{movimiento_id}/categoria",
            summary="Corregir (o asignar) la categoría de un movimiento")
def corregir_categoria(movimiento_id: str, datos: NuevaCategoria, peticion: Request,
                       usuario_id: str = Depends(usuario_actual)):
    """
    El usuario decide la categoría, por ejemplo en "Por revisar". El dato del
    banco no se toca: la decisión queda en `correccion` (quién, cuándo, de qué
    a qué) y la categoría del movimiento pasa a ser la de él. Ni una
    re-sincronización ni un modelo nuevo la vuelven a cambiar.

    Esas correcciones son los ejemplos con que se reentrena el clasificador,
    solo de quienes consintieron esa finalidad (ver /api/privacidad).
    """
    nombre = datos.categoria.strip()
    if not nombre:
        raise HTTPException(status_code=422, detail="La categoría no puede quedar vacía.")
    with _conectar_dict() as conn:
        actual = conn.execute(
            """
            SELECT t.id, cat.nombre AS categoria, t.confianza_clasificacion
            FROM transaccion t
            JOIN cuenta c ON c.id = t.cuenta_id
            LEFT JOIN categoria cat ON cat.id = t.categoria_id
            WHERE t.id::text = %s AND c.usuario_id = %s
            """,
            (movimiento_id, usuario_id),
        ).fetchone()
        if actual is None:
            # Ajeno o inexistente: misma respuesta, no se filtra nada.
            raise HTTPException(status_code=404, detail="Movimiento no encontrado.")

        categoria_id = _categoria_id(conn, nombre)
        conn.execute(
            "INSERT INTO correccion (transaccion_id, usuario_id, tipo, valor) "
            "VALUES (%s, %s, 'recategorizar', %s)",
            (actual["id"], usuario_id, Json({
                "categoria": nombre,
                "anterior": actual["categoria"],
                "confianza_anterior": float(actual["confianza_clasificacion"])
                if actual["confianza_clasificacion"] is not None else None,
            })))
        conn.execute(
            "UPDATE transaccion SET categoria_id = %s, confianza_clasificacion = NULL "
            "WHERE id = %s", (categoria_id, actual["id"]))
        bitacora.registrar(conn, usuario_id, "categoria.corregir",
                           f"{actual['categoria'] or 'sin categoría'} → {nombre}",
                           bitacora.ip_de(peticion))
        r = conn.execute(_SELECT_MOVIMIENTOS + " WHERE t.id = %s", (actual["id"],)).fetchone()
    return _movimiento(r)


@router.get("/cuentas", summary="Cuentas del usuario autenticado")
def listar_cuentas(usuario_id: str = Depends(usuario_actual)):
    with _conectar_dict() as conn:
        filas = conn.execute(
            """
            SELECT c.id, c.id_externo, c.tipo, c.numero_enmascarado,
                   c.moneda, c.saldo, c.actualizado_at,
                   inst.nombre AS institucion
            FROM cuenta c
            JOIN conexion cx      ON cx.id = c.conexion_id
            JOIN institucion inst ON inst.id = cx.institucion_id
            WHERE c.usuario_id = %s
            ORDER BY inst.nombre, c.id_externo
            """,
            (usuario_id,),
        ).fetchall()

    cuentas = [
        {
            "id": str(r["id"]),
            "idExterno": r["id_externo"],
            "institucion": r["institucion"],
            "tipo": r["tipo"],
            "numeroEnmascarado": r["numero_enmascarado"],
            "moneda": r["moneda"],
            "saldo": float(r["saldo"]) if r["saldo"] is not None else None,
            "actualizadoEn": r["actualizado_at"].isoformat() if r["actualizado_at"] else None,
        }
        for r in filas
    ]
    return {"cuentas": cuentas, "total": len(cuentas)}


@router.get("/resumen", summary="Totales del usuario autenticado")
def resumen(usuario_id: str = Depends(usuario_actual)):
    with _conectar_dict() as conn:
        tot = conn.execute(
            """
            SELECT
              COALESCE(SUM(CASE WHEN t.monto > 0 THEN t.monto ELSE 0 END), 0) AS ingresos,
              COALESCE(SUM(CASE WHEN t.monto < 0 THEN -t.monto ELSE 0 END), 0) AS gastos,
              COUNT(*) AS movimientos
            FROM transaccion t
            JOIN cuenta c ON c.id = t.cuenta_id
            WHERE c.usuario_id = %s AND t.estado <> 'excluido'
            """,
            (usuario_id,),
        ).fetchone()

        saldo = conn.execute(
            "SELECT COALESCE(SUM(saldo), 0) AS saldo_total FROM cuenta WHERE usuario_id = %s",
            (usuario_id,),
        ).fetchone()

    return {
        "ingresos": float(tot["ingresos"]),
        "gastos": float(tot["gastos"]),
        "balance": float(tot["ingresos"]) - float(tot["gastos"]),
        "saldoTotal": float(saldo["saldo_total"]),
        "movimientos": tot["movimientos"],
    }
