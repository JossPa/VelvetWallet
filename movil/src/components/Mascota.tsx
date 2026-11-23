/**
 * Chilla, la chinchilla que responde en el asistente.
 *
 * Por qué una chinchilla: es nativa de los Andes chilenos y tiene el pelaje más
 * suave que existe —terciopelo, "velvet"—. Gris como el fondo de la app, con el
 * rojo de la marca en lo que la identifica: el interior de las orejas, la nariz
 * y su mechón. Los lentes redondos son su carácter: lee tus números con calma y
 * no inventa nada.
 *
 * Se dibuja en tres planos —orejas, cabeza esponjosa, rostro— con la luz
 * cayendo desde arriba, la misma regla que siguen las superficies de la app.
 * Tres estados, sin animación de adorno (el movimiento confirma, no entretiene):
 *
 *   escuchando   párpados a medio cerrar: atenta, un poco sabionda
 *   consultando  mira hacia arriba y le brillan los lentes: está leyendo tus datos
 *   no_sabe      orejas caídas, ojos cerrados y el mechón ladeado: se abstiene
 *
 * Funciona desde 32 px: a ese tamaño se leen las orejas, los lentes y el mechón;
 * el resto suma cuando hay espacio.
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
  Stop,
} from "react-native-svg";

export type EstadoMascota = "escuchando" | "consultando" | "no_sabe";

export const NOMBRE_MASCOTA = "Chilla";

const PELO_CLARO = "#7A7D88";
const PELO = "#52555F";
const PELO_OSCURO = "#3A3C44";
const OREJA_BORDE = "#44464F";
const HOCICO = "#8A8D97";
const OJO = "#111114";
const LENTE = "#E9E9EE";
const ROJO = "#EE3450";
const ROJO_OSCURO = "#B51F38";
const TINTA = "#24252B";

/** Contorno esponjoso de la cabeza: un óvalo con mechones alrededor. */
const MECHONES: [number, number, number][] = [
  [24, 66, 11], [21, 78, 12], [28, 90, 11], [40, 97, 10], [53, 100, 9], [67, 100, 9],
  [80, 97, 10], [92, 90, 11], [99, 78, 12], [96, 66, 11], [30, 54, 9], [90, 54, 9],
];

export function Mascota({ estado = "escuchando", tamano = 40 }: { estado?: EstadoMascota; tamano?: number }) {
  // ids únicos por instancia: en la web los degradados viven en un espacio global
  const sufijo = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (n: string) => `${n}${sufijo}`;

  const noSabe = estado === "no_sabe";
  const consulta = estado === "consultando";

  // Orejas: erguidas y un poco abiertas; caídas hacia los lados cuando no sabe.
  const giroOreja = noSabe ? 64 : consulta ? 26 : 32;
  const bajaOreja = noSabe ? 14 : 0;
  // Los ojos miran arriba a la derecha mientras consulta.
  const dx = consulta ? 1.6 : 0;
  const dy = consulta ? -2.2 : 0;

  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 120 120" accessibilityLabel={`${NOMBRE_MASCOTA}, ${estado}`}>
      <Defs>
        <RadialGradient id={id("pelo")} cx="48" cy="44" r="62" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={PELO_CLARO} />
          <Stop offset="0.55" stopColor={PELO} />
          <Stop offset="1" stopColor={PELO_OSCURO} />
        </RadialGradient>
        <LinearGradient id={id("oreja")} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FF6A80" />
          <Stop offset="1" stopColor={ROJO_OSCURO} />
        </LinearGradient>
        <LinearGradient id={id("mechon")} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FF5A72" />
          <Stop offset="1" stopColor={ROJO_OSCURO} />
        </LinearGradient>
        <RadialGradient id={id("hocico")} cx="60" cy="76" r="18" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#9EA1AA" />
          <Stop offset="1" stopColor={HOCICO} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* sombra de apoyo */}
      <Ellipse cx="60" cy="113" rx="30" ry="4" fill="#000" opacity="0.28" />

      {/* hombros, detrás de la cabeza */}
      <Path d="M20 121 C20 100 38 91 60 91 C82 91 100 100 100 121 Z" fill={`url(#${id("pelo")})`} />
      <Ellipse cx="60" cy="112" rx="15" ry="9" fill={HOCICO} opacity="0.45" />

      {/* orejas */}
      {([-1, 1] as const).map((lado) => (
        <G key={lado} transform={`translate(0 ${bajaOreja}) rotate(${lado * giroOreja} ${60 + lado * 20} 50)`}>
          <Ellipse cx={60 + lado * 20} cy="26" rx="16.5" ry="24.5" fill={OREJA_BORDE} />
          <Ellipse cx={60 + lado * 20} cy="28.5" rx="10.5" ry="18" fill={`url(#${id("oreja")})`} />
          <Ellipse cx={60 + lado * 20 - 3.5} cy="21" rx="2.8" ry="6.5" fill="#FFFFFF" opacity="0.18" />
        </G>
      ))}

      {/* cabeza esponjosa: óvalo + mechones, con un solo degradado continuo */}
      <G fill={`url(#${id("pelo")})`}>
        <Ellipse cx="60" cy="69" rx="38" ry="32" />
        {MECHONES.map(([x, y, r], i) => (
          <Circle key={i} cx={x} cy={y} r={r} />
        ))}
      </G>
      {/* hebras sueltas en las mejillas: la textura de terciopelo en tamaños grandes */}
      <G stroke={PELO_CLARO} strokeWidth="1.6" strokeLinecap="round" opacity="0.45">
        <Path d="M12 73 L7 70.5" />
        <Path d="M10.5 80 L5 80" />
        <Path d="M14 87 L9.5 90" />
        <Path d="M108 73 L113 70.5" />
        <Path d="M109.5 80 L115 80" />
        <Path d="M106 87 L110.5 90" />
      </G>
      {/* luz desde arriba sobre la frente */}
      <Path d="M36 52 Q60 34 84 52 Q60 44 36 52 Z" fill="#FFFFFF" opacity="0.10" />

      {/* mechón rojo, su sello */}
      <G transform={`rotate(${noSabe ? 20 : 0} 60 40)`}>
        <Path
          d="M50 43 C46 34 50 25 58 21 C55 28 58 31 61 33 C61 25 67 19 76 19 C70 23 69 28 71 32 C72 37 70 41 68 43 Z"
          fill={`url(#${id("mechon")})`}
        />
        <Path d="M56 38 C55 32 57 27 59 24" stroke="#FF8A9B" strokeWidth="1.4" fill="none"
              strokeLinecap="round" opacity="0.7" />
      </G>

      {/* hocico y mejillas */}
      <Ellipse cx="60" cy="79" rx="17" ry="13" fill={`url(#${id("hocico")})`} />
      <Ellipse cx="38" cy="81" rx="6" ry="3.5" fill={ROJO} opacity="0.22" />
      <Ellipse cx="82" cy="81" rx="6" ry="3.5" fill={ROJO} opacity="0.22" />

      {/* ojos */}
      {noSabe ? (
        <G stroke={OJO} strokeWidth="2.6" strokeLinecap="round" fill="none">
          <Path d="M41 67 Q47 71.5 53 67" />
          <Path d="M67 67 Q73 71.5 79 67" />
        </G>
      ) : (
        <G>
          {[47, 73].map((x) => (
            <G key={x}>
              <Ellipse cx={x + dx} cy={66 + dy} rx="6.6" ry="7.6" fill={OJO} />
              <Circle cx={x + dx + 2.2} cy={66 + dy - 2.6} r="2.3" fill="#FFFFFF" />
              <Circle cx={x + dx - 1.8} cy={66 + dy + 2.4} r="1" fill="#FFFFFF" opacity="0.8" />
              {/* párpado a medio cerrar: la mirada de "ya revisé tus números" */}
              {!consulta && (
                <Path d={`M${x - 8.5} 61 Q${x} 57 ${x + 8.5} 61 L${x + 8.5} 63.6 Q${x} 60.2 ${x - 8.5} 63.6 Z`}
                      fill={PELO} />
              )}
            </G>
          ))}
        </G>
      )}

      {/* lentes redondos */}
      <G stroke={LENTE} strokeWidth="2.3" fill="none" strokeLinecap="round">
        <Circle cx="47" cy="66" r="10.5" fill="#FFFFFF" fillOpacity="0.06" />
        <Circle cx="73" cy="66" r="10.5" fill="#FFFFFF" fillOpacity="0.06" />
        <Path d="M57.3 64.5 Q60 62 62.7 64.5" />
        <Path d="M36.6 63.5 L28 60.5" />
        <Path d="M83.4 63.5 L92 60.5" />
      </G>
      {consulta && (
        <G stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round">
          <Path d="M42 60 L46 57" />
          <Path d="M68 60 L72 57" />
        </G>
      )}

      {/* nariz y boca */}
      <Path d="M56 76 Q60 74.2 64 76 Q62 80.4 60 80.4 Q58 80.4 56 76 Z" fill={ROJO} />
      {noSabe ? (
        <Path d="M56 85 L64 85" stroke={TINTA} strokeWidth="1.8" strokeLinecap="round" />
      ) : consulta ? (
        <Path d="M57 84 Q60 85.6 63.5 83.2" stroke={TINTA} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      ) : (
        <Path d="M54.5 83 Q57.3 86 60 83.2 Q62.7 86 65.5 83" stroke={TINTA} strokeWidth="1.8" fill="none"
              strokeLinecap="round" />
      )}

      {/* bigotes */}
      <G stroke="#D3D5DB" strokeWidth="1.1" strokeLinecap="round" opacity="0.75">
        <Path d="M49 80 L24 75" />
        <Path d="M49 82.5 L23 82.5" />
        <Path d="M49 85 L26 90" />
        <Path d="M71 80 L96 75" />
        <Path d="M71 82.5 L97 82.5" />
        <Path d="M71 85 L94 90" />
      </G>
    </Svg>
  );
}
