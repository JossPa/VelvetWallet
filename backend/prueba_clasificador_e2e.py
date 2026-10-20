# -*- coding: utf-8 -*-
"""
Prueba de punta a punta del clasificador: banco → ingesta → API → corrección →
reentrenamiento. Requiere Postgres LOCAL (no la de Neon: borra datos) y la EFS
en :8001. Reusa el "navegador" de prueba_e2e.py.

    python prueba_clasificador_e2e.py      (desde backend/)
"""
import psycopg

import prueba_e2e as E
from clasificador import recargar
from clasificador import reentrenar as RE

DB = E.os.environ["DATABASE_URL"]


def main():
    with psycopg.connect(DB) as c:
        c.execute("TRUNCATE usuario, institucion CASCADE")
    x = E.registrar("Camila App", "camila@prueba.cl")
    y = E.registrar("Diego App", "diego@prueba.cl")

    print("\n1) Al vincular, los gastos llegan ya clasificados")
    q, r = E.vincular(x, "15.432.876-9", "2468")
    assert r.status_code == 200, r.text
    gastos = [m for m in E.movimientos(x) if m["monto"] < 0]
    por_origen = {}
    for m in gastos:
        por_origen[m["origenClasificacion"]] = por_origen.get(m["origenClasificacion"], 0) + 1
    con_cat = [m for m in gastos if m["categoria"]]
    E.chequear(len(con_cat) / len(gastos) > 0.9,
               "%d de %d gastos con categoría (%s)" % (len(con_cat), len(gastos), por_origen))
    E.chequear(por_origen.get("banco", 0) == 0,
               "Ninguno depende ya de la traducción de la categoría del banco")
    ej = {m["comercio"]: m["categoria"] for m in gastos}
    E.chequear(ej.get("Homecenter Sodimac") == "Hogar" and ej.get("Colegio San Ignacio") == "Educación"
               and ej.get("Ripley") == "Vestuario" and ej.get("Jumbo") == "Supermercado",
               "Sodimac→Hogar, Colegio→Educación, Ripley→Vestuario, Jumbo→Supermercado")

    print("\n2) Lo que no dice en qué se gastó queda en 'Por revisar'")
    sucios = [m for m in gastos if m["glosaOriginal"].startswith(("TRANSBANK", "PAGO PSP", "MPAGO*", "CL*SERV", "PAC "))]
    E.chequear(sucios and all(m["categoria"] is None and m["estadoCategoria"] == "sin_categoria"
                              for m in sucios),
               "%d glosas sin comercio, todas sin categoría (el sistema se abstiene)" % len(sucios))
    servipag = [m for m in gastos if m["glosaOriginal"].startswith("SERVIPAG")]
    E.chequear(all(m["categoria"] == "Servicios" and m["origenClasificacion"] == "regla" for m in servipag),
               "SERVIPAG … → Servicios, por regla (sin confianza parcial)")

    print("\n3) Una compra en vivo con errata la resuelve el modelo, con su confianza")
    E.httpx.post(E.EFS + "/simulador/nuevo", params={"rut": "15.432.876-9", "comercio": "FALABELA RETAIL 22",
                                                     "monto": 19990})
    E.api.post("/api/conexiones", json={}, headers=x)
    nuevo = next(m for m in E.movimientos(x) if m["glosaOriginal"] == "FALABELA RETAIL 22")
    E.chequear(nuevo["categoria"] == "Vestuario" and nuevo["origenClasificacion"] == "modelo"
               and 0.55 <= nuevo["confianza"] <= 1,
               "FALABELA RETAIL 22 → Vestuario por el modelo (%.0f%%)" % (nuevo["confianza"] * 100))

    print("\n4) El usuario corrige; la corrección manda y sobrevive")
    pendiente = next(m for m in sucios if m["glosaOriginal"].startswith("TRANSBANK"))
    r = E.api.put("/api/movimientos/%s/categoria" % pendiente["id"], json={"categoria": "Seguros"}, headers=x)
    E.chequear(r.status_code == 200 and r.json()["categoria"] == "Seguros"
               and r.json()["origenClasificacion"] == "usuario" and r.json()["estadoCategoria"] == "corregida",
               "Corregir → categoría del usuario, origen 'usuario', estado 'corregida'")
    otro = next(m for m in gastos if m["comercio"] == "Jumbo")
    E.api.put("/api/movimientos/%s/categoria" % otro["id"], json={"categoria": "Hogar"}, headers=x)
    E.chequear(E.api.put("/api/movimientos/%s/categoria" % otro["id"], json={"categoria": "Hogar"},
                         headers=y).status_code == 404,
               "Otro usuario no puede corregir un movimiento ajeno → 404")
    E.httpx.post(E.EFS + "/simulador/nuevo", params={"rut": "15.432.876-9", "pendiente": "true"})
    E.httpx.post(E.EFS + "/simulador/avanzar", params={"rut": "15.432.876-9"})
    E.api.post("/api/conexiones", json={}, headers=x)
    despues = {m["id"]: m for m in E.movimientos(x)}
    E.chequear(despues[pendiente["id"]]["categoria"] == "Seguros" and despues[otro["id"]]["categoria"] == "Hogar",
               "Re-sincronizar no pisa las correcciones")
    E.chequear(despues[pendiente["id"]]["correcciones"][-1]["detalle"] == "Seguros",
               "La corrección queda registrada en el historial del movimiento")

    print("\n5) Un gasto que llegó sin categoría (antes del clasificador) se clasifica al sincronizar")
    with psycopg.connect(DB) as c:
        tid = c.execute("""SELECT t.id FROM transaccion t JOIN cuenta cu ON cu.id = t.cuenta_id
                           WHERE cu.usuario_id = (SELECT id FROM usuario WHERE email = 'camila@prueba.cl')
                             AND t.glosa_original = 'Tottus' LIMIT 1""").fetchone()[0]
        c.execute("UPDATE transaccion SET categoria_id = NULL, confianza_clasificacion = NULL WHERE id = %s", (tid,))
    r = E.api.post("/api/conexiones", json={}, headers=x)
    E.chequear(next(m for m in E.movimientos(x) if m["id"] == str(tid))["categoria"] == "Supermercado",
               "Tottus sin categoría → Supermercado tras sincronizar")

    print("\n6) Reentrenar usa SOLO correcciones con consentimiento vigente")
    with psycopg.connect(DB) as c:
        E.chequear(RE.correcciones_consentidas(c) == [], "Sin consentimiento: 0 correcciones utilizables")
    E.api.post("/api/privacidad/finalidades/entrenamiento_modelos", json={"acepta": True}, headers=x)
    with psycopg.connect(DB) as c:
        cs = RE.correcciones_consentidas(c)
    E.chequear(cs == [("Jumbo", "Hogar")],
               "Con consentimiento: Jumbo→Hogar sí; %s→Seguros no (no nombra comercio)"
               % pendiente["glosaOriginal"])
    r = RE.reentrenar(cs)
    E.chequear(not r["guardado"],
               "Jumbo→Hogar empeora el modelo (%.3f → %.3f): la guardia no lo guarda"
               % (r["exactitud_antes"], r["exactitud_despues"]))

    print("\n7) Una corrección útil enseña algo nuevo al modelo")
    E.api.put("/api/movimientos/%s/categoria" % otro["id"], json={"categoria": "Supermercado"}, headers=x)
    E.httpx.post(E.EFS + "/simulador/nuevo", params={"rut": "15.432.876-9", "comercio": "PAC SEGURO 0042",
                                                     "monto": 15500})
    E.api.post("/api/conexiones", json={}, headers=x)
    seguro = next(m for m in E.movimientos(x) if m["glosaOriginal"] == "PAC SEGURO 0042")
    E.chequear(seguro["categoria"] is None, "PAC SEGURO 0042: el sistema no lo conoce y se abstiene")
    E.api.put("/api/movimientos/%s/categoria" % seguro["id"], json={"categoria": "Seguros"}, headers=x)
    with psycopg.connect(DB) as c:
        cs = RE.correcciones_consentidas(c)
        r = RE.reentrenar(cs)
        E.chequear(r["guardado"], "Con Jumbo→Supermercado y PAC SEGURO→Seguros el modelo no empeora y se guarda")
        recargar()
        RE.reclasificar_todo(c)
    E.httpx.post(E.EFS + "/simulador/nuevo", params={"rut": "15.432.876-9", "comercio": "PAC SEGURO 0099",
                                                     "monto": 15500})
    r = E.api.post("/api/conexiones", json={}, headers=x)
    assert r.status_code == 200, r.text
    otro_seguro = next(m for m in E.movimientos(x) if m["glosaOriginal"] == "PAC SEGURO 0099")
    E.chequear(otro_seguro["categoria"] == "Seguros" and otro_seguro["origenClasificacion"] == "modelo",
               "El siguiente pago del seguro ya llega como Seguros, por el modelo (%.0f%%)"
               % (otro_seguro["confianza"] * 100))
    finales = {m["id"]: m for m in E.movimientos(x)}
    E.chequear(finales[pendiente["id"]]["categoria"] == "Seguros"
               and finales[pendiente["id"]]["origenClasificacion"] == "usuario",
               "Reclasificar con el modelo nuevo no toca lo que corrigió el usuario")

    print("\n8) Revocar saca sus correcciones del entrenamiento")
    E.api.post("/api/privacidad/finalidades/entrenamiento_modelos", json={"acepta": False}, headers=x)
    with psycopg.connect(DB) as c:
        E.chequear(RE.correcciones_consentidas(c) == [], "Al revocar: 0 correcciones utilizables")

    print("\nTodo bien: %d comprobaciones." % E._ok)


if __name__ == "__main__":
    main()
