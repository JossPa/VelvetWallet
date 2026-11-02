/**
 * Avatar de un comercio: logo vectorial, imagen local o monograma, según lo
 * que tenga el catálogo. Sin identificar → "?" sobre acento suave.
 */
import { Image, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colores, fuente, radio } from "@/constants/tema";
import { COMERCIOS, LOGOS } from "@/datos/comercios";
import { tinte } from "@/utils/coloresCategoria";

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
  /**
   * Color de la categoría del movimiento.
   *
   * Solo se usa en el monograma, que es el caso sin logo: ahí el avatar no
   * tenía identidad y era un cuadro gris más. Un comercio con logo conserva su
   * marca —Lider azul, Uber Eats verde— porque reconocerlo de un vistazo vale
   * más que saber su categoría, que de todas formas va escrita al lado.
   */
  colorCategoria?: string;
};

export function AvatarComercio({
  nombre,
  sinIdentificar = false,
  tamano = 44,
  colorCategoria,
}: Props) {
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

  // 1. Imagen local. `overflow: hidden` recorta la imagen a las esquinas
  //    redondeadas del avatar cuando la escala es 1.
  if (entrada?.imagen) {
    const lado = tamano * (entrada.escala ?? 0.6);
    return (
      <View style={[estilos.caja, caja, { backgroundColor: fondo, overflow: "hidden" }]}>
        <Image source={entrada.imagen} style={{ width: lado, height: lado }} resizeMode="contain" />
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

  // 3. Monograma. Sin logo que lo identifique, el avatar toma el color de su
  //    categoría: deja de ser un cuadro gris indistinguible del de al lado.
  const hayTinte = !entrada && colorCategoria;
  return (
    <View
      style={[
        estilos.caja,
        caja,
        { backgroundColor: hayTinte ? tinte(colorCategoria) : fondo },
      ]}
    >
      <Text
        style={[
          estilos.texto,
          { color: hayTinte ? colorCategoria : tinta, fontSize: tamano * 0.32 },
        ]}
      >
        {iniciales(nombre)}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: { alignItems: "center", justifyContent: "center" },
  texto: { fontFamily: fuente.tituloMedio },
});
