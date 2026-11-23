/**
 * Velvi, la mascota que responde en el asistente.
 *
 * Diseño de Pedro: pelaje negro de terciopelo —"velvet"—, orejas largas con el
 * rojo de la marca por dentro, mechón de llama, lentes redondos y una capa roja
 * con ribete dorado y el escudo de la V. Sostiene su cartera: cuida tu plata y
 * lee tus números con calma, sin inventar nada.
 *
 * Como el pelaje es casi negro y el fondo de la app también, la cabeza se dibuja
 * dos veces: la primera con trazo claro, la segunda encima sin trazo. Así queda
 * solo el contorno iluminado y la silueta no se pierde en el fondo.
 *
 * Tres estados, sin animación de adorno (el movimiento confirma, no entretiene):
 *
 *   escuchando   ojos grandes y brillantes, sonrisa de gato
 *   consultando  mira hacia arriba y le brillan los lentes: está leyendo tus datos
 *   no_sabe      orejas caídas, ojos cerrados y el mechón ladeado: se abstiene
 *
 * Funciona desde 32 px: a ese tamaño se leen las orejas, los lentes, el mechón
 * y la capa; la cartera y el escudo suman cuando hay espacio.
 */
import { useId } from "react";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

export type EstadoMascota = "escuchando" | "consultando" | "no_sabe";

export const NOMBRE_MASCOTA = "Velvi";

const PELO_CLARO = "#4C4756";
const PELO = "#2C2932";
const PELO_OSCURO = "#18161C";
const BORDE = "#676179"; // luz de contorno: separa el pelaje negro del fondo
const OJO = "#08080A";
const LENTE = "#F4F4F7";
const BOCA = "#0B0A0D";
const BIGOTE = "#ECECF0";
const ROJO = "#E8213F";
const ROJO_CLARO = "#FF5470";
const ROJO_OSCURO = "#8E1029";
const ORO = "#F0C062";
const ORO_OSCURO = "#B07A2A";
const CARTERA = "#1C1A20";

/** Mejilla esponjosa: puntas de pelo al lado izquierdo de la cabeza; la derecha es su espejo. */
const MEJILLA: [number, number][] = [
  [31, 44], [21, 50], [27, 54], [16, 61], [25, 64], [18, 71], [27, 73], [22, 80], [33, 79], [38, 84],
];
const poligono = (puntos: [number, number][]) => "M" + puntos.map(([x, y]) => `${x} ${y}`).join(" L") + " Z";
const MEJILLA_IZQ = poligono(MEJILLA);
const MEJILLA_DER = poligono(MEJILLA.map(([x, y]) => [120 - x, y]));

export function Mascota({ estado = "escuchando", tamano = 40 }: { estado?: EstadoMascota; tamano?: number }) {
  // ids únicos por instancia: en la web los degradados viven en un espacio global
  const sufijo = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (n: string) => `${n}${sufijo}`;
  const url = (n: string) => `url(#${id(n)})`;

  const noSabe = estado === "no_sabe";
  const consulta = estado === "consultando";

  // Orejas: erguidas y un poco abiertas; caídas hacia los lados cuando no sabe.
  const giroOreja = noSabe ? 48 : consulta ? 10 : 14;
  const bajaOreja = noSabe ? 9 : 0;
  // Los ojos miran arriba a la derecha mientras consulta.
  const dx = consulta ? 1.8 : 0;
  const dy = consulta ? -2.4 : 0;

  const cabeza = (
    <>
      <Ellipse cx="60" cy="58" rx="33" ry="28.5" />
      <Path d={MEJILLA_IZQ} />
      <Path d={MEJILLA_DER} />
    </>
  );

  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 120 120" accessibilityLabel={`${NOMBRE_MASCOTA}, ${estado}`}>
      <Defs>
        <RadialGradient id={id("pelo")} cx="50" cy="40" r="70" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={PELO_CLARO} />
          <Stop offset="0.5" stopColor={PELO} />
          <Stop offset="1" stopColor={PELO_OSCURO} />
        </RadialGradient>
        <LinearGradient id={id("oreja")} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={ROJO_CLARO} />
          <Stop offset="1" stopColor={ROJO_OSCURO} />
        </LinearGradient>
        <LinearGradient id={id("capa")} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={ROJO} />
          <Stop offset="1" stopColor={ROJO_OSCURO} />
        </LinearGradient>
        <LinearGradient id={id("llama")} x1="0" y1="1" x2="0.4" y2="0">
          <Stop offset="0" stopColor={ROJO_OSCURO} />
          <Stop offset="0.6" stopColor={ROJO} />
          <Stop offset="1" stopColor={ROJO_CLARO} />
        </LinearGradient>
        <RadialGradient id={id("hocico")} cx="60" cy="72" r="16" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#5E5868" />
          <Stop offset="1" stopColor={PELO} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <G transform="translate(3 6) scale(0.95)">
        {/* orejas largas */}
        {([-1, 1] as const).map((lado) => {
          const cx = 60 + lado * 21;
          return (
            <G key={lado} transform={`translate(0 ${bajaOreja}) rotate(${lado * giroOreja} ${cx} 46)`}>
              <Ellipse cx={cx} cy="23" rx="13.5" ry="25" fill={PELO_OSCURO} stroke={BORDE} strokeWidth="2" />
              <Ellipse cx={cx} cy="26" rx="8.2" ry="18" fill={url("oreja")} />
              <Ellipse cx={cx - 2.6} cy="19" rx="2.2" ry="6" fill="#FFFFFF" opacity="0.22" />
            </G>
          );
        })}

        {/* cuerpo y capa roja con ribete dorado */}
        <Path d="M30 121 C30 101 43 90 60 90 C77 90 90 101 90 121 Z" fill={url("pelo")} stroke={BORDE} strokeWidth="1.6" />
        <G fill={url("capa")} stroke={ORO} strokeWidth="1.5" strokeLinejoin="round">
          <Path d="M12 121 C13 104 25 93 42 88 C37 99 35 110 37 121 Z" />
          <Path d="M108 121 C107 104 95 93 78 88 C83 99 85 110 83 121 Z" />
          <Path d="M28 93 C40 84 80 84 92 93 C80 99 40 99 28 93 Z" />
        </G>
        {/* escudo dorado con la V */}
        <G transform="translate(25 99)">
          <Path d="M0 0 L11 0 L11 6 C11 10 8 12.5 5.5 14 C3 12.5 0 10 0 6 Z" fill={CARTERA} stroke={ORO}
                strokeWidth="1.4" strokeLinejoin="round" />
          <Path d="M2.8 3.2 L5.5 9.5 L8.2 3.2" stroke={ORO} strokeWidth="1.6" fill="none" strokeLinejoin="round"
                strokeLinecap="round" />
        </G>

        {/* cabeza esponjosa: primero con trazo (contorno iluminado), luego encima sin trazo */}
        <G fill={url("pelo")} stroke={BORDE} strokeWidth="3" strokeLinejoin="round">{cabeza}</G>
        <G fill={url("pelo")}>{cabeza}</G>
        <Path d="M36 42 Q60 25 84 42 Q60 34 36 42 Z" fill="#FFFFFF" opacity="0.09" />

        {/* mechón de llama, su sello */}
        <G transform={`rotate(${noSabe ? 22 : 0} 60 36)`}>
          <Path
            d="M49 38 C45 29 50 20 59 16 C56 23 58 27 62 29 C61 20 70 13 80 14 C73 18 72 24 74 29 C76 34 72 38 68 39 Z"
            fill={url("llama")}
          />
          <Path d="M55 34 C54 28 56 23 59 20" stroke={ROJO_CLARO} strokeWidth="1.5" fill="none"
                strokeLinecap="round" opacity="0.8" />
        </G>

        {/* hocico */}
        <Ellipse cx="60" cy="72" rx="15" ry="11" fill={url("hocico")} />

        {/* ojos grandes y brillantes */}
        {noSabe ? (
          <G stroke={OJO} strokeWidth="2.8" strokeLinecap="round" fill="none">
            <Path d="M40 60 Q47 65 54 60" />
            <Path d="M66 60 Q73 65 80 60" />
          </G>
        ) : (
          <G>
            {[47, 73].map((x) => (
              <G key={x}>
                <Ellipse cx={x + dx} cy={60 + dy} rx="7.4" ry="8.4" fill={OJO} />
                <Circle cx={x + dx - 2.4} cy={60 + dy - 3} r="2.9" fill="#FFFFFF" />
                <Circle cx={x + dx + 2.7} cy={60 + dy + 2.8} r="1.3" fill="#FFFFFF" opacity="0.85" />
              </G>
            ))}
          </G>
        )}

        {/* lentes redondos */}
        <G stroke={LENTE} strokeWidth="2.7" fill="none" strokeLinecap="round">
          <Circle cx="47" cy="60" r="11.5" fill="#FFFFFF" fillOpacity="0.05" />
          <Circle cx="73" cy="60" r="11.5" fill="#FFFFFF" fillOpacity="0.05" />
          <Path d="M58.4 58.5 Q60 56.4 61.6 58.5" />
          <Path d="M35.5 57.5 L27 55" />
          <Path d="M84.5 57.5 L93 55" />
        </G>
        {consulta && (
          <G stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round">
            <Path d="M41 53 L45 50" />
            <Path d="M67 53 L71 50" />
          </G>
        )}

        {/* nariz roja y boca */}
        <Path d="M56.8 68.6 Q60 67 63.2 68.6 Q61.6 72.4 60 72.4 Q58.4 72.4 56.8 68.6 Z" fill={ROJO} />
        {noSabe ? (
          <Path d="M56 77.5 L64 77.5" stroke={BOCA} strokeWidth="1.9" strokeLinecap="round" />
        ) : consulta ? (
          <Path d="M60 72.4 L60 74.6 M57 76.4 Q60 78.2 63.4 75.6" stroke={BOCA} strokeWidth="1.9" fill="none"
                strokeLinecap="round" />
        ) : (
          <Path d="M60 72.4 L60 74.6 M54.8 74.8 Q57.4 78.4 60 74.6 Q62.6 78.4 65.2 74.8" stroke={BOCA}
                strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* bigotes */}
        <G stroke={BIGOTE} strokeWidth="1.1" strokeLinecap="round" opacity="0.85">
          <Path d="M48 71 L19 66" />
          <Path d="M48 73.6 L17 74.5" />
          <Path d="M48 76.2 L20 83" />
          <Path d="M72 71 L101 66" />
          <Path d="M72 73.6 L103 74.5" />
          <Path d="M72 76.2 L100 83" />
        </G>

        {/* la cartera, en sus patas */}
        <G transform="rotate(-7 74 106)">
          <Rect x="60" y="96" width="29" height="20" rx="3.5" fill={CARTERA} stroke="#4A4652" strokeWidth="1.4" />
          <Rect x="62.5" y="98.5" width="24" height="15" rx="2" fill="none" stroke={ORO_OSCURO} strokeWidth="0.8"
                strokeDasharray="1.6 1.4" />
          <Path d="M70 101.5 L74.5 110.5 L79 101.5" stroke={ORO} strokeWidth="2.2" fill="none" strokeLinejoin="round"
                strokeLinecap="round" />
          <Rect x="85" y="102" width="7" height="7" rx="2" fill={ROJO} />
          <Circle cx="89.5" cy="105.5" r="1.4" fill={ORO} />
        </G>
        {([[58, 108], [90, 110.5]] as const).map(([cx, cy]) => (
          <G key={cx}>
            <Ellipse cx={cx} cy={cy} rx="6.2" ry="5.2" fill="#3C3845" stroke={BORDE} strokeWidth="1.2" />
            <Path d={`M${cx - 2} ${cy - 4} L${cx - 2} ${cy - 1.5} M${cx + 1.5} ${cy - 4} L${cx + 1.5} ${cy - 1.5}`}
                  stroke={PELO_OSCURO} strokeWidth="1" strokeLinecap="round" />
          </G>
        ))}
      </G>
    </Svg>
  );
}
