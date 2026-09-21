/**
 * Avatar de un comercio: logo vectorial, imagen local o monograma, según lo
 * que tenga el catálogo. Sin identificar → "?" sobre acento suave.
 */
import { Image, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colores, fuente, radio } from "@/constants/tema";
import { COMERCIOS, LOGOS } from "@/datos/comercios";

/** "Uber Eats" → "UE", "Lider" → "LI". */
function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  const letras = partes.length >= 2 ? partes[0][0] + partes[1][0] : nombre.slice(0, 2);
  return letras.toUpperCase();
}

type Props = {
  nombre: string;
  sinIdentificar?: boolean;
  tamano?: number;
};

export function AvatarComercio({ nombre, sinIdentificar = false, tamano = 44 }: Props) {
  const caja = { width: tamano, height: tamano, borderRadius: radio.m };

  if (sinIdentificar) {
    return (
      <View style={[estilos.caja, caja, { backgroundColor: colores.acentoSuave }]}>
        <Text style={[estilos.texto, { color: colores.acento, fontSize: tamano * 0.34 }]}>?</Text>
      </View>
    );
  }

  const entrada = COMERCIOS[nombre];
  const fondo = entrada?.color ?? colores.chip;
  const tinta = entrada?.tinta ?? (entrada ? "#FFFFFF" : colores.texto2);

  // 1. Imagen local
  if (entrada?.imagen) {
    return (
      <View style={[estilos.caja, caja, { backgroundColor: fondo }]}>
        <Image source={entrada.imagen} style={{ width: tamano * 0.6, height: tamano * 0.6 }} resizeMode="contain" />
      </View>
    );
  }

  // 2. Logo vectorial. Los trazados de simple-icons están en un lienzo de 24×24.
  const logo = entrada?.logo ? LOGOS[entrada.logo] : undefined;
  if (logo) {
    const lado = tamano * 0.55;
    return (
      <View style={[estilos.caja, caja, { backgroundColor: fondo }]}>
        <Svg width={lado} height={lado} viewBox="0 0 24 24">
          <Path d={logo.trazado} fill={tinta} />
        </Svg>
      </View>
    );
  }

  // 3. Monograma
  return (
    <View style={[estilos.caja, caja, { backgroundColor: fondo }]}>
      <Text style={[estilos.texto, { color: tinta, fontSize: tamano * 0.32 }]}>{iniciales(nombre)}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: { alignItems: "center", justifyContent: "center" },
  texto: { fontFamily: fuente.tituloMedio },
});
