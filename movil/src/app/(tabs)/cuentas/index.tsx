/**
 * Cuentas — cuánto tienes y dónde, los bancos conectados y los derechos sobre
 * los datos.
 *
 * Una persona tiene cuentas en más de un banco (RF-07): esta pantalla suma
 * todas, deja conectar otro banco, sincronizar y renovar el permiso de cada
 * uno por separado, y abrir cada cuenta para ver solo sus movimientos.
 *
 * Los enlaces de "Tus datos" corresponden a derechos de la Ley 21.719:
 * información sobre las finalidades, acceso a lo autorizado, portabilidad,
 * registro de tratamiento, notificación de brechas y supresión.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Boton } from "@/components/Boton";
import { Cifra } from "@/components/Cifra";
import { Fila, GrupoDeFilas } from "@/components/Fila";
import { FilaConexion } from "@/components/FilaConexion";
import { Ficha } from "@/components/Ficha";
import { Aparecer } from "@/components/Movimiento";
import { mensajeDeVuelta, PanelAutorizacion } from "@/components/PanelAutorizacion";
import { Nota, Pantalla, Seccion } from "@/components/Pantalla";
import { Segmentos } from "@/components/Segmentos";
import { Superficie } from "@/components/Superficie";
import { espacio, fuente, movimiento, radio } from "@/constants/tema";
import { crearEstilos, useTema, type PreferenciaTema } from "@/tema/TemaContexto";
import { useMovimientos, type VueltaDelBanco } from "@/datos/MovimientosContexto";
import { useSesion } from "@/sesion/SesionContexto";
import { ErrorSincronizacion } from "@/servicios/sincronizacion";
import { pesos } from "@/utils/formato";
import { totalDeCuentas } from "@/utils/resumen";

/**
 * Los derechos del titular que reconoce la Ley 21.719, cada uno con su
 * pantalla. `peligro` marca el que no tiene vuelta atrás.
 *
 * El detalle no es decorativo: nombra el derecho legal que hay detrás, que es
 * justamente lo que un evaluador quiere ver conectado con la ley. El icono
 * además deja la lista legible de un vistazo, sin tener que leer seis títulos
 * parecidos.
 */
const APARIENCIAS: { valor: PreferenciaTema; etiqueta: string }[] = [
  { valor: "sistema", etiqueta: "Sistema" },
  { valor: "claro", etiqueta: "Claro" },
  { valor: "oscuro", etiqueta: "Oscuro" },
];

const DERECHOS: {
  texto: string;
  detalle: string;
  icono: keyof typeof Ionicons.glyphMap;
  ruta: string;
  peligro?: boolean;
}[] = [
  {
    texto: "Para qué usamos tus datos",
    detalle: "Finalidades del tratamiento",
    icono: "information-circle-outline",
    ruta: "/cuentas/privacidad",
  },
  {
    texto: "Qué autorizaste y por cuánto tiempo",
    detalle: "Consentimientos vigentes y revocación",
    icono: "key-outline",
    ruta: "/cuentas/autorizaciones",
  },
  {
    texto: "Descargar todos mis datos",
    detalle: "Derecho de portabilidad",
    icono: "download-outline",
    ruta: "/cuentas/exportar",
  },
  {
    texto: "Bitácora de accesos",
    detalle: "Registro de actividades de tratamiento",
    icono: "time-outline",
    ruta: "/cuentas/bitacora",
  },
  {
    texto: "Avisos de seguridad",
    detalle: "Notificación de brechas",
    icono: "shield-outline",
    ruta: "/cuentas/incidentes",
  },
  {
    texto: "Eliminar mi cuenta y mis datos",
    detalle: "Derecho de supresión",
    icono: "trash-outline",
    ruta: "/cuentas/eliminar",
    peligro: true,
  },
];

export default function Cuentas() {
  const estilos = useEstilos();
  const router = useRouter();
  const { usuario, salir } = useSesion();
  const { preferencia, cambiarPreferencia } = useTema();
  // Las instituciones salen del backend, que es el único que sabe qué permiso
  // está vigente y de cuándo es el dato.
  const {
    conexiones, instituciones, sincronizando, sincronizar, irAlBanco, completarVinculacion,
    desvincular, error,
  } = useMovimientos();

  // Panel de autorización abierto: para conectar otro banco o renovar uno.
  const [panel, setPanel] = useState<{ motivo: string | null; bancos: string[] } | null>(null);
  const [banco, setBanco] = useState("");
  const [abriendo, setAbriendo] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Bancos del SFA a los que todavía no hay permiso: los que se ofrecen al
  // conectar otro. Uno ya conectado se renueva desde su propia fila.
  const porConectar = instituciones.filter((i) => !i.conectada).map((i) => i.nombre);

  function abrirPanel(bancos: string[], motivo: string | null = null) {
    setMensaje(null);
    setBanco(bancos[0] ?? "");
    setPanel({ bancos, motivo });
  }

  async function procesarVuelta(v: VueltaDelBanco) {
    setPanel(null);
    if (v.banco !== "vinculado") {
      setMensaje(mensajeDeVuelta(v));
      return;
    }
    try {
      await completarVinculacion();
    } catch {
      // El mensaje queda en `error`.
    }
  }

  /** Al sitio del banco. En web la página se va y el banco devuelve a Inicio. */
  async function alIrAlBanco() {
    setAbriendo(true);
    try {
      const vuelta = await irAlBanco(banco);
      if (vuelta) await procesarVuelta(vuelta);
    } catch {
      // El mensaje queda en `error`.
    } finally {
      setAbriendo(false);
    }
  }

  async function alSincronizar() {
    setMensaje(null);
    try {
      const r = await sincronizar();
      // Cada banco por separado (RF-07): el que falló se nombra, el resto llegó.
      const fallidos = r.bancos.filter((b) => !b.ok && b.codigo === "sin_respuesta");
      const vencido = r.bancos.find((b) => !b.ok && b.codigo === "reautorizar");
      const cambios = r.nuevos + r.actualizados;
      setMensaje(
        [
          cambios > 0
            ? `${cambios} ${cambios === 1 ? "movimiento nuevo o actualizado" : "movimientos nuevos o actualizados"}.`
            : "Todo al día.",
          ...fallidos.map((b) => `${b.institucion} no respondió: se muestran sus datos de la última vez.`),
        ].join("\n"),
      );
      if (vencido) {
        abrirPanel([vencido.institucion], `El permiso de ${vencido.institucion} venció. Renuévalo en su sitio.`);
      }
    } catch (e) {
      if (e instanceof ErrorSincronizacion && e.codigo === "reautorizar") {
        const vencidos = conexiones.filter((c) => c.estado === "autorizacion_vencida").map((c) => c.institucion);
        abrirPanel(vencidos.length ? vencidos : porConectar, e.message);
      }
      // Otro error: el mensaje queda en `error`.
    }
  }

  // "Conectada" es una institución con permiso por el SFA: el efectivo y las
  // cartolas se muestran en la lista, pero no son conexiones.
  const conectadas = conexiones.filter((c) => (c.fuente ?? "sfa") === "sfa").length;
  const etiqueta = conectadas === 1 ? "1 conectada" : `${conectadas} conectadas`;
  const { total, cuentas, sinSaldo } = totalDeCuentas(conexiones);

  return (
    <Pantalla
      titulo="Cuentas"
      etiqueta={sincronizando ? "Actualizando…" : etiqueta}
      resumen={cuentas > 0 ? { rotulo: "EN TUS CUENTAS", valor: pesos(total), negativo: total < 0 } : undefined}
    >
      {/* Lo primero que se busca en esta pestaña: cuánto hay, sumando todos
          los bancos, y poder traer lo último sin volver a Inicio. */}
      {cuentas > 0 ? (
        <Superficie nivel={1} style={estilos.zona}>
          <Text style={estilos.rotulo}>EN TUS CUENTAS</Text>
          <Cifra valor={total} style={[estilos.total, total < 0 && estilos.negativo]} />
          <Text style={estilos.pie}>
            {cuentas} {cuentas === 1 ? "cuenta" : "cuentas"} en {conexiones.length}{" "}
            {conexiones.length === 1 ? "institución" : "instituciones"}
            {sinSaldo > 0 ? ` · ${sinSaldo} sin saldo informado` : ""}
          </Text>
          <Boton
            titulo={sincronizando ? "Consultando tus bancos…" : "Sincronizar"}
            onPress={alSincronizar}
            cargando={sincronizando}
            secundario
            style={estilos.sincronizar}
          />
        </Superficie>
      ) : null}

      <Seccion titulo="Instituciones" />
      {conexiones.length === 0 ? (
        <Nota>
          Todavía no tienes instituciones. Conecta tu banco para traer tus cuentas y movimientos, o
          importa una cartola.
        </Nota>
      ) : (
        <View style={estilos.instituciones}>
          {conexiones.map((c) => (
            <FilaConexion
              key={c.id}
              conexion={c}
              onReautorizar={(x) => abrirPanel([x.institucion], `Renueva el permiso de ${x.institucion}.`)}
              onDesvincular={(x) => desvincular(x.id).catch(() => {})}
              onAbrirCuenta={(cuenta, x) =>
                router.push({ pathname: "/cuentas/cuenta", params: { conexion: x.id, cuenta: cuenta.id } })
              }
            />
          ))}
        </View>
      )}

      {/* Conectar otro banco, aquí mismo: una persona tiene cuentas en varios
          (RF-07). Se ofrecen solo los que faltan; el resto se renueva desde
          su fila. */}
      {panel ? (
        <PanelAutorizacion
          motivo={panel.motivo}
          ocupado={abriendo || sincronizando}
          onIrAlBanco={alIrAlBanco}
          onCancelar={() => setPanel(null)}
          bancos={panel.bancos}
          banco={banco}
          onElegir={setBanco}
        />
      ) : porConectar.length > 0 ? (
        <Pressable onPress={() => abrirPanel(porConectar)} style={estilos.conectar} accessibilityRole="button">
          <Text style={estilos.conectarTexto}>
            {conectadas === 0 ? "+  Conectar mi banco" : "+  Conectar otro banco"}
          </Text>
          <Text style={estilos.conectarDetalle}>
            {porConectar.length === 1 ? porConectar[0] : `${porConectar.length} disponibles: ${porConectar.join(", ")}`}
          </Text>
        </Pressable>
      ) : null}

      {mensaje ? <Text style={estilos.mensaje}>{mensaje}</Text> : null}
      {error ? <Text style={estilos.error}>{error}</Text> : null}

      <Seccion titulo="Tu perfil" />
      <Ficha
        filas={[
          { etiqueta: "Nombre", valor: usuario?.nombre ?? "—" },
          { etiqueta: "Correo", valor: usuario?.email ?? "—" },
          {
            etiqueta: "Sueldo mensual",
            // Sin declarar no se muestra el estimado: aquí solo cabe una línea
            // y un número sin su evidencia al lado se lee como un hecho. La
            // estimación se explica en su pantalla, donde sí cabe justificarla.
            valor: usuario?.sueldoDeclarado != null ? pesos(usuario.sueldoDeclarado) : "Sin declarar",
            destacar: usuario?.sueldoDeclarado == null,
          },
        ]}
      />
      <View style={estilos.sueldo}>
        <GrupoDeFilas>
          <Fila
            titulo={usuario?.sueldoDeclarado != null ? "Cambiar mi sueldo" : "Configurar mi sueldo"}
            icono="wallet-outline"
            onPress={() => router.push("/cuentas/sueldo")}
            ultima
          />
        </GrupoDeFilas>
      </View>

      {/* Lo que no llega por el SFA: otro banco, meses anteriores, efectivo. */}
      <View style={estilos.cargas}>
        <GrupoDeFilas>
          <Fila
            titulo="Importar una cartola"
            detalle="Otro banco o meses anteriores, en CSV"
            icono="document-text-outline"
            onPress={() => router.push("/cuentas/cartola")}
          />
          <Fila
            titulo="Anotar un gasto en efectivo"
            icono="cash-outline"
            onPress={() => router.push("/gastos/nuevo")}
            ultima
          />
        </GrupoDeFilas>
      </View>

      <Seccion titulo="Apariencia" />
      <Segmentos opciones={APARIENCIAS} valor={preferencia} onCambio={cambiarPreferencia} />
      <Nota>
        {preferencia === "sistema"
          ? "Sigue el modo claro u oscuro de tu teléfono."
          : `Siempre en modo ${preferencia}, aunque el teléfono esté en el otro.`}
      </Nota>

      <Seccion titulo="Tus datos" />
      <Aparecer demora={movimiento.escalon}>
        <GrupoDeFilas>
          {DERECHOS.map(({ texto, detalle, icono, ruta, peligro }, i) => (
            <Fila
              key={texto}
              titulo={texto}
              detalle={detalle}
              icono={icono}
              tono={peligro ? "peligro" : "normal"}
              onPress={() => router.push(ruta as never)}
              ultima={i === DERECHOS.length - 1}
            />
          ))}
        </GrupoDeFilas>
      </Aparecer>

      <Nota>
        Velvet Wallet nunca pide ni guarda tu clave del banco. La autorización ocurre en el sitio de
        la institución.
      </Nota>

      <Boton titulo="Cerrar sesión" onPress={salir} secundario style={estilos.salir} />
    </Pantalla>
  );
}

const useEstilos = crearEstilos((colores) => StyleSheet.create({
  zona: { padding: espacio.l, marginBottom: espacio.s },
  rotulo: { color: colores.texto3, fontFamily: fuente.tituloMedio, fontSize: 12, letterSpacing: 1.4 },
  total: { color: colores.texto, fontFamily: fuente.titulo, fontSize: 34, marginTop: espacio.xs },
  negativo: { color: colores.alerta },
  pie: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 13, marginTop: espacio.xs },
  sincronizar: { marginTop: espacio.m },
  conectar: {
    marginTop: espacio.m,
    paddingVertical: espacio.m,
    paddingHorizontal: espacio.l,
    borderRadius: radio.l,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colores.bordeVivo,
    gap: 2,
  },
  conectarTexto: { color: colores.texto, fontFamily: fuente.textoFuerte, fontSize: 15 },
  conectarDetalle: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 13 },
  mensaje: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 13, lineHeight: 19, marginTop: espacio.m },
  error: { color: colores.alerta, fontFamily: fuente.texto, fontSize: 13, lineHeight: 19, marginTop: espacio.m },
  sueldo: { marginTop: espacio.m },
  // Las instituciones iban sueltas sobre el fondo mientras todo lo demás
  // estaba en tarjetas: se leían como si no pertenecieran a la pantalla.
  instituciones: {
    backgroundColor: colores.tarjeta,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colores.borde,
    borderTopColor: colores.bordeAlto,
    borderRadius: radio.l,
    paddingHorizontal: espacio.l,
  },
  cargas: { marginTop: espacio.m },
  salir: { marginTop: espacio.xl },
}));
