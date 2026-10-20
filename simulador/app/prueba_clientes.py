# -*- coding: utf-8 -*-
"""
Pruebas del banco simulado multi-cliente. Correr desde simulador/:

    python -m app.prueba_clientes

Verifican lo que importa para Velvet Wallet:
  · cada cliente recibe SOLO sus cuentas y movimientos,
  · el token de un cliente no puede leer la cuenta de otro (404),
  · RUT o clave errados no autorizan (401),
  · el refresh token renueva el acceso del MISMO cliente sin pedir clave,
  · revocar corta el acceso,
  · se puede crear un cliente en vivo y vincularlo.
"""
import os

# Probar con estado limpio: sin clientes creados ni refresh tokens previos.
os.environ.setdefault("SFA_EXIGIR_TOKEN", "true")

from fastapi.testclient import TestClient  # noqa: E402

from app import clientes as C  # noqa: E402
from app import main as M  # noqa: E402

# El estado que la prueba genera (clientes creados, refresh tokens) va a una
# carpeta temporal: correr la prueba no ensucia la EFS real.
import tempfile  # noqa: E402
from pathlib import Path  # noqa: E402

_tmp = Path(tempfile.mkdtemp(prefix="efs-prueba-"))
C.ARCHIVO_CREADOS = _tmp / "clientes_creados.json"
M.ARCHIVO_REFRESH = _tmp / "refresh_tokens.json"

API = "/accounts/v1"
cli = TestClient(M.app)
_ok = 0


def chequear(condicion, texto):
    global _ok
    if not condicion:
        raise AssertionError(texto)
    _ok += 1
    print("  OK  ", texto)


def participante():
    r = cli.post(API + "/token", json={"grant_type": "client_credentials",
                                       "client_id": M.CLIENTE_ID,
                                       "client_secret": M.CLIENTE_SECRET})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def autorizar(rut, clave):
    """Flujo completo: participante → consentimiento → el cliente autoriza."""
    tp = participante()
    h = {"Authorization": "Bearer " + tp}
    consent = cli.post(API + "/consents", json={}, headers=h).json()["data"]["consentId"]
    cuerpo = {"rut": rut, "clave": clave} if rut else None
    r = cli.post(API + "/consents/%s/authorise" % consent, json=cuerpo, headers=h)
    return r, consent


def cuentas(token):
    r = cli.get(API + "/accounts", headers={"Authorization": "Bearer " + token})
    return [c["accountId"] for c in r.json()["data"]["accounts"]]


def main():
    print("Clientes de base:", ", ".join("%s (%s)" % (c["rut"], c["nombre"])
                                         for c in C.CLIENTES.values()))

    camila, diego = C.formatear_rut(15432876), C.formatear_rut(21004567)

    print("\n1) Cada cliente ve solo lo suyo")
    r_cam, consent_cam = autorizar(camila, "2468")
    chequear(r_cam.status_code == 200, "Camila autoriza con RUT + clave correctos")
    tok_cam = r_cam.json()["access_token"]
    ref_cam = r_cam.json()["refresh_token"]
    chequear(cuentas(tok_cam) == ["CTA-15432876-1", "CTA-15432876-2"], "Camila ve solo sus 2 cuentas")

    r_die, _ = autorizar(diego, "1357")
    tok_die = r_die.json()["access_token"]
    chequear(cuentas(tok_die) == ["CTA-21004567-1", "CTA-21004567-2"], "Diego ve solo sus 2 cuentas")

    movs_cam = cli.get(API + "/accounts/CTA-15432876-1/transactions?pageSize=100",
                       headers={"Authorization": "Bearer " + tok_cam}).json()["data"]["transactions"]
    comercios = {(m.get("merchantDetails") or {}).get("name") for m in movs_cam}
    chequear("Jumbo" in comercios or "Tottus" in comercios, "Los movimientos de Camila son de SU perfil (familia)")
    chequear(all(m["transactionID"].startswith("TXN-15432876-") for m in movs_cam),
             "Todos los transactionID de Camila son suyos")

    print("\n2) Un cliente NO puede leer la cuenta de otro")
    r = cli.get(API + "/accounts/CTA-0001/transactions",
                headers={"Authorization": "Bearer " + tok_cam})
    chequear(r.status_code == 404, "Token de Camila pidiendo CTA-0001 (de Jossue) → 404")
    r = cli.get(API + "/accounts/CTA-15432876-1/balance",
                headers={"Authorization": "Bearer " + tok_die})
    chequear(r.status_code == 404, "Token de Diego pidiendo saldo de Camila → 404")

    print("\n3) Credenciales malas no autorizan")
    r, _ = autorizar(camila, "0000")
    chequear(r.status_code == 401, "Clave errada → 401")
    r, _ = autorizar(C.formatear_rut(9999999), "1234")
    chequear(r.status_code == 401, "RUT que no es cliente → 401 (mismo mensaje, no revela nada)")

    print("\n4) Refresh token: renovar sin pedir la clave, al MISMO cliente")
    r = cli.post(API + "/token", json={"grant_type": "refresh_token",
                                       "client_id": M.CLIENTE_ID,
                                       "client_secret": M.CLIENTE_SECRET,
                                       "refresh_token": ref_cam})
    chequear(r.status_code == 200 and r.json()["cliente"]["rut"] == camila,
             "El refresh token de Camila da acceso a Camila")
    chequear(cuentas(r.json()["access_token"]) == ["CTA-15432876-1", "CTA-15432876-2"],
             "El acceso renovado sigue viendo solo lo de Camila")
    r = cli.post(API + "/token", json={"grant_type": "refresh_token",
                                       "client_id": M.CLIENTE_ID,
                                       "client_secret": M.CLIENTE_SECRET,
                                       "refresh_token": "inventado"})
    chequear(r.status_code == 401, "Refresh token inventado → 401")

    print("\n5) Revocar el consentimiento corta el acceso")
    cli.delete(API + "/consents/" + consent_cam)
    r = cli.get(API + "/accounts", headers={"Authorization": "Bearer " + tok_cam})
    chequear(r.status_code == 401, "Token de acceso revocado → 401")
    r = cli.post(API + "/token", json={"grant_type": "refresh_token",
                                       "client_id": M.CLIENTE_ID,
                                       "client_secret": M.CLIENTE_SECRET,
                                       "refresh_token": ref_cam})
    chequear(r.status_code == 401, "Refresh token revocado → 401")

    print("\n6) Cliente creado en vivo para una simulación específica")
    nuevo_rut = C.formatear_rut(17654321)
    cli.delete("/simulador/clientes/" + nuevo_rut)  # por si quedó de una corrida anterior
    r = cli.post("/simulador/clientes", json={"rut": nuevo_rut, "nombre": "Valentina Soto",
                                              "clave": "9999", "perfil": "estudiante",
                                              "sueldo": 600000, "meses": 6})
    chequear(r.status_code == 201, "Se crea Valentina (estudiante, 6 meses, sueldo $600.000)")
    r = cli.post("/simulador/clientes", json={"rut": nuevo_rut, "nombre": "Otra", "clave": "1111"})
    chequear(r.status_code == 409, "No se puede crear dos veces el mismo RUT")
    r = cli.post("/simulador/clientes", json={"rut": "15.432.876-0", "nombre": "X", "clave": "1111"})
    chequear(r.status_code == 422, "RUT con dígito verificador malo → 422")
    r_val, _ = autorizar(nuevo_rut, "9999")
    tok_val = r_val.json()["access_token"]
    chequear(cuentas(tok_val) == ["CTA-17654321-1", "CTA-17654321-2"], "Valentina vincula y ve sus cuentas")
    movs_val = cli.get(API + "/accounts/CTA-17654321-1/transactions?pageSize=100",
                       headers={"Authorization": "Bearer " + tok_val}).json()["data"]["transactions"]
    sueldos = {m["amount"] for m in movs_val if m["transactionsType"] == "Abono"}
    chequear(sueldos == {600000.0}, "Su sueldo es el pedido ($600.000)")

    print("\n7) Compra en vivo para un cliente específico")
    r = cli.post("/simulador/nuevo", params={"rut": nuevo_rut, "comercio": "Rappi", "monto": 12990})
    chequear(r.status_code == 200 and r.json()["cuenta"] == "CTA-17654321-1",
             "La compra va a la cuenta de Valentina")
    # La compra es la más reciente: viene primera en la página 1.
    recientes = cli.get(API + "/accounts/CTA-17654321-1/transactions?pageSize=5",
                        headers={"Authorization": "Bearer " + tok_val}).json()["data"]["transactions"]
    chequear(recientes[0]["transactionID"] == r.json()["creado"]["transactionID"]
             and recientes[0]["amount"] == 12990.0, "Valentina ve la compra nueva ($12.990 en Rappi)")
    otros = cli.get(API + "/accounts/CTA-21004567-1/transactions?pageSize=100",
                    headers={"Authorization": "Bearer " + tok_die}).json()["data"]["transactions"]
    chequear(not any(m["transactionID"] == r.json()["creado"]["transactionID"] for m in otros),
             "Diego NO recibe la compra de Valentina")

    print("\n8) Compatibilidad: autorizar sin RUT usa el cliente por defecto")
    r, _ = autorizar(None, None)
    chequear(r.status_code == 200 and r.json()["cliente"]["rut"] == "11.111.111-1",
             "Sin RUT → Jossue (como antes)")

    cli.delete("/simulador/clientes/" + nuevo_rut)  # dejar todo como estaba
    print("\nTodo bien: %d comprobaciones." % _ok)


if __name__ == "__main__":
    main()
