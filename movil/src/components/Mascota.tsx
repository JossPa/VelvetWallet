/**
 * Chilla, la chinchilla que responde en el asistente.
 *
 * Por qué una chinchilla: es nativa de los Andes chilenos y tiene el pelaje más
 * suave que existe —terciopelo, "velvet"—. Gris como el fondo de la app, con el
 * rojo de la marca solo en las orejas y la nariz: no agrega colores nuevos.
 *
 * Dibujo geométrico y tres estados, sin animación de adorno. La regla del tema
 * es que el movimiento confirma, no entretiene, así que cada estado dice algo:
 *
 *   escuchando   ojos abiertos: lista para la pregunta
 *   consultando  mira hacia arriba: está corriendo una herramienta con tus datos
 *   no_sabe      orejas caídas y ojos cerrados: se abstiene o no corresponde
 */
import Svg, { Circle, Rect } from "react-native-svg";

import { colores } from "@/constants/tema";

export type EstadoMascota = "escuchando" | "consultando" | "no_sabe";

export const NOMBRE_MASCOTA = "Chilla";

const PELO = "#4A4C55";
const OREJA = "#3A3C44";

export function Mascota({ estado = "escuchando", tamano = 40 }: { estado?: EstadoMascota; tamano?: number }) {
  const caida = estado === "no_sabe";
  const arriba = estado === "consultando";
  // Las orejas se abren hacia los lados cuando no sabe: es el gesto que se lee
  // a distancia, incluso a 32 px.
  const orejaX = caida ? 24 : 28;
  const orejaY = caida ? 30 : 26;
  const ojoDX = arriba ? 4 : 0;
  const ojoY = arriba ? 52 : 56;

  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 100 100" accessibilityLabel={`${NOMBRE_MASCOTA}, ${estado}`}>
      <Circle cx={orejaX} cy={orejaY} r={20} fill={OREJA} />
      <Circle cx={100 - orejaX} cy={orejaY} r={20} fill={OREJA} />
      <Circle cx={orejaX} cy={orejaY} r={11} fill={colores.acento} />
      <Circle cx={100 - orejaX} cy={orejaY} r={11} fill={colores.acento} />
      <Circle cx={50} cy={60} r={34} fill={PELO} />
      {caida ? (
        <>
          <Rect x={33} y={55} width={10} height={3} rx={1.5} fill={colores.texto} />
          <Rect x={57} y={55} width={10} height={3} rx={1.5} fill={colores.texto} />
        </>
      ) : (
        <>
          <Circle cx={38 + ojoDX} cy={ojoY} r={5} fill={colores.texto} />
          <Circle cx={62 + ojoDX} cy={ojoY} r={5} fill={colores.texto} />
        </>
      )}
      <Circle cx={50} cy={68} r={3} fill={colores.acento} />
    </Svg>
  );
}
