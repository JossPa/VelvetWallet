/**
 * "Servidor": a qué computador se conecta la app.
 *
 * La APK trae fijada la IP que tenía el PC al compilarla. Si el PC cambia de
 * IP (otro Wi-Fi, el router le dio otra), aquí se escribe la nueva sin
 * recompilar. Se prueba antes de guardarla.
 */
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Boton } from "@/components/Boton";
import { Campo } from "@/components/Campo";
import { espacio, fuente, radio } from "@/constants/tema";
import {
  SERVIDOR_POR_DEFECTO,
  api,
  fijarServidor,
  normalizarServidor,
  probarServidor,
} from "@/servicios/api";
import { crearEstilos } from "@/tema/TemaContexto";

export function AjusteServidor() {
  const estilos = useEstilos();
  const [abierto, setAbierto] = useState(false);
  const [actual, setActual] = useState(api());
  const [texto, setTexto] = useState(api());
  const [estado, setEstado] = useState<string | null>(null);
  const [probando, setProbando] = useState(false);

  async function guardar() {
    const url = normalizarServidor(texto);
    if (!url) {
      setEstado("Eso no parece una dirección. Ej.: 192.168.1.5");
      return;
    }
    setProbando(true);
    setEstado(null);
    const ok = await probarServidor(url);
    setProbando(false);
    if (!ok) {
      setEstado(`No responde ${url}. ¿El PC está encendido, en el mismo Wi-Fi y con iniciar.cmd -Red?`);
      return;
    }
    await fijarServidor(url === SERVIDOR_POR_DEFECTO ? null : url);
    setActual(url);
    setTexto(url);
    setEstado("Conectado.");
    setAbierto(false);
  }

  if (!abierto) {
    return (
      <Pressable onPress={() => setAbierto(true)} accessibilityRole="button" style={estilos.resumen}>
        <Text style={estilos.resumenTexto}>
          Servidor: <Text style={estilos.mono}>{actual}</Text> · <Text style={estilos.enlace}>cambiar</Text>
        </Text>
        {estado ? <Text style={estilos.estado}>{estado}</Text> : null}
      </Pressable>
    );
  }

  return (
    <View style={estilos.caja}>
      <Campo
        etiqueta="Servidor (IP del PC)"
        value={texto}
        onChangeText={setTexto}
        placeholder="192.168.1.5"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        onSubmitEditing={guardar}
      />
      {estado ? <Text style={estilos.estado}>{estado}</Text> : null}
      <Boton titulo="Probar y guardar" onPress={guardar} cargando={probando} />
      <Pressable onPress={() => { setAbierto(false); setEstado(null); setTexto(actual); }}>
        <Text style={[estilos.resumenTexto, estilos.enlace]}>Cancelar</Text>
      </Pressable>
    </View>
  );
}

const useEstilos = crearEstilos((colores) => StyleSheet.create({
  resumen: { alignItems: "center", gap: 4, paddingVertical: espacio.s },
  resumenTexto: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 13, textAlign: "center" },
  mono: { fontFamily: fuente.mono, color: colores.texto2 },
  enlace: { color: colores.acento, fontFamily: fuente.textoFuerte },
  estado: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 13, textAlign: "center" },
  caja: {
    backgroundColor: colores.tarjeta,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colores.borde,
    borderRadius: radio.m,
    padding: espacio.m,
    gap: espacio.s,
    alignItems: "stretch",
  },
}));
