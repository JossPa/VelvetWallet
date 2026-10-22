/**
 * Aviso de primera vez: cómo se clasifican los gastos y qué papel juegan
 * los datos de la persona en eso.
 *
 * Por qué existe: el sistema categoriza los gastos solo, y mejora si puede
 * aprender de las correcciones de quienes lo usan. Eso último es tratamiento
 * de datos personales con una finalidad distinta de mostrárselos, así que
 * requiere consentimiento propio (Ley 21.719). Pedirlo sin explicar para qué
 * sería un consentimiento no informado, que legalmente vale lo mismo que nada.
 *
 * Tres decisiones de diseño que importan:
 *
 *  · **No se puede descartar sin leer.** No hay una "X" en la esquina ni se
 *    cierra tocando fuera. Las dos salidas son botones con texto que dice qué
 *    hacen. Un aviso que se quita con un toque reflejo no informó a nadie.
 *  · **Ninguna de las dos salidas activa nada.** Ni siquiera la principal: la
 *    lleva a la pantalla donde decide. El consentimiento no se obtiene de
 *    rebote por tocar el botón grande.
 *  · **Se dice que viene desactivado antes de pedir nada.** Primero el estado
 *    real, después la invitación.
 */
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Boton } from "@/components/Boton";
import { colores, espacio, fuente, radio } from "@/constants/tema";

type Props = {
  visible: boolean;
  /** "Ver después": cierra y no vuelve a aparecer. */
  onDespues: () => void;
  /** "Ir a la opción": cierra y lleva a Cuentas → Para qué usamos tus datos. */
  onIr: () => void;
};

const PASOS = [
  {
    icono: "pricetag-outline" as const,
    titulo: "Ordenamos tus gastos solos",
    texto:
      "Cada compra que llega desde tu banco se clasifica automáticamente: supermercado, " +
      "transporte, servicios. No tienes que etiquetar nada a mano.",
  },
  {
    icono: "help-circle-outline" as const,
    titulo: "Cuando no estamos seguros, lo decimos",
    texto:
      "Si una compra no se reconoce, queda en «Por revisar» sin categoría en vez de " +
      "adivinar. Preferimos dejarla en blanco antes que ponerte un dato equivocado.",
  },
  {
    icono: "trending-up-outline" as const,
    titulo: "Aprende de las correcciones",
    texto:
      "Cada vez que alguien corrige una categoría, el sistema puede aprender de ese " +
      "ejemplo y acertar más la próxima vez.",
  },
];

export function AvisoClasificacion({ visible, onDespues, onIr }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDespues}>
      <View style={estilos.fondo}>
        <View style={estilos.tarjeta}>
          <ScrollView
            contentContainerStyle={estilos.contenido}
            showsVerticalScrollIndicator={false}
          >
            <View style={estilos.icono}>
              <Ionicons name="sparkles" size={22} color={colores.acento} />
            </View>

            <Text style={estilos.titulo}>Tus gastos se ordenan solos</Text>
            <Text style={estilos.bajada}>
              Así funciona la clasificación automática, y qué puedes decidir tú al respecto.
            </Text>

            <View style={estilos.pasos}>
              {PASOS.map((p) => (
                <View key={p.titulo} style={estilos.paso}>
                  <Ionicons name={p.icono} size={19} color={colores.texto2} style={estilos.pasoIcono} />
                  <View style={estilos.pasoCuerpo}>
                    <Text style={estilos.pasoTitulo}>{p.titulo}</Text>
                    <Text style={estilos.pasoTexto}>{p.texto}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={estilos.recuadro}>
              <Text style={estilos.recuadroTitulo}>Usar tus datos para esto es opcional</Text>
              <Text style={estilos.recuadroTexto}>
                Viene <Text style={estilos.fuerte}>desactivado</Text>. Hoy tus datos solo se usan
                para mostrártelos a ti, y nada más.
              </Text>
              <Text style={estilos.recuadroTexto}>
                Si lo activas, tus correcciones ayudan a mejorar la clasificación automática. Es
                voluntario, la aplicación funciona igual si no lo activas, y puedes desactivarlo
                cuando quieras.
              </Text>
            </View>

            <Boton titulo="Ver la opción" onPress={onIr} />

            <Pressable onPress={onDespues} style={estilos.despues} hitSlop={8}>
              <Text style={estilos.despuesTexto}>Ver después</Text>
            </Pressable>

            <Text style={estilos.pie}>
              Puedes encontrarlo cuando quieras en Cuentas → Para qué usamos tus datos.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    padding: espacio.l,
  },
  tarjeta: {
    backgroundColor: colores.fondo,
    borderRadius: radio.l + 4,
    borderWidth: 1,
    borderColor: colores.linea,
    maxHeight: "88%",
  },
  contenido: { padding: espacio.xl, gap: espacio.m },
  icono: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colores.acentoSuave,
    alignItems: "center",
    justifyContent: "center",
  },
  titulo: { color: colores.texto, fontFamily: fuente.titulo, fontSize: 24, letterSpacing: -0.5 },
  bajada: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 15, lineHeight: 22 },

  pasos: { gap: espacio.l, marginTop: espacio.s },
  paso: { flexDirection: "row", gap: espacio.m, alignItems: "flex-start" },
  pasoIcono: { marginTop: 1 },
  pasoCuerpo: { flex: 1, gap: 3 },
  pasoTitulo: { color: colores.texto, fontFamily: fuente.textoFuerte, fontSize: 15 },
  pasoTexto: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 13.5, lineHeight: 20 },

  recuadro: {
    backgroundColor: colores.tarjeta,
    borderRadius: radio.m,
    padding: espacio.l,
    gap: espacio.s,
    marginTop: espacio.s,
  },
  recuadroTitulo: { color: colores.texto, fontFamily: fuente.tituloMedio, fontSize: 15 },
  recuadroTexto: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 13.5, lineHeight: 20 },
  fuerte: { color: colores.texto, fontFamily: fuente.textoFuerte },

  despues: { paddingVertical: espacio.m, alignItems: "center" },
  despuesTexto: { color: colores.texto2, fontFamily: fuente.textoFuerte, fontSize: 15 },
  pie: {
    color: colores.texto3,
    fontFamily: fuente.texto,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});
