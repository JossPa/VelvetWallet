/**
 * Asistente conversacional: la persona pregunta con sus palabras y Velvi
 * responde con las cifras de sus propios datos.
 *
 * Tres cosas que esta pantalla hace visibles a propósito:
 *
 *  · **Qué consultó para responder.** Bajo cada respuesta va "Consultó: Flujo
 *    de caja". Es la prueba, a la vista, de que la cifra salió de una función y
 *    no del modelo.
 *  · **El permiso antes que el chat.** El asistente es lo único que envía datos
 *    fuera de Velvet (Ley 21.719). Si la finalidad no está autorizada, la
 *    pantalla muestra qué se envía y qué no antes de dejar escribir.
 *  · **Cuándo se abstiene.** Si responde que no tiene el dato, la mascota baja
 *    las orejas: decir "no sé" es una respuesta correcta, no un error.
 *
 * Velvi está presente en toda la conversación (ver `VelviVivo`): al abrir el
 * chat aparece grande y flotando; mientras escribes ladea la cabeza; mientras
 * lee tus datos se balancea; cuando llega la respuesta da un saltito y pasa a la
 * cabecera; y cada respuesta lleva su cara al lado, para que se lea quién habla.
 *
 * La conversación vive solo aquí: no se guarda en el teléfono ni en el servidor.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { Boton } from "@/components/Boton";
import { Mascota, NOMBRE_MASCOTA, type EstadoMascota } from "@/components/Mascota";
import { Tocable, useMovimientoReducido } from "@/components/Movimiento";
import { FondoDePantalla, Superficie } from "@/components/Superficie";
import { VelviVivo } from "@/components/VelviVivo";
import { espacio, fuente, radio } from "@/constants/tema";
import { crearEstilos, useColores } from "@/tema/TemaContexto";
import { ErrorAsistente, preguntar, type Mensaje } from "@/servicios/asistente";
import { decidirFinalidad, obtenerFinalidades } from "@/servicios/privacidad";

const FINALIDAD = "asistente_ia";

const SUGERENCIAS = [
  "¿En qué se me fue la plata el mes pasado?",
  "¿Me alcanza para algo de $80.000?",
  "¿Cuáles son mis gastos hormiga?",
  "¿Y si ahorro $50.000 más al mes para mi meta?",
  "¿Cuánto puedo gastar por día hasta que me paguen?",
];

/** Respuestas en que el asistente se abstuvo: la mascota lo muestra. */
const SE_ABSTUVO = /no (tengo|puedo|doy|sé|cuento con)|no alcancé/i;

type Permiso = "revisando" | "falta" | "otorgado";

export default function Asistente() {
  const estilos = useEstilos();
  const colores = useColores();
  const router = useRouter();
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [problema, setProblema] = useState<string | null>(null);
  const [permiso, setPermiso] = useState<Permiso>("revisando");
  const [otorgando, setOtorgando] = useState(false);
  const desplazable = useRef<ScrollView>(null);
  const reducido = useMovimientoReducido();
  const entra = reducido ? undefined : FadeInDown.duration(280);

  useEffect(() => {
    obtenerFinalidades()
      .then((fs) => setPermiso(fs.find((f) => f.id === FINALIDAD)?.consentido ? "otorgado" : "falta"))
      // Si no se pudo revisar, se deja escribir: el servidor vuelve a exigir
      // el permiso igual, y su respuesta trae de vuelta esta pantalla.
      .catch(() => setPermiso("otorgado"));
  }, []);

  const ultima = mensajes[mensajes.length - 1];
  const estado: EstadoMascota = pensando
    ? "consultando"
    : ultima?.rol === "asistente" && SE_ABSTUVO.test(ultima.texto)
      ? "no_sabe"
      : "escuchando";
  // Velvi está solo y grande hasta la primera pregunta; después pasa a la cabecera.
  const presentacion = mensajes.length === 0 && permiso === "otorgado";
  const respuestas = mensajes.filter((m) => m.rol === "asistente").length;

  async function enviar(pregunta: string) {
    const limpia = pregunta.trim();
    if (!limpia || pensando) return;
    const historial: Mensaje[] = [...mensajes, { rol: "usuario", texto: limpia }];
    setMensajes(historial);
    setTexto("");
    setProblema(null);
    setPensando(true);
    try {
      const respuesta = await preguntar(historial);
      setMensajes([...historial, respuesta]);
    } catch (e) {
      if (e instanceof ErrorAsistente && e.motivo === "sin_consentimiento") {
        setMensajes(mensajes); // la pregunta se puede volver a hacer tras autorizar
        setTexto(limpia);
        setPermiso("falta");
      } else {
        setProblema(e instanceof Error ? e.message : "No pude responder ahora.");
      }
    } finally {
      setPensando(false);
    }
  }

  async function autorizar() {
    setOtorgando(true);
    try {
      await decidirFinalidad(FINALIDAD, true);
      setPermiso("otorgado");
    } catch (e) {
      setProblema(e instanceof Error ? e.message : "No se pudo guardar la autorización.");
    } finally {
      setOtorgando(false);
    }
  }

  return (
    <SafeAreaView style={estilos.area} edges={["top", "bottom"]}>
      <FondoDePantalla />
      <View style={estilos.cabecera}>
        {/* Si el chat se abrió directo (recargando la página o desde un enlace)
            no hay pantalla anterior: volver lleva al inicio en vez de no hacer nada. */}
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          hitSlop={12}
          accessibilityLabel="Volver"
        >
          <Ionicons name="chevron-back" size={26} color={colores.texto} />
        </Pressable>
        {presentacion ? (
          <View style={{ flex: 1 }} />
        ) : (
          <Animated.View entering={reducido ? undefined : FadeIn.duration(300)} style={estilos.identidad}>
            <Animated.View entering={reducido ? undefined : ZoomIn.springify().damping(12)}>
              <VelviVivo estado={estado} tamano={42} reaccion={respuestas} atento={texto.length > 0} />
            </Animated.View>
            <View style={{ flex: 1 }}>
              <Text style={estilos.nombre}>{NOMBRE_MASCOTA}</Text>
              <Text style={estilos.lema}>
                {pensando ? "Consultando tus datos…" : "Lee tus datos, no los inventa"}
              </Text>
            </View>
          </Animated.View>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={desplazable}
          contentContainerStyle={estilos.hilo}
          onContentSizeChange={() => desplazable.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          {permiso === "falta" ? (
            <Permiso onAutorizar={autorizar} otorgando={otorgando}
                     onDetalle={() => router.push("/cuentas/privacidad")} />
          ) : (
            <>
              {presentacion ? (
                <View style={estilos.escenario}>
                  <VelviVivo estado={estado} tamano={132} atento={texto.length > 0} conHalo />
                  <Text style={estilos.escenarioNombre}>{NOMBRE_MASCOTA}</Text>
                  <Text style={estilos.lema}>Lee tus datos, no los inventa</Text>
                </View>
              ) : null}

              <Burbuja rol="asistente" conCara={!presentacion}
                texto={`Hola, soy ${NOMBRE_MASCOTA}. Pregúntame por tus gastos, tu día de pago, tus cobros fijos o tus metas. Las cifras las saco de tus datos; si no tengo una, te lo digo.`} />

              {mensajes.length === 0 && permiso === "otorgado" ? (
                <View style={estilos.sugerencias}>
                  {SUGERENCIAS.map((s) => (
                    <Tocable key={s} onPress={() => enviar(s)} style={estilos.sugerencia}>
                      <Text style={estilos.sugerenciaTexto}>{s}</Text>
                    </Tocable>
                  ))}
                </View>
              ) : null}

              {mensajes.map((m, i) => (
                <Animated.View key={i} entering={entra}>
                  <Burbuja rol={m.rol} texto={m.texto} consultas={m.consultas}
                           estado={i === mensajes.length - 1 ? estado : "escuchando"} />
                </Animated.View>
              ))}

              {pensando ? (
                <Animated.View entering={entra} style={estilos.fila}>
                  <VelviVivo estado="consultando" tamano={30} />
                  <View style={[estilos.burbuja, estilos.deAsistente, estilos.pensando]}>
                    <Puntos />
                    <Text style={estilos.pensandoTexto}>Leyendo tus datos</Text>
                  </View>
                </Animated.View>
              ) : null}

              {problema ? (
                <View style={[estilos.burbuja, estilos.deAsistente, estilos.problema]}>
                  <Text style={estilos.problemaTexto}>{problema}</Text>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>

        {permiso !== "falta" ? (
          <View style={estilos.barraEntrada}>
            <TextInput
              value={texto}
              onChangeText={setTexto}
              placeholder={`Pregúntale algo a ${NOMBRE_MASCOTA}…`}
              placeholderTextColor={colores.texto3}
              style={estilos.entrada}
              onSubmitEditing={() => enviar(texto)}
              returnKeyType="send"
              editable={!pensando && permiso === "otorgado"}
              maxLength={500}
            />
            <Tocable
              onPress={() => enviar(texto)}
              disabled={!texto.trim() || pensando}
              style={[estilos.enviar, (!texto.trim() || pensando) && estilos.enviarInactivo]}
              accessibilityLabel="Enviar pregunta"
            >
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
            </Tocable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Burbuja({ rol, texto, consultas, estado = "escuchando", conCara = true }: {
  rol: Mensaje["rol"];
  texto: string;
  consultas?: string[];
  estado?: EstadoMascota;
  /** La cara de Velvi junto a la burbuja: se lee quién habla. */
  conCara?: boolean;
}) {
  const estilos = useEstilos();
  const colores = useColores();
  const propia = rol === "usuario";
  const burbuja = (
    <View style={[estilos.burbuja, propia ? estilos.deUsuario : estilos.deAsistente]}>
      <Text style={propia ? estilos.textoUsuario : estilos.textoAsistente}>{texto}</Text>
      {consultas && consultas.length > 0 ? (
        <View style={estilos.consulto}>
          <Ionicons name="checkmark-circle" size={13} color={colores.ok} />
          <Text style={estilos.consultoTexto}>Consultó: {consultas.join(" · ")}</Text>
        </View>
      ) : null}
    </View>
  );
  if (propia || !conCara) return burbuja;
  return (
    <View style={estilos.fila}>
      <Mascota estado={estado} tamano={30} />
      {burbuja}
    </View>
  );
}

/** Tres puntos que laten en secuencia: Velvi está trabajando. */
function Puntos() {
  const estilos = useEstilos();
  return (
    <View style={estilos.puntosLatido}>
      {[0, 1, 2].map((i) => <Punto3 key={i} demora={i * 160} />)}
    </View>
  );
}

function Punto3({ demora }: { demora: number }) {
  const estilos = useEstilos();
  const v = useSharedValue(0.3);
  useEffect(() => {
    v.value = withDelay(demora, withRepeat(withSequence(
      withTiming(1, { duration: 360 }),
      withTiming(0.3, { duration: 360 }),
    ), -1));
  }, [demora, v]);
  const estilo = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: (0.3 - v.value) * 4 }] }));
  return <Animated.View style={[estilos.punto3, estilo]} />;
}

function Permiso({ onAutorizar, onDetalle, otorgando }: {
  onAutorizar: () => void;
  onDetalle: () => void;
  otorgando: boolean;
}) {
  const estilos = useEstilos();
  return (
    <Superficie nivel={1} style={estilos.permiso}>
      <View style={estilos.permisoCabeza}>
        <Mascota estado="escuchando" tamano={56} />
        <Text style={estilos.permisoTitulo}>Antes de conversar</Text>
      </View>
      <Text style={estilos.permisoTexto}>
        Para responderte, tu pregunta y los totales que hacen falta se envían a Groq, el proveedor que
        ejecuta el modelo de lenguaje.
      </Text>
      <View style={estilos.puntos}>
        <Punto icono="checkmark" texto="Viajan: tu pregunta, categorías, comercios, montos y fechas." />
        <Punto icono="close" texto="Nunca: tu nombre, tu RUT, tu correo ni tus claves." />
        <Punto icono="calculator-outline" texto="Las cifras las calcula Velvet, no el modelo." />
        <Punto icono="trash-outline" texto="No guardamos la conversación." />
      </View>
      <Boton titulo="Autorizar y conversar" onPress={onAutorizar} cargando={otorgando} />
      <Pressable onPress={onDetalle} hitSlop={8}>
        <Text style={estilos.permisoEnlace}>Ver el detalle o revocarlo en Privacidad</Text>
      </Pressable>
    </Superficie>
  );
}

function Punto({ icono, texto }: { icono: keyof typeof Ionicons.glyphMap; texto: string }) {
  const estilos = useEstilos();
  const colores = useColores();
  return (
    <View style={estilos.punto}>
      <Ionicons name={icono} size={16} color={icono === "close" ? colores.acento : colores.texto2} />
      <Text style={estilos.puntoTexto}>{texto}</Text>
    </View>
  );
}

const useEstilos = crearEstilos((colores) => StyleSheet.create({
  area: { flex: 1, backgroundColor: colores.fondo },
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    gap: espacio.m,
    paddingHorizontal: espacio.l,
    paddingVertical: espacio.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colores.borde,
  },
  identidad: { flex: 1, flexDirection: "row", alignItems: "center", gap: espacio.m },
  nombre: { color: colores.texto, fontFamily: fuente.titulo, fontSize: 17 },
  escenario: { alignItems: "center", paddingTop: espacio.l, paddingBottom: espacio.m, gap: 2 },
  escenarioNombre: { color: colores.texto, fontFamily: fuente.titulo, fontSize: 24, marginTop: espacio.m },
  fila: { flexDirection: "row", alignItems: "flex-end", gap: espacio.s, maxWidth: "92%" },
  puntosLatido: { flexDirection: "row", gap: 4, alignItems: "center" },
  punto3: { width: 6, height: 6, borderRadius: 3, backgroundColor: colores.acento },
  lema: { color: colores.ok, fontFamily: fuente.texto, fontSize: 12 },

  hilo: { padding: espacio.l, gap: espacio.m, paddingBottom: espacio.xl },
  burbuja: { maxWidth: "85%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: radio.l },
  deUsuario: { alignSelf: "flex-end", backgroundColor: colores.acento, borderBottomRightRadius: 4 },
  deAsistente: {
    alignSelf: "flex-start",
    backgroundColor: colores.tarjeta,
    borderWidth: 1,
    borderColor: colores.borde,
    borderTopColor: colores.bordeAlto,
    borderBottomLeftRadius: 4,
  },
  textoUsuario: { color: "#FFFFFF", fontFamily: fuente.texto, fontSize: 15, lineHeight: 21 },
  textoAsistente: { color: colores.texto, fontFamily: fuente.texto, fontSize: 15, lineHeight: 21 },
  consulto: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: espacio.s },
  consultoTexto: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 12 },

  pensando: { flexDirection: "row", alignItems: "center", gap: espacio.s },
  pensandoTexto: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 14 },
  problema: { backgroundColor: colores.alertaSuave, borderColor: colores.alerta },
  problemaTexto: { color: colores.alerta, fontFamily: fuente.texto, fontSize: 14, lineHeight: 20 },

  sugerencias: { gap: espacio.s, alignItems: "flex-start" },
  sugerencia: {
    backgroundColor: colores.chip,
    borderRadius: radio.l,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  sugerenciaTexto: { color: colores.texto, fontFamily: fuente.textoMedio, fontSize: 14 },

  barraEntrada: {
    flexDirection: "row",
    alignItems: "center",
    gap: espacio.s,
    paddingHorizontal: espacio.l,
    paddingVertical: espacio.m,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colores.borde,
  },
  entrada: {
    flex: 1,
    backgroundColor: colores.zona,
    color: colores.texto,
    fontFamily: fuente.texto,
    fontSize: 15,
    borderRadius: radio.xl,
    paddingHorizontal: espacio.l,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  enviar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colores.acento,
    alignItems: "center",
    justifyContent: "center",
  },
  enviarInactivo: { opacity: 0.4 },

  permiso: { padding: espacio.xl, gap: espacio.l, borderRadius: radio.xl },
  permisoCabeza: { flexDirection: "row", alignItems: "center", gap: espacio.m },
  permisoTitulo: { color: colores.texto, fontFamily: fuente.titulo, fontSize: 20 },
  permisoTexto: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 15, lineHeight: 22 },
  puntos: { gap: espacio.s },
  punto: { flexDirection: "row", gap: espacio.s, alignItems: "flex-start" },
  puntoTexto: { flex: 1, color: colores.texto, fontFamily: fuente.texto, fontSize: 14, lineHeight: 20 },
  permisoEnlace: {
    color: colores.texto2,
    fontFamily: fuente.textoMedio,
    fontSize: 13,
    textAlign: "center",
    textDecorationLine: "underline",
  },
}));
