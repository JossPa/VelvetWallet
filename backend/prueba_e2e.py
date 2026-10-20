# -*- coding: utf-8 -*-
"""
Prueba de punta a punta: app → backend (API + ingesta) → EFS multi-cliente.

Simula lo que pregunta el usuario: si inicio sesión con el usuario X y vinculo
mi banco, ¿me trae SOLO lo mío? Y la regla de seguridad: el RUT y la clave se
escriben en la PÁGINA DEL BANCO, nunca en Velvet. La prueba hace de navegador:
app → /iniciar → página del banco (login + autorizar) → /retorno → app.

Requiere: Postgres con el esquema, la EFS nueva en :8001. Mongo se reemplaza por
mongomock (en memoria). Correr desde backend/:  python prueba_e2e.py
"""
import os

os.environ["DATABASE_URL"] = "postgresql://velvet@127.0.0.1:55432/velvet_wallet"
os.environ["MONGO_URL"] = "mongodb://localhost:27017"
os.environ["JWT_SECRET"] = "clave-de-prueba"

import mongomock  # noqa: E402
import pymongo  # noqa: E402

_mongo = mongomock.MongoClient()
pymongo.MongoClient = lambda *a, **k: _mongo  # todas las conexiones a Mongo → memoria
import ingesta.repositorio as _repo  # noqa: E402
_repo.MongoClient = lambda *a, **k: _mongo

from fastapi.testclient import TestClient  # noqa: E402

from api.main import app  # noqa: E402

import httpx  # noqa: E402
from urllib.parse import parse_qs, urlparse  # noqa: E402

api = TestClient(app, follow_redirects=False)
EFS = "http://localhost:8001"
navegador = httpx.Client(follow_redirects=False)
_ok = 0


def chequear(cond, texto):
    global _ok
    if not cond:
        raise AssertionError(texto)
    _ok += 1
    print("  OK  ", texto)


def registrar(nombre, email):
    r = api.post("/api/auth/registro", json={"nombre": nombre, "email": email,
                                             "password": "clave-velvet-123"})
    assert r.status_code in (200, 201), r.text
    return {"Authorization": "Bearer " + r.json()["token"]}


def movimientos(h):
    return api.get("/api/movimientos?limite=500", headers=h).json()["movimientos"]


def _query(url):
    return {k: v[0] for k, v in parse_qs(urlparse(url).query).items()}


def ir_al_banco(h, rut, clave, decision="autorizar", retorno="http://localhost:8081/"):
    """
    Lo que hace el usuario: toca "Ir al banco", inicia sesión EN EL BANCO,
    decide y vuelve a la app. Devuelve los parámetros con que vuelve a la app.
    """
    r = api.post("/api/conexiones/iniciar", json={"retorno": retorno}, headers=h)
    assert r.status_code == 200, r.text
    url = r.json()["urlAutorizacion"]
    assert url.startswith(EFS + "/autorizar"), url
    pagina = navegador.get(url)                       # la página del banco
    assert "Inicia sesión en tu banco" in pagina.text
    q = _query(url)
    login = navegador.post(EFS + "/autorizar/login",
                           data={"request_uri": q["request_uri"], "rut": rut, "clave": clave})
    if login.status_code != 200:
        return {"_login": login.status_code}
    import re
    sesion = re.search(r'name="sesion" value="([^"]+)"', login.text).group(1)
    vuelta = navegador.post(EFS + "/autorizar/decision",
                            data={"request_uri": q["request_uri"], "sesion": sesion, "decision": decision})
    assert vuelta.status_code == 303, vuelta.text
    destino = vuelta.headers["location"]              # el banco vuelve a Velvet...
    assert clave not in destino and "clave" not in destino
    ruta = urlparse(destino)
    final = api.get(ruta.path + "?" + ruta.query)     # ...que canjea el código
    assert final.status_code == 303, final.text
    app_url = final.headers["location"]               # y devuelve al usuario a la app
    assert app_url.startswith(retorno) or app_url.startswith("http://localhost:8081/"), app_url
    return _query(app_url)


def vincular(h, rut, clave):
    """Autoriza en el banco y luego la app sincroniza."""
    q = ir_al_banco(h, rut, clave)
    if q.get("banco") != "vinculado":
        return q, None
    return q, api.post("/api/conexiones", json={}, headers=h)


def main():
    import psycopg
    with psycopg.connect(os.environ["DATABASE_URL"]) as c:   # base limpia
        c.execute("TRUNCATE usuario, institucion CASCADE")

    x = registrar("Usuario X", "x@prueba.cl")
    y = registrar("Usuario Y", "y@prueba.cl")
    z = registrar("Usuario Z", "z@prueba.cl")

    print("\n0) Velvet ya no acepta el RUT ni la clave del banco")
    r = api.post("/api/conexiones", json={"rut": "15.432.876-9", "clave": "2468"}, headers=z)
    chequear(r.status_code == 409 and r.json()["detail"]["codigo"] == "reautorizar",
             "Mandar RUT+clave a Velvet no vincula nada (se ignoran) → 409 'reautorizar'")
    r = api.post("/api/conexiones/iniciar", json={}, headers=x)
    chequear(r.status_code == 200 and "request_uri=" in r.json()["urlAutorizacion"]
             and "2468" not in r.json()["urlAutorizacion"],
             "/iniciar devuelve la URL de la página del banco (PAR), sin datos del usuario")
    chequear(api.post("/api/conexiones/iniciar", json={}).status_code == 401,
             "/iniciar exige sesión de Velvet")

    print("\n1) Antes de vincular, nadie tiene datos")
    chequear(movimientos(x) == [] and movimientos(y) == [], "X e Y parten vacíos")

    print("\n2) X autoriza en el banco como Camila; Y como Diego")
    q, r = vincular(x, "15.432.876-9", "2468")
    chequear(q == {"banco": "vinculado"}, "El banco devuelve a X a la app con ?banco=vinculado (sin datos personales)")
    chequear(r.status_code == 200 and r.json()["cliente"]["nombre"] == "Camila Rojas",
             "X vinculado al cliente Camila Rojas (%s movimientos)" % r.json().get("movimientosNuevos"))
    q, r = vincular(y, "21.004.567-8", "1357")
    chequear(r is not None and r.status_code == 200 and r.json()["cliente"]["nombre"] == "Diego Muñoz",
             "Y vinculado al cliente Diego Muñoz (%s movimientos)" % r.json().get("movimientosNuevos"))

    mx, my = movimientos(x), movimientos(y)
    cx = {m["cuentaId"] for m in mx}
    cy = {m["cuentaId"] for m in my}
    chequear(cx == {"CTA-15432876-1", "CTA-15432876-2"}, "X ve SOLO las cuentas de Camila: %s" % sorted(cx))
    chequear(cy == {"CTA-21004567-1", "CTA-21004567-2"}, "Y ve SOLO las cuentas de Diego: %s" % sorted(cy))
    chequear(not ({m["id"] for m in mx} & {m["id"] for m in my}), "No comparten ni un solo movimiento")
    chequear(any(m["comercio"] == "Jumbo" for m in mx) and not any(m["comercio"] == "Jumbo" for m in my),
             "Jumbo aparece en X (familia) y no en Y (estudiante)")

    print("\n3) Clave errada: la rechaza el BANCO, Velvet no se entera de nada")
    q = ir_al_banco(z, "11.111.111-1", "9999")
    chequear(q == {"_login": 401}, "El banco muestra 'RUT o clave incorrectos' en su página")
    chequear(api.get("/api/conexiones", headers=z).json()["total"] == 0, "Z no quedó con una conexión huérfana")

    print("\n4) Si el usuario rechaza en el banco, no se vincula")
    q = ir_al_banco(z, "11.111.111-1", "1234", decision="rechazar")
    chequear(q == {"banco": "rechazado"}, "Vuelve a la app con ?banco=rechazado")
    r = api.post("/api/conexiones", json={}, headers=z)
    chequear(r.status_code == 409 and r.json()["detail"]["codigo"] == "reautorizar", "Z sigue sin permiso")

    print("\n5) Re-sincronizar usa el permiso guardado (sin volver al banco)")
    compra = httpx.post(EFS + "/simulador/nuevo",
                        params={"rut": "15.432.876-9", "comercio": "Ripley", "monto": 45990})
    assert compra.status_code == 200, compra.text
    r = api.post("/api/conexiones", json={}, headers=x)
    chequear(r.status_code == 200 and r.json()["movimientosNuevos"] == 1,
             "X sincroniza sin pasar por el banco y llega 1 movimiento nuevo")
    r = api.post("/api/conexiones", json={}, headers=y)
    chequear(r.status_code == 200 and r.json()["movimientosNuevos"] == 0,
             "Y sincroniza y NO recibe la compra de Camila")

    print("\n6) No se puede colgar a otro cliente en la misma conexión")
    q = ir_al_banco(x, "21.004.567-8", "1357")
    chequear(q == {"banco": "error", "motivo": "otro_cliente"},
             "X autorizando a Diego encima de Camila → vuelve con motivo=otro_cliente")
    chequear({m["cuentaId"] for m in movimientos(x)} == cx, "X sigue viendo solo lo de Camila")

    print("\n7) La vuelta del banco no se puede falsificar ni reusar")
    r = api.get("/api/conexiones/retorno?state=inventado&code=abc")
    chequear(_query(r.headers["location"]) == {"banco": "error", "motivo": "expirado"},
             "state desconocido → error, no vincula nada")
    r = api.post("/api/conexiones/iniciar", json={"retorno": "https://sitio-falso.cl/"}, headers=z)
    from api import conexiones as K
    st = [s for s, p in K.PENDIENTES.items() if p["retorno"] == "http://localhost:8081/"][-1]
    chequear(K.PENDIENTES[st]["retorno"] == "http://localhost:8081/",
             "Un retorno fuera de la lista blanca se reemplaza por el de la app (sin redirección abierta)")

    print("\n8) Desvincular borra todo y permite conectar otro cliente")
    con_x = api.get("/api/conexiones", headers=x).json()["conexiones"][0]
    chequear(con_x["rutCliente"] == "15.432.876-9" and "refreshToken" not in con_x and con_x["autorizada"],
             "La conexión dice a qué RUT está atada (sin exponer el refresh token)")
    chequear(api.delete("/api/conexiones/" + con_x["id"], headers=y).status_code == 404,
             "Y no puede desvincular la conexión de X → 404")
    r = api.delete("/api/conexiones/" + con_x["id"], headers=x)
    chequear(r.status_code == 200 and movimientos(x) == [], "X desvincula y queda sin datos")
    chequear(_mongo["velvet_wallet"].payload_crudo.count_documents({"conexion_id": con_x["id"]}) == 0,
             "Los payloads crudos de esa conexión se borraron de Mongo")
    q, r = vincular(x, "21.004.567-8", "1357")
    chequear(r is not None and r.status_code == 200 and {m["cuentaId"] for m in movimientos(x)} == cy,
             "Ahora X puede autorizar a Diego y ve SOLO lo de Diego")

    print("\n9) Un cliente creado en vivo para una simulación específica")
    httpx.delete(EFS + "/simulador/clientes/17.654.321-3")
    httpx.post(EFS + "/simulador/clientes",
               json={"rut": "17.654.321-3", "nombre": "Valentina Soto", "clave": "9999",
                     "perfil": "profesional", "sueldo": 1200000, "meses": 3})
    q, r = vincular(z, "17.654.321-3", "9999")
    ingresos = {m["monto"] for m in movimientos(z) if m["monto"] > 0 and "remuneracion" in (m["glosaOriginal"] or "").lower()}
    chequear(r is not None and r.status_code == 200 and ingresos == {1200000.0},
             "Z autoriza como Valentina y su sueldo es el definido ($1.200.000)")
    httpx.delete(EFS + "/simulador/clientes/17.654.321-3")

    print("\nTodo bien: %d comprobaciones de punta a punta." % _ok)


if __name__ == "__main__":
    main()
