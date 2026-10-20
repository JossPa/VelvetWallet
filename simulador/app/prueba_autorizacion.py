# -*- coding: utf-8 -*-
"""
Pruebas del flujo de autorización EN EL SITIO DEL BANCO (OAuth 2.0 + PAR + PKCE).

    python -m app.prueba_autorizacion

Simulan lo que hacen el participante (Velvet) y el navegador del usuario:
  · el participante empuja la solicitud (PAR) con sus credenciales y PKCE,
  · el usuario inicia sesión en la página del banco y decide,
  · el banco vuelve al participante con un código de un solo uso,
  · el participante canjea el código + code_verifier por los tokens.

Comprueba también los ataques típicos: código robado sin verifier, código
reusado, redirect_uri no registrada, decisión sin login (CSRF), inyección de HTML.
"""
import base64
import hashlib
import re
import secrets
import tempfile
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient

from app import clientes as C
from app import main as M

_tmp = Path(tempfile.mkdtemp(prefix="efs-prueba-"))
C.ARCHIVO_CREADOS = _tmp / "clientes_creados.json"
M.ARCHIVO_REFRESH = _tmp / "refresh_tokens.json"

API = "/accounts/v1"
VUELTA = M.PARTICIPANTES_REGISTRADOS[M.CLIENTE_ID]["redirect_uris"][0]
web = TestClient(M.app, follow_redirects=False)
_ok = 0


def chequear(cond, texto):
    global _ok
    if not cond:
        raise AssertionError(texto)
    _ok += 1
    print("  OK  ", texto)


def pkce():
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    return verifier, challenge


def par(challenge, state="estado-de-prueba-123", **extra):
    cuerpo = {"client_id": M.CLIENTE_ID, "client_secret": M.CLIENTE_SECRET,
              "redirect_uri": VUELTA, "state": state, "code_challenge": challenge,
              "code_challenge_method": "S256", **extra}
    return web.post(API + "/par", json=cuerpo)


def login(request_uri, rut, clave):
    return web.post("/autorizar/login", data={"request_uri": request_uri, "rut": rut, "clave": clave})


def sesion_de(html):
    return re.search(r'name="sesion" value="([^"]+)"', html).group(1)


def autorizar_completo(rut, clave, decision="autorizar", state="estado-de-prueba-123"):
    """Recorre el flujo del navegador y devuelve (respuesta_final, verifier)."""
    verifier, challenge = pkce()
    request_uri = par(challenge, state=state).json()["request_uri"]
    pagina = login(request_uri, rut, clave)
    r = web.post("/autorizar/decision", data={"request_uri": request_uri,
                                              "sesion": sesion_de(pagina.text), "decision": decision})
    return r, verifier


def canjear(code, verifier):
    return web.post(API + "/token", json={"grant_type": "authorization_code",
                                          "client_id": M.CLIENTE_ID, "client_secret": M.CLIENTE_SECRET,
                                          "code": code, "redirect_uri": VUELTA, "code_verifier": verifier})


def parametros(respuesta):
    return {k: v[0] for k, v in parse_qs(urlparse(respuesta.headers["location"]).query).items()}


def main():
    camila, diego = C.formatear_rut(15432876), C.formatear_rut(21004567)

    print("1) La solicitud (PAR) la hace el participante, autenticado")
    _, ch = pkce()
    r = web.post(API + "/par", json={"client_id": M.CLIENTE_ID, "client_secret": "malo",
                                     "redirect_uri": VUELTA, "state": "estado-123",
                                     "code_challenge": ch})
    chequear(r.status_code == 401, "Participante con secreto malo → 401")
    r = par(ch, redirect_uri="https://sitio-atacante.cl/robar")
    chequear(r.status_code == 400, "redirect_uri no registrada → 400 (no se puede desviar el código)")
    r = par(ch, code_challenge_method="plain")
    chequear(r.status_code == 400, "PKCE sin S256 → 400")
    r = par(ch)
    chequear(r.status_code == 201 and r.json()["request_uri"].startswith("urn:ietf:params:oauth:request_uri:"),
             "PAR válido → request_uri")
    request_uri = r.json()["request_uri"]

    print("\n2) El usuario inicia sesión EN LA PÁGINA DEL BANCO")
    r = web.get("/autorizar", params={"request_uri": request_uri, "client_id": M.CLIENTE_ID})
    chequear(r.status_code == 200 and "Inicia sesión en tu banco" in r.text and "Velvet Wallet" in r.text,
             "La página del banco pide RUT y clave y dice quién solicita")
    chequear('type="password"' in r.text, "La clave se escribe en un campo del banco (tipo contraseña)")
    r = login(request_uri, camila, "0000")
    chequear(r.status_code == 401 and "RUT o clave incorrectos" in r.text, "Clave errada → el banco lo rechaza")
    r = login(request_uri, '<script>alert(1)</script>', "0000")
    chequear("<script>alert(1)</script>" not in r.text and "&lt;script&gt;" in r.text,
             "Lo que escribe el usuario se escapa (sin inyección de HTML)")
    r = login(request_uri, camila, "2468")
    chequear(r.status_code == 200 and "Hola, Camila Rojas" in r.text, "Login correcto → pantalla de consentimiento")
    chequear("CTA-15432876-1" in r.text and "CTA-0001" not in r.text and "CTA-21004567-1" not in r.text,
             "El consentimiento muestra SOLO las cuentas de Camila")
    chequear("Ver tus saldos" in r.text and "no puede mover tu dinero" in r.text,
             "Explica los permisos en lenguaje claro")

    print("\n3) Sin haber iniciado sesión no se puede aprobar (CSRF)")
    _, ch2 = pkce()
    otra = par(ch2).json()["request_uri"]
    r = web.post("/autorizar/decision", data={"request_uri": otra, "sesion": "inventada", "decision": "autorizar"})
    chequear(r.status_code == 400, "Decisión sin sesión del banco → 400")

    print("\n4) Al autorizar, el banco vuelve con un código; el participante lo canjea con PKCE")
    r, verifier = autorizar_completo(camila, "2468", state="mi-estado-xyz-789")
    chequear(r.status_code == 303 and r.headers["location"].startswith(VUELTA),
             "El banco redirige al participante (303 a la redirect_uri registrada)")
    q = parametros(r)
    chequear("code" in q and q.get("state") == "mi-estado-xyz-789", "Devuelve el código y el mismo state")
    chequear("clave" not in r.headers["location"] and "2468" not in r.headers["location"],
             "La clave NO viaja al participante")
    malo = canjear(q["code"], secrets.token_urlsafe(48))
    chequear(malo.status_code == 400 and "PKCE" in malo.json()["detail"],
             "Código robado sin el verifier correcto → 400")
    chequear(canjear(q["code"], verifier).status_code == 400,
             "Ese código ya quedó quemado: un solo intento")

    r, verifier = autorizar_completo(camila, "2468")
    code = parametros(r)["code"]
    tok = canjear(code, verifier)
    chequear(tok.status_code == 200 and tok.json()["cliente"]["rut"] == camila and "refresh_token" in tok.json(),
             "Canje correcto → access + refresh token de Camila")
    cuentas = web.get(API + "/accounts", headers={"Authorization": "Bearer " + tok.json()["access_token"]})
    chequear([c["accountId"] for c in cuentas.json()["data"]["accounts"]] == ["CTA-15432876-1", "CTA-15432876-2"],
             "Con ese token se ven SOLO las cuentas de Camila")
    chequear(canjear(code, verifier).status_code == 400, "Reusar el código → 400 (un solo uso)")

    print("\n5) Si el usuario rechaza, no hay código")
    r, _ = autorizar_completo(diego, "1357", decision="rechazar")
    q = parametros(r)
    chequear(r.status_code == 303 and q.get("error") == "access_denied" and "code" not in q,
             "Rechazar → vuelve con error=access_denied y sin código")

    print("\n6) Una solicitud vencida no sirve")
    _, ch3 = pkce()
    vieja = par(ch3).json()["request_uri"]
    M.SOLICITUDES_PAR[vieja]["expira"] = M.datetime.now(M.timezone.utc) - M.timedelta(seconds=1)
    r = web.get("/autorizar", params={"request_uri": vieja, "client_id": M.CLIENTE_ID})
    chequear(r.status_code == 400 and "expiró" in r.text, "Solicitud vencida → página de error del banco")

    print("\nTodo bien: %d comprobaciones." % _ok)


if __name__ == "__main__":
    main()
