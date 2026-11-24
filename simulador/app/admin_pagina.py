# -*- coding: utf-8 -*-
"""
Página de /admin (ver admin.py). Autocontenida, sin recursos externos; todo lo
que llega del servidor se inserta como texto, nunca como HTML.
"""
from html import escape as _escape

from app import banco as _banco

ADMIN_HTML = r"""<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Administración · __BANCO__</title>
<style>
:root { --marino:#0B2545; --marino2:#13315C; --turquesa:#12A39A; --fondo:#EEF2F6;
        --texto:#1B2733; --suave:#5B6B7B; --linea:#D6DEE6; --rojo:#B42318; --ambar:#8A5A00;
        --tarjeta:#fff; }
* { box-sizing:border-box; }
body { margin:0; background:var(--fondo); color:var(--texto);
       font-family:"Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size:14px; }
.pruebas { background:#FFF4CE; color:#6B4E00; font-size:12px; text-align:center; padding:6px 16px; }
header { background:var(--marino); color:#fff; padding:14px 16px 0; }
.marca { max-width:1100px; margin:0 auto; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.logo { width:34px; height:34px; border-radius:8px; background:var(--turquesa); display:flex;
        align-items:center; justify-content:center; font-weight:700; font-size:18px; flex:none; }
.marca b { font-size:18px; } .marca span.sub { display:block; font-size:12px; opacity:.75; }
.estado-chips { margin-left:auto; display:flex; gap:6px; flex-wrap:wrap; }
nav { max-width:1100px; margin:12px auto 0; display:flex; gap:2px; overflow-x:auto; }
nav button { background:transparent; color:#cfd8e3; border-radius:8px 8px 0 0; padding:10px 14px;
             font-weight:600; white-space:nowrap; }
nav button:hover { background:var(--marino2); }
nav button.activa { background:var(--fondo); color:var(--marino); }
main { max-width:1100px; margin:16px auto 40px; padding:0 16px; }
section.pestana { display:none; gap:16px; } section.pestana.activa { display:grid; }
.tarjeta { background:var(--tarjeta); border-radius:14px; padding:18px; box-shadow:0 2px 10px rgba(11,37,69,.08);
           min-width:0; }
h2 { font-size:16px; margin:0 0 12px; color:var(--marino); }
label { display:block; font-size:12px; font-weight:600; margin:10px 0 4px; color:var(--suave); }
select, input[type=text], input[type=number], input[type=password], input[type=datetime-local] {
  width:100%; padding:9px; font-size:14px; border:1px solid var(--linea); border-radius:8px;
  background:#fff; color:var(--texto); }
.rejilla { display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:0 12px; }
.casilla { display:flex; align-items:center; gap:8px; margin:12px 0 0; font-size:14px; color:var(--texto); font-weight:500; }
button { padding:9px 14px; border:0; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer;
         background:var(--marino); color:#fff; }
button:hover { background:var(--marino2); }
button:disabled { opacity:.55; cursor:default; }
button.sec { background:#fff; color:var(--marino); border:1px solid var(--linea); }
button.sec:hover { background:var(--fondo); }
button.peligro { background:var(--rojo); } button.peligro:hover { background:#8f1c13; }
button.mini { padding:4px 9px; font-size:12px; }
.acciones { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; align-items:center; }
.cifras { display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:10px; }
.cifra { border:1px solid var(--linea); border-radius:10px; padding:10px 12px; }
.cifra small { color:var(--suave); font-size:12px; } .cifra b { display:block; font-size:22px; margin-top:2px; }
.tabla { width:100%; overflow-x:auto; }
table { width:100%; border-collapse:collapse; font-size:13px; }
th { text-align:left; color:var(--suave); font-weight:600; font-size:12px; padding:6px 8px;
     border-bottom:1px solid var(--linea); white-space:nowrap; }
td { padding:7px 8px; border-bottom:1px solid var(--linea); vertical-align:top; }
td.num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
td.cod, .cod { font-family:Consolas, monospace; font-size:12px; }
td .acciones { margin:0; flex-wrap:nowrap; }
.abono { color:#0B7A55; } .cargo { color:var(--texto); }
.chip { display:inline-block; font-size:11px; font-weight:700; border-radius:999px; padding:2px 8px;
        margin:0 4px 0 0; white-space:nowrap; }
.chip.ok { background:#E3F6F4; color:#0B5F59; } .chip.pend { background:#FFF4CE; color:var(--ambar); }
.chip.mal { background:#FEE4E2; color:var(--rojo); } .chip.gris { background:#F1F3F6; color:var(--suave); }
header .chip.gris { background:rgba(255,255,255,.15); color:#fff; }
.aviso { position:fixed; left:50%; bottom:20px; transform:translateX(-50%); max-width:min(560px, calc(100% - 32px));
         border-radius:10px; padding:10px 14px; font-size:14px; display:none; box-shadow:0 6px 20px rgba(0,0,0,.18); z-index:20; }
.aviso.ok { display:block; background:#0B5F59; color:#fff; } .aviso.mal { display:block; background:var(--rojo); color:#fff; }
.nota { color:var(--suave); font-size:13px; margin:8px 0 0; line-height:1.45; }
.vacio { color:var(--suave); padding:10px 0; }
.barra { display:flex; gap:12px; flex-wrap:wrap; align-items:end; }
.barra > div { flex:1 1 200px; }
dialog { border:0; border-radius:14px; padding:20px; width:min(560px, calc(100% - 32px));
         box-shadow:0 10px 40px rgba(0,0,0,.3); }
dialog::backdrop { background:rgba(11,37,69,.5); }
#login { position:fixed; inset:0; background:var(--marino); display:flex; align-items:center; justify-content:center; z-index:30; padding:16px; }
#login .tarjeta { width:min(380px, 100%); }
</style></head>
<body>
<div id="login"><form class="tarjeta" id="formLogin">
  <h2>Administración · __BANCO__</h2>
  <label for="clave">Clave de administración</label>
  <input id="clave" type="password" autocomplete="current-password" required>
  <p class="nota">Es la variable <span class="cod">SFA_ADMIN_CLAVE</span> del simulador (por defecto <span class="cod">admin</span>).</p>
  <div class="acciones"><button>Entrar</button></div>
  <p class="nota" id="loginError" style="color:var(--rojo)"></p>
</form></div>

<div class="pruebas">Consola del equipo · no es parte del banco ni del estándar SFA</div>
<header>
  <div class="marca"><div class="logo">B</div>
    <div><b>Administración</b><span class="sub">__BANCO__ · control completo de la EFS</span></div>
    <div class="estado-chips" id="chips"></div>
  </div>
  <nav id="nav">
    <button data-p="resumen" class="activa">Resumen</button>
    <button data-p="clientes">Clientes</button>
    <button data-p="movimientos">Movimientos</button>
    <button data-p="creditos">Créditos</button>
    <button data-p="permisos">Permisos y tokens</button>
    <button data-p="fallas">Fallas</button>
  </nav>
</header>

<main>
  <!-- ───── Resumen ───── -->
  <section class="pestana activa" id="p-resumen">
    <div class="tarjeta"><h2>Estado</h2><div class="cifras" id="cifras"></div></div>
    <div class="tarjeta">
      <h2>Configuración en caliente</h2>
      <label class="casilla"><input type="checkbox" id="cfgToken"> Exigir token en la API (recomendado)</label>
      <p class="nota">Apagado, cualquiera lee los datos del cliente por defecto sin consentimiento. Solo para depurar.</p>
      <div class="rejilla">
        <div><label for="cfgDefecto">Cliente por defecto (autorización sin RUT)</label><select id="cfgDefecto"></select></div>
      </div>
      <div class="acciones"><button id="guardarCfg">Guardar configuración</button></div>
      <p class="nota" id="participantes"></p>
    </div>
    <div class="tarjeta">
      <h2>Restablecer</h2>
      <p class="nota">Vuelve a los datos de base sin reiniciar el proceso: se pierden compras en vivo, ediciones, créditos agregados y pendientes.</p>
      <label class="casilla"><input type="checkbox" id="rsCreados"> Borrar también los clientes creados</label>
      <label class="casilla"><input type="checkbox" id="rsPermisos"> Revocar todos los permisos (Velvet tendrá que volver a vincular)</label>
      <div class="acciones"><button class="peligro" id="restablecer">Restablecer datos</button>
        <a href="/docs" target="_blank" rel="noopener"><button class="sec" type="button">API (/docs)</button></a>
        <a href="/panel" target="_blank" rel="noopener"><button class="sec" type="button">Panel de demo</button></a></div>
    </div>
  </section>

  <!-- ───── Clientes ───── -->
  <section class="pestana" id="p-clientes">
    <div class="tarjeta"><h2>Clientes del banco</h2><div class="tabla" id="tablaClientes"></div></div>
    <form class="tarjeta" id="formCliente">
      <h2>Crear cliente</h2>
      <div class="rejilla">
        <div><label for="ncRut">RUT</label><input id="ncRut" type="text" placeholder="12.345.678-5" required></div>
        <div><label for="ncNombre">Nombre</label><input id="ncNombre" type="text" required minlength="2"></div>
        <div><label for="ncClave">Clave del banco</label><input id="ncClave" type="text" value="1234" minlength="4"></div>
        <div><label for="ncPerfil">Perfil</label><select id="ncPerfil"></select></div>
        <div><label for="ncSueldo">Sueldo (opcional)</label><input id="ncSueldo" type="number" min="100000" step="10000"></div>
        <div><label for="ncMeses">Meses de historia</label><input id="ncMeses" type="number" min="1" max="12" value="12"></div>
      </div>
      <div class="acciones"><button>Crear cliente</button></div>
      <p class="nota">El RUT debe tener dígito verificador válido. La historia se genera al tiro y sobrevive a un reinicio.</p>
    </form>
  </section>

  <!-- ───── Movimientos ───── -->
  <section class="pestana" id="p-movimientos">
    <div class="tarjeta">
      <div class="barra">
        <div><label for="mvCliente">Cliente</label><select id="mvCliente" class="selCliente"></select></div>
        <div><label for="mvCuenta">Cuenta</label><select id="mvCuenta"></select></div>
        <div><label for="mvBuscar">Buscar</label><input id="mvBuscar" type="text" placeholder="Comercio, glosa o ID"></div>
      </div>
      <div class="acciones">
        <button class="sec" id="editarCuenta">Estado / apodo de la cuenta</button>
        <button class="sec" id="mvConfirmar">Confirmar pendientes</button>
        <button id="mvNuevo">Nuevo movimiento</button>
      </div>
      <p class="nota" id="mvResumen"></p>
      <div class="tabla" id="tablaMovs"></div>
    </div>
  </section>

  <!-- ───── Créditos ───── -->
  <section class="pestana" id="p-creditos">
    <div class="tarjeta">
      <div class="barra"><div><label for="crCliente">Cliente</label><select id="crCliente" class="selCliente"></select></div></div>
      <div class="tabla" id="tablaCreditos" style="margin-top:12px"></div>
    </div>
    <form class="tarjeta" id="formCredito">
      <h2>Agregar crédito</h2>
      <div class="rejilla">
        <div><label for="ncrProducto">Producto</label><input id="ncrProducto" type="text" value="Crédito de Consumo"></div>
        <div><label for="ncrTipo">Tipo</label><input id="ncrTipo" type="text" value="Consumo"></div>
        <div><label for="ncrMonto">Monto original</label><input id="ncrMonto" type="number" min="1" value="3000000"></div>
        <div><label for="ncrCuota">Cuota mensual</label><input id="ncrCuota" type="number" min="1" value="120000"></div>
        <div><label for="ncrPlazo">Plazo (meses)</label><input id="ncrPlazo" type="number" min="1" max="600" value="24"></div>
        <div><label for="ncrPagadas">Cuotas pagadas</label><input id="ncrPagadas" type="number" min="0" value="0"></div>
        <div><label for="ncrTasa">Tasa mensual %</label><input id="ncrTasa" type="number" min="0" step="0.01" value="1.2"></div>
      </div>
      <div class="acciones"><button>Agregar crédito</button></div>
    </form>
  </section>

  <!-- ───── Permisos ───── -->
  <section class="pestana" id="p-permisos">
    <div class="tarjeta">
      <h2>Consentimientos</h2>
      <div class="tabla" id="tablaConsent"></div>
      <div class="acciones"><button class="peligro" id="revocarTodo">Revocar todo</button></div>
      <p class="nota">Revocar deja sin efecto los tokens de acceso y de renovación de ese consentimiento: la próxima sincronización de Velvet falla y pide volver a vincular.</p>
    </div>
    <div class="tarjeta"><h2>Tokens de acceso</h2><div class="tabla" id="tablaTokens"></div></div>
    <div class="tarjeta"><h2>Tokens de participante</h2><div class="tabla" id="tablaPart"></div></div>
  </section>

  <!-- ───── Fallas ───── -->
  <section class="pestana" id="p-fallas">
    <form class="tarjeta" id="formFallas">
      <h2>Simular fallas de la API</h2>
      <p class="nota">Afecta solo a <span class="cod">/accounts/v1/*</span> y <span class="cod">/autorizar</span>. Esta consola, <span class="cod">/panel</span> y <span class="cod">/health</span> siguen respondiendo.</p>
      <div class="rejilla">
        <div><label for="flModo">Modo</label><select id="flModo">
          <option value="ninguna">Ninguna (normal)</option>
          <option value="error">Responder con error</option>
          <option value="lento">Responder lento</option>
          <option value="caido">Colgarse (como caído)</option></select></div>
        <div><label for="flCodigo">Código de error</label><input id="flCodigo" type="number" min="400" max="599" value="503"></div>
        <div><label for="flDemora">Demora (ms)</label><input id="flDemora" type="number" min="0" max="60000" step="100" value="3000"></div>
        <div><label for="flProb">Probabilidad (%)</label><input id="flProb" type="number" min="0" max="100" value="100"></div>
      </div>
      <div class="acciones"><button>Aplicar</button><button type="button" class="sec" id="flApagar">Apagar falla</button></div>
      <p class="nota" id="flEstado"></p>
    </form>
  </section>
</main>

<dialog id="dlgMov"><form method="dialog" id="formMov">
  <h2 id="dlgMovTitulo">Movimiento</h2>
  <div class="rejilla">
    <div><label for="fmTipo">Tipo</label><select id="fmTipo"><option>Cargo</option><option>Abono</option></select></div>
    <div><label for="fmMonto">Monto (CLP)</label><input id="fmMonto" type="number" min="1" required></div>
    <div><label for="fmFecha">Fecha</label><input id="fmFecha" type="datetime-local"></div>
    <div><label for="fmComercio">Comercio</label><input id="fmComercio" type="text" placeholder="Vacío = sin comercio"></div>
    <div><label for="fmCategoria">Categoría del banco</label><input id="fmCategoria" type="text"></div>
    <div><label for="fmGlosa">Glosa</label><input id="fmGlosa" type="text" placeholder="paymentPurposeCode"></div>
  </div>
  <label class="casilla"><input type="checkbox" id="fmPendiente"> Pendiente (se confirma con otro monto)</label>
  <div class="rejilla"><div><label for="fmFinal">Monto al confirmar</label><input id="fmFinal" type="number" min="1" placeholder="+15% si se deja vacío"></div></div>
  <div class="acciones"><button value="ok">Guardar</button><button value="cancelar" class="sec" formnovalidate>Cancelar</button></div>
</form></dialog>

<div id="aviso" class="aviso" role="status"></div>

<script>
const $ = (id) => document.getElementById(id);
const pesos = (n) => (n < 0 ? "−" : "") + "$" + Math.abs(Math.round(n || 0)).toLocaleString("es-CL");
const fecha = (iso) => iso ? new Date(iso).toLocaleString("es-CL",
  { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

function el(tag, clase, texto) {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (texto !== undefined && texto !== null) e.textContent = texto;
  return e;
}
function chip(texto, tipo) { return el("span", "chip " + tipo, texto); }
function boton(texto, clase, fn) {
  const b = el("button", "mini " + (clase || ""), texto);
  b.type = "button";
  b.addEventListener("click", async () => { b.disabled = true; try { await fn(); } finally { b.disabled = false; } });
  return b;
}
let temporizador;
function avisar(texto, ok = true) {
  const a = $("aviso");
  a.className = "aviso " + (ok ? "ok" : "mal");
  a.textContent = texto;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => { a.className = "aviso"; }, 4500);
}

/** Tabla a partir de columnas [titulo, fn(fila) -> texto|Node, clase?]. */
function tabla(cont, columnas, filas, vacio) {
  cont.replaceChildren();
  if (!filas.length) { cont.append(el("div", "vacio", vacio || "Nada que mostrar.")); return; }
  const t = el("table"), cab = el("tr");
  for (const [titulo] of columnas) cab.append(el("th", "", titulo));
  t.append(cab);
  for (const f of filas) {
    const tr = el("tr");
    for (const [, fn, clase] of columnas) {
      const td = el("td", clase || "");
      const v = fn(f);
      if (v instanceof Node) td.append(v);
      else if (Array.isArray(v)) td.append(...v);
      else td.textContent = v === null || v === undefined ? "—" : v;
      tr.append(td);
    }
    t.append(tr);
  }
  cont.append(t);
}

// ───── llamadas ─────
let CLAVE = null;
try { CLAVE = sessionStorage.getItem("admin-clave"); } catch (_) {}

async function api(ruta, metodo = "GET", cuerpo) {
  const op = { method: metodo, headers: { "X-Admin-Clave": CLAVE || "" } };
  if (cuerpo !== undefined) { op.headers["Content-Type"] = "application/json"; op.body = JSON.stringify(cuerpo); }
  const r = await fetch("/admin/api" + ruta, op);
  let datos = null;
  try { datos = await r.json(); } catch (_) {}
  if (r.status === 401) { mostrarLogin("La clave no es correcta."); throw new Error("Sin autorización"); }
  if (!r.ok) {
    const d = datos && datos.detail;
    throw new Error(typeof d === "string" ? d : Array.isArray(d) ? d.map((x) => x.msg).join("; ") : "Error " + r.status);
  }
  return datos;
}
async function hacer(fn, ok) {
  try { const r = await fn(); if (ok) avisar(typeof ok === "function" ? ok(r) : ok); await refrescar(); return r; }
  catch (e) { if (e.message !== "Sin autorización") avisar(e.message, false); }
}

function mostrarLogin(error) {
  $("login").style.display = "flex";
  $("loginError").textContent = error || "";
  $("clave").focus();
}
$("formLogin").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  CLAVE = $("clave").value;
  try { sessionStorage.setItem("admin-clave", CLAVE); } catch (_) {}
  try { await api("/estado"); $("login").style.display = "none"; await refrescar(); } catch (_) {}
});

// ───── pestañas ─────
let pestana = "resumen";
$("nav").addEventListener("click", (ev) => {
  const b = ev.target.closest("button"); if (!b) return;
  pestana = b.dataset.p;
  for (const x of document.querySelectorAll("#nav button")) x.classList.toggle("activa", x === b);
  for (const s of document.querySelectorAll(".pestana")) s.classList.toggle("activa", s.id === "p-" + pestana);
  try { localStorage.setItem("admin-pestana", pestana); } catch (_) {}
  refrescar();
});

// ───── estado global ─────
let CLIENTES = [], PERFILES = [], ESTADO = null, rutSel = null;
try { rutSel = localStorage.getItem("admin-cliente"); } catch (_) {}

async function refrescar() {
  if (!CLAVE) return mostrarLogin();
  try {
    const [estado, cli] = await Promise.all([api("/estado"), api("/clientes")]);
    ESTADO = estado; CLIENTES = cli.clientes; PERFILES = cli.perfiles;
    if (!CLIENTES.some((c) => c.rut === rutSel)) rutSel = CLIENTES.length ? CLIENTES[0].rut : null;
    pintarCabecera(); pintarSelectores();
    if (pestana === "resumen") pintarResumen();
    if (pestana === "clientes") pintarClientes();
    if (pestana === "movimientos") await pintarCuentas();
    if (pestana === "creditos") pintarCreditos();
    if (pestana === "permisos") await pintarPermisos();
    if (pestana === "fallas") pintarFallas();
  } catch (e) { if (e.message !== "Sin autorización") avisar("No se pudo cargar: " + e.message, false); }
}

function pintarCabecera() {
  const c = $("chips"); c.replaceChildren();
  c.append(ESTADO.config.exige_token ? chip("Token exigido", "ok") : chip("API ABIERTA", "mal"));
  const f = ESTADO.fallas;
  c.append(f.modo === "ninguna" ? chip("Sin fallas", "gris") : chip("FALLA: " + f.modo.toUpperCase(), "mal"));
  c.append(chip(ESTADO.banco.id, "gris"));
}

function pintarSelectores() {
  for (const sel of document.querySelectorAll(".selCliente")) {
    sel.replaceChildren();
    for (const c of CLIENTES) { const o = el("option", "", c.nombre + " · " + c.rut); o.value = c.rut; sel.append(o); }
    sel.value = rutSel || "";
  }
  const p = $("ncPerfil");
  if (p.options.length !== PERFILES.length) {
    p.replaceChildren(...PERFILES.map((x) => { const o = el("option", "", x); o.value = x; return o; }));
  }
}
for (const sel of document.querySelectorAll(".selCliente")) {
  sel.addEventListener("change", () => {
    rutSel = sel.value; cuentaSel = null;
    try { localStorage.setItem("admin-cliente", rutSel); } catch (_) {}
    refrescar();
  });
}
const clienteSel = () => CLIENTES.find((c) => c.rut === rutSel);

// ───── Resumen ─────
function pintarResumen() {
  const n = ESTADO.conteos, c = $("cifras");
  const items = [["Clientes", n.clientes], ["Cuentas", n.cuentas], ["Créditos", n.creditos],
    ["Movimientos", n.movimientos], ["Pendientes", n.pendientes], ["Consentimientos", n.consentimientos],
    ["Autorizados", n.consentimientos_autorizados], ["Tokens de acceso", n.tokens_acceso],
    ["Refresh tokens", n.refresh_tokens], ["Tokens participante", n.tokens_participante],
    ["Solicitudes PAR", n.solicitudes_par]];
  c.replaceChildren(...items.map(([t, v]) => { const d = el("div", "cifra"); d.append(el("small", "", t), el("b", "", v)); return d; }));
  $("cfgToken").checked = ESTADO.config.exige_token;
  const s = $("cfgDefecto");
  s.replaceChildren(el("option", "", "(ninguno: exigir RUT)"));
  s.options[0].value = "";
  for (const cl of CLIENTES) { const o = el("option", "", cl.nombre + " · " + cl.rut); o.value = cl.rut; s.append(o); }
  const def = CLIENTES.find((cl) => cl.rut.replace(/\./g, "") === (ESTADO.config.cliente_por_defecto || "").replace(/\./g, ""));
  s.value = def ? def.rut : "";
  $("participantes").textContent = "Participantes registrados: " + ESTADO.participantes_registrados
    .map((p) => p.nombre + " (" + p.client_id + ") → " + p.redirect_uris.join(", ")).join(" · ");
}
$("guardarCfg").addEventListener("click", () => hacer(() => api("/config", "PUT",
  { exige_token: $("cfgToken").checked, cliente_por_defecto: $("cfgDefecto").value }), "Configuración guardada."));
$("restablecer").addEventListener("click", () => {
  if (!confirm("¿Restablecer los datos del banco? Se pierden los cambios hechos en vivo.")) return;
  const q = new URLSearchParams({ borrar_creados: $("rsCreados").checked, revocar_permisos: $("rsPermisos").checked });
  hacer(() => api("/restablecer?" + q, "POST"), "Datos restablecidos.");
});

// ───── Clientes ─────
function pintarClientes() {
  tabla($("tablaClientes"), [
    ["Cliente", (c) => [el("div", "", c.nombre), el("div", "cod", c.rut)]],
    ["Clave", (c) => c.clave_demo, "cod"],
    ["Perfil", (c) => [el("span", "", c.perfil + " "), c.creado_en_vivo ? chip("creado", "pend") : chip("base", "gris")]],
    ["Cuentas y saldos", (c) => c.cuentas.map((x) => el("div", "cod", x.accountId + "  " + pesos(x.saldo) + (x.status !== "Activa" ? "  [" + x.status + "]" : "")))],
    ["Movs.", (c) => c.movimientos, "num"],
    ["Créditos", (c) => c.creditos.length, "num"],
    ["Permisos", (c) => c.permisos_vigentes, "num"],
    ["", (c) => { const d = el("div", "acciones");
      d.append(boton("Editar", "sec", () => editarCliente(c)),
               boton("Eliminar", "peligro", () => eliminarCliente(c))); return d; }],
  ], CLIENTES, "No hay clientes.");
}
function editarCliente(c) {
  const nombre = prompt("Nombre de " + c.rut, c.nombre); if (nombre === null) return;
  const clave = prompt("Clave del banco (mínimo 4)", c.clave_demo); if (clave === null) return;
  return hacer(() => api("/clientes/" + encodeURIComponent(c.rut), "PATCH", { nombre, clave }), "Cliente actualizado.");
}
function eliminarCliente(c) {
  if (!confirm("¿Eliminar a " + c.nombre + "? Se revocan sus permisos." + (c.creado_en_vivo ? "" : " Es de base: vuelve al restablecer."))) return;
  return hacer(() => api("/clientes/" + encodeURIComponent(c.rut), "DELETE"), "Cliente eliminado.");
}
$("formCliente").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const cuerpo = { rut: $("ncRut").value.trim(), nombre: $("ncNombre").value.trim(), clave: $("ncClave").value,
                   perfil: $("ncPerfil").value, meses: Number($("ncMeses").value || 12) };
  if ($("ncSueldo").value) cuerpo.sueldo = Number($("ncSueldo").value);
  hacer(() => api("/clientes", "POST", cuerpo), (r) => { ev.target.reset(); return "Cliente creado: " + r.nombre; });
});

// ───── Movimientos ─────
let cuentaSel = null, editando = null;
async function pintarCuentas() {
  const c = clienteSel(), sel = $("mvCuenta");
  sel.replaceChildren();
  if (!c) { $("tablaMovs").replaceChildren(el("div", "vacio", "No hay clientes.")); return; }
  for (const x of c.cuentas) {
    const o = el("option", "", x.accountId + " · " + (x.nickname || x.accountType) + " · " + pesos(x.saldo));
    o.value = x.accountId; sel.append(o);
  }
  if (!c.cuentas.some((x) => x.accountId === cuentaSel)) cuentaSel = c.cuentas[0] && c.cuentas[0].accountId;
  sel.value = cuentaSel;
  await pintarMovs();
}
$("mvCuenta").addEventListener("change", () => { cuentaSel = $("mvCuenta").value; pintarMovs(); });
let buscarT;
$("mvBuscar").addEventListener("input", () => { clearTimeout(buscarT); buscarT = setTimeout(pintarMovs, 250); });

async function pintarMovs() {
  if (!cuentaSel) return;
  const q = new URLSearchParams({ limite: 500 });
  if ($("mvBuscar").value.trim()) q.set("q", $("mvBuscar").value.trim());
  const r = await api("/cuentas/" + encodeURIComponent(cuentaSel) + "/movimientos?" + q);
  const cta = clienteSel().cuentas.find((x) => x.accountId === cuentaSel);
  const pend = r.movimientos.filter((m) => m.pendiente).length;
  $("mvResumen").textContent = r.total + " movimientos · saldo " + pesos(cta.saldo) + " · estado " + cta.status +
    (pend ? " · " + pend + " pendientes" : "") + (r.total > r.movimientos.length ? " · mostrando " + r.movimientos.length : "");
  tabla($("tablaMovs"), [
    ["Fecha", (m) => fecha(m.fecha)],
    ["Detalle", (m) => { const d = el("div"); d.append(el("div", "", m.comercio || m.glosa || m.tipo));
      const meta = el("div", "cod", m.transactionID + (m.categoria ? " · " + m.categoria : "") + (m.comercio && m.glosa ? " · " + m.glosa : ""));
      d.append(meta);
      if (m.pendiente) d.append(chip("PENDIENTE → " + pesos(m.monto_final), "pend"));
      if (m.futuro) d.append(chip("FUTURO", "gris"));
      if (!m.comercio && m.tipo === "Cargo") d.append(chip("SIN COMERCIO", "gris"));
      return d; }],
    ["Monto", (m) => { const s = el("span", m.tipo === "Abono" ? "abono" : "cargo", pesos(m.tipo === "Abono" ? m.monto : -m.monto)); return s; }, "num"],
    ["", (m) => { const d = el("div", "acciones");
      d.append(boton("Editar", "sec", () => abrirMov(m)),
               boton("Borrar", "peligro", () => {
                 if (!confirm("¿Borrar " + m.transactionID + "?")) return;
                 return hacer(() => api("/movimientos/" + encodeURIComponent(m.transactionID), "DELETE"), "Movimiento borrado.");
               })); return d; }],
  ], r.movimientos, "Sin movimientos.");
}

function aLocal(iso) {
  const d = iso ? new Date(iso) : new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function abrirMov(m) {
  editando = m || null;
  $("dlgMovTitulo").textContent = m ? "Editar " + m.transactionID : "Nuevo movimiento en " + cuentaSel;
  $("fmTipo").value = m ? m.tipo : "Cargo";
  $("fmMonto").value = m ? m.monto : "";
  $("fmFecha").value = aLocal(m && m.fecha);
  $("fmComercio").value = m ? (m.comercio || "") : "";
  $("fmCategoria").value = m ? (m.categoria || "") : "";
  $("fmGlosa").value = m ? (m.glosa || "") : "";
  $("fmPendiente").checked = m ? m.pendiente : false;
  $("fmFinal").value = m && m.monto_final ? m.monto_final : "";
  $("dlgMov").showModal();
}
$("mvNuevo").addEventListener("click", () => cuentaSel && abrirMov(null));
$("dlgMov").addEventListener("close", () => {
  if ($("dlgMov").returnValue !== "ok") return;
  const cuerpo = {
    tipo: $("fmTipo").value, monto: Number($("fmMonto").value),
    fecha: new Date($("fmFecha").value || Date.now()).toISOString(),
    comercio: $("fmComercio").value.trim(), categoria: $("fmCategoria").value.trim() || null,
    glosa: $("fmGlosa").value.trim(), pendiente: $("fmPendiente").checked,
  };
  if ($("fmFinal").value) cuerpo.monto_final = Number($("fmFinal").value);
  if (editando) hacer(() => api("/movimientos/" + encodeURIComponent(editando.transactionID), "PATCH", cuerpo), "Movimiento actualizado.");
  else hacer(() => api("/cuentas/" + encodeURIComponent(cuentaSel) + "/movimientos", "POST", cuerpo), "Movimiento creado.");
});
$("mvConfirmar").addEventListener("click", () => hacer(() => api("/avanzar?rut=" + encodeURIComponent(rutSel), "POST"),
  (r) => r.confirmados + " pendientes confirmados."));
$("editarCuenta").addEventListener("click", () => {
  const cta = clienteSel() && clienteSel().cuentas.find((x) => x.accountId === cuentaSel); if (!cta) return;
  const status = prompt("Estado de " + cta.accountId + " (Activa, Bloqueada, Cerrada…)", cta.status); if (status === null) return;
  const nickname = prompt("Apodo", cta.nickname || ""); if (nickname === null) return;
  hacer(() => api("/cuentas/" + encodeURIComponent(cta.accountId), "PATCH", { status, nickname }), "Cuenta actualizada.");
});

// ───── Créditos ─────
function pintarCreditos() {
  const c = clienteSel();
  tabla($("tablaCreditos"), [
    ["Crédito", (x) => [el("div", "", x.productName), el("div", "cod", x.loanID + " · " + x.loanType)]],
    ["Estado", (x) => [x.arrears ? chip("EN MORA", "mal") : null, chip(x.status, x.remainingInstallments ? "ok" : "gris")].filter(Boolean)],
    ["Cuota", (x) => pesos(x.monthlyInstallment), "num"],
    ["Quedan", (x) => x.remainingInstallments + " de " + x.loanTermMonths, "num"],
    ["Saldo", (x) => pesos(x.currentBalance), "num"],
    ["", (x) => { const d = el("div", "acciones"); const id = encodeURIComponent(x.loanID);
      d.append(
        boton("Pagar 1", "sec", () => hacer(() => api("/creditos/" + id, "PATCH", { pagar_cuotas: 1 }), "Cuota pagada.")),
        boton(x.arrears ? "Quitar mora" : "Mora", "sec", () => hacer(() => api("/creditos/" + id, "PATCH", { mora: !x.arrears }), "Mora actualizada.")),
        boton("Ajustar", "sec", () => {
          const cuota = prompt("Cuota mensual", x.monthlyInstallment); if (cuota === null) return;
          const restantes = prompt("Cuotas restantes", x.remainingInstallments); if (restantes === null) return;
          return hacer(() => api("/creditos/" + id, "PATCH", { cuota: Number(cuota), restantes: Number(restantes) }), "Crédito ajustado.");
        }),
        boton("Borrar", "peligro", () => confirm("¿Borrar " + x.loanID + "?") &&
          hacer(() => api("/creditos/" + id, "DELETE"), "Crédito borrado."))); return d; }],
  ], c ? c.creditos : [], "Este cliente no tiene créditos.");
}
$("formCredito").addEventListener("submit", (ev) => {
  ev.preventDefault();
  if (!rutSel) return;
  const cuerpo = { producto: $("ncrProducto").value, tipo: $("ncrTipo").value, monto: Number($("ncrMonto").value),
    cuota: Number($("ncrCuota").value), plazo: Number($("ncrPlazo").value), pagadas: Number($("ncrPagadas").value),
    tasa: Number($("ncrTasa").value) };
  hacer(() => api("/clientes/" + encodeURIComponent(rutSel) + "/creditos", "POST", cuerpo), "Crédito agregado.");
});

// ───── Permisos ─────
async function pintarPermisos() {
  const p = await api("/permisos");
  const estadoChip = (s) => chip(s, s.startsWith("Authorised") ? "ok" : s === "Revoked" ? "mal" : "pend");
  tabla($("tablaConsent"), [
    ["Consentimiento", (x) => [el("div", "cod", x.consentId), el("div", "", x.permisos.join(", "))]],
    ["Cliente", (x) => x.cliente ? x.cliente + " · " + x.rut : (x.rut || "—")],
    ["Estado", (x) => estadoChip(x.status)],
    ["Expira", (x) => fecha(x.expira)],
    ["Acceso / refresh", (x) => x.tokens_acceso + " / " + x.refresh_tokens, "num"],
    ["", (x) => x.status === "Revoked" ? "" : boton("Revocar", "peligro", () =>
      hacer(() => api("/permisos/" + encodeURIComponent(x.consentId), "DELETE"), "Consentimiento revocado."))],
  ], p.consentimientos, "No hay consentimientos.");
  tabla($("tablaTokens"), [
    ["Token", (x) => x.token, "cod"], ["Consentimiento", (x) => x.consentId, "cod"],
    ["Cliente", (x) => x.cliente || x.rut], ["Expira", (x) => fecha(x.expira)],
    ["", (x) => x.vigente ? chip("vigente", "ok") : chip("vencido", "gris")],
  ], p.tokens_acceso, "No hay tokens de acceso.");
  tabla($("tablaPart"), [
    ["Token", (x) => x.token, "cod"], ["Participante", (x) => x.client_id],
    ["Expira", (x) => fecha(x.expira)], ["", (x) => x.vigente ? chip("vigente", "ok") : chip("vencido", "gris")],
  ], p.tokens_participante, "No hay tokens de participante.");
}
$("revocarTodo").addEventListener("click", () => {
  if (!confirm("¿Revocar TODOS los permisos y tokens? Velvet tendrá que volver a vincular este banco.")) return;
  hacer(() => api("/revocar-todo", "POST"), "Todo revocado.");
});

// ───── Fallas ─────
function pintarFallas() {
  const f = ESTADO.fallas;
  if (document.activeElement && document.activeElement.closest && document.activeElement.closest("#formFallas")) return;
  $("flModo").value = f.modo; $("flCodigo").value = f.codigo; $("flDemora").value = f.demora_ms; $("flProb").value = f.probabilidad;
  $("flEstado").textContent = f.modo === "ninguna" ? "La API responde normal."
    : "Falla activa: " + f.modo + " · " + f.afectadas + " llamadas afectadas desde que se aplicó.";
}
$("formFallas").addEventListener("submit", (ev) => {
  ev.preventDefault();
  hacer(() => api("/fallas", "PUT", { modo: $("flModo").value, codigo: Number($("flCodigo").value),
    demora_ms: Number($("flDemora").value), probabilidad: Number($("flProb").value) }), "Falla aplicada.");
});
$("flApagar").addEventListener("click", () => hacer(() => api("/fallas", "PUT", { modo: "ninguna" }), "La API volvió a la normalidad."));

// ───── inicio ─────
try { const p = localStorage.getItem("admin-pestana"); if (p) document.querySelector('#nav [data-p="' + p + '"]')?.click(); } catch (_) {}
if (CLAVE) { $("login").style.display = "none"; refrescar(); } else mostrarLogin();
</script>
</body></html>
"""

ADMIN_HTML = ADMIN_HTML.replace("__BANCO__", _escape(_banco.NOMBRE))
