/**
 * Descargar todos mis datos — portabilidad (Ley 21.719).
 *
 * La ley no pide una pantalla donde mirar los datos, pide poder **llevárselos**
 * a otro servicio. Por eso la salida es un archivo JSON estructurado y no una
 * lista en pantalla.
 *
 * Se separa lo que mandó el banco de lo que el sistema dedujo. Si alguien se
 * lleva sus datos, tiene derecho a distinguir el dato original de nuestra
 * interpretación: la glosa que llegó no es lo mismo que la categoría que le
 * pusimos nosotros.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { Boton } from "@/components/Boton";
import { Nota, Pantalla, Seccion } from "@/components/Pantalla";
import { colores, espacio, fuente, radio } from "@/constants/tema";
import { exportarDatos } from "@/servicios/privacidad";

const CONTIENE = [
  "Tus datos de cuenta: nombre, correo y sueldo configurado",
  "Las cuentas bancarias vinculadas, con su número enmascarado",
  "Todos tus movimientos: lo que mandó el banco y la categoría que les pusimos",
  "Tus metas de ahorro y lo que llevas reunido",
  "Las correcciones de categoría que hiciste",
  "Las autorizaciones que diste, con sus fechas",
];

export default function Exportar() {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [listo, setListo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function descargar() {
    setOcupado(true);
    setError(null);
    setListo(null);
    try {
      const datos = await exportarDatos();
      const texto = JSON.stringify(datos, null, 2);
      const nombre = `velvet-wallet-datos-${new Date().toISOString().slice(0, 10)}.json`;

      if (Platform.OS === "web") {
        // En el navegador se entrega como descarga del propio navegador.
        const url = URL.createObjectURL(new Blob([texto], { type: "application/json" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = nombre;
        a.click();
        URL.revokeObjectURL(url);
        setListo(`Se descargó ${nombre}`);
      } else {
        // En el teléfono se abre la hoja de compartir del sistema, que es la
        // forma en que el usuario elige dónde guardarlo o a quién mandarlo.
        const { default: FileSystem } = await import("expo-file-system/legacy");
        const Sharing = await import("expo-sharing");
        const ruta = `${FileSystem.cacheDirectory}${nombre}`;
        await FileSystem.writeAsStringAsync(ruta, texto);
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(ruta);
        setListo(`Se preparó ${nombre}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo preparar la descarga.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Pantalla titulo="Tus datos" onAtras={() => router.back()}>
      <Text style={estilos.entrada}>
        Puedes llevarte una copia completa de tus datos cuando quieras, en un formato que otro
        servicio pueda leer. Es un derecho que te reconoce la Ley 21.719 y no tiene costo.
      </Text>

      <Seccion titulo="Qué incluye el archivo" />
      <View style={estilos.tarjeta}>
        {CONTIENE.map((linea) => (
          <View key={linea} style={estilos.fila}>
            <Ionicons name="checkmark" size={16} color={colores.ok} style={estilos.tick} />
            <Text style={estilos.filaTexto}>{linea}</Text>
          </View>
        ))}
      </View>

      <Nota>
        No se incluyen contraseñas ni los permisos técnicos con que accedemos a tu banco. Esos no
        son datos tuyos que puedas portar: son credenciales nuestras para hablar con la institución,
        y publicarlas en un archivo sería un riesgo para ti.
      </Nota>

      {listo ? <Text style={estilos.ok}>{listo}</Text> : null}
      {error ? <Text style={estilos.error}>{error}</Text> : null}

      <Boton
        titulo="Descargar mis datos"
        onPress={descargar}
        cargando={ocupado}
        style={estilos.boton}
      />

      <Text style={estilos.pie}>
        La descarga queda registrada en tu bitácora, igual que cualquier otro acceso a tus datos.
      </Text>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  entrada: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 15, lineHeight: 22 },
  tarjeta: { backgroundColor: colores.tarjeta, borderRadius: radio.l, padding: espacio.l, gap: espacio.m },
  fila: { flexDirection: "row", gap: espacio.m, alignItems: "flex-start" },
  tick: { marginTop: 2 },
  filaTexto: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 14, lineHeight: 20, flex: 1 },
  ok: { color: colores.ok, fontFamily: fuente.textoMedio, fontSize: 14, marginTop: espacio.l },
  error: { color: colores.acento, fontFamily: fuente.textoMedio, fontSize: 14, marginTop: espacio.l },
  boton: { marginTop: espacio.l },
  pie: {
    color: colores.texto3,
    fontFamily: fuente.texto,
    fontSize: 12.5,
    textAlign: "center",
    marginTop: espacio.m,
  },
});
