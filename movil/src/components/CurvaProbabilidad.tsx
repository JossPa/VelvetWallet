/**
 * Curva de probabilidad de alcanzar una meta, mes a mes.
 *
 * Es la forma de la respuesta del motor Monte Carlo. Una sola cifra —"te
 * faltan 8 meses"— escondería lo que de verdad pasa: que a los 6 meses hay
 * una posibilidad razonable, a los 8 es probable y a los 11 es casi seguro.
 * La pendiente de la curva **es** la incertidumbre: mientras más tendida, más
 * variable es el excedente de esa persona.
 *
 * Se dibuja a mano con SVG, sin librería de gráficos: son dos trazados y el
 * control total del resultado vale más que la dependencia.
 */
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";

import { colores, espacio, fuente, radio } from "@/constants/tema";

const ALTO = 150;
const MARGEN = { arriba: 10, abajo: 22, izquierda: 30, derecha: 10 };

type Props = {
  /** curva[i] = probabilidad de haberla alcanzado en el mes i+1. */
  curva: number[];
  /** Mes que la app informa como respuesta. Se marca en el gráfico. */
  mesDestacado: number | null;
};

export function CurvaProbabilidad({ curva, mesDestacado }: Props) {
  const [ancho, setAncho] = useState(0);

  // Se recorta el horizonte poco después de que la curva se aplana: veinte
  // meses de línea plana al 100% no dicen nada y achican la parte que importa.
  const util = recorte(curva, mesDestacado);
  const largo = util.length;

  if (largo < 2) return null;

  const areaAncho = Math.max(ancho - MARGEN.izquierda - MARGEN.derecha, 1);
  const areaAlto = ALTO - MARGEN.arriba - MARGEN.abajo;

  const x = (mes: number) => MARGEN.izquierda + ((mes - 1) / (largo - 1)) * areaAncho;
  const y = (p: number) => MARGEN.arriba + (1 - p) * areaAlto;

  const puntos = util.map((p, i) => `${x(i + 1)},${y(p)}`);
  const linea = `M ${puntos.join(" L ")}`;
  const area = `${linea} L ${x(largo)},${y(0)} L ${x(1)},${y(0)} Z`;

  return (
    <View style={estilos.tarjeta} onLayout={(e) => setAncho(e.nativeEvent.layout.width - espacio.l * 2)}>
      {ancho > 0 ? (
        <Svg width={ancho} height={ALTO}>
          <Defs>
            <LinearGradient id="bajoLaCurva" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colores.acento} stopOpacity={0.35} />
              <Stop offset="1" stopColor={colores.acento} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>

          {/* Referencias horizontales. El 80% va marcado porque es el plazo
              que la app informa: ni tan optimista como la mediana ni tan
              conservador como el 95%. */}
          {[0.5, 0.8, 1].map((p) => (
            <Line
              key={p}
              x1={MARGEN.izquierda}
              y1={y(p)}
              x2={ancho - MARGEN.derecha}
              y2={y(p)}
              stroke={p === 0.8 ? colores.texto3 : colores.linea}
              strokeWidth={1}
              strokeDasharray={p === 0.8 ? "4 4" : undefined}
            />
          ))}
          {[0.5, 0.8, 1].map((p) => (
            <SvgText
              key={`r${p}`}
              x={MARGEN.izquierda - 6}
              y={y(p) + 4}
              fill={colores.texto3}
              fontSize={10}
              textAnchor="end"
            >
              {`${Math.round(p * 100)}%`}
            </SvgText>
          ))}

          <Path d={area} fill="url(#bajoLaCurva)" />
          <Path d={linea} stroke={colores.acento} strokeWidth={2.5} fill="none" />

          {/* El mes que se informa, marcado sobre la curva. */}
          {mesDestacado && mesDestacado <= largo ? (
            <>
              <Line
                x1={x(mesDestacado)}
                y1={y(util[mesDestacado - 1])}
                x2={x(mesDestacado)}
                y2={y(0)}
                stroke={colores.acento}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <Circle
                cx={x(mesDestacado)}
                cy={y(util[mesDestacado - 1])}
                r={4.5}
                fill={colores.acento}
                stroke={colores.fondo}
                strokeWidth={2}
              />
            </>
          ) : null}

          {/* Eje de meses: solo algunas marcas, para que se lea en un teléfono. */}
          {marcas(largo).map((mes) => (
            <SvgText
              key={mes}
              x={x(mes)}
              y={ALTO - 6}
              fill={colores.texto3}
              fontSize={10}
              textAnchor="middle"
            >
              {mes}
            </SvgText>
          ))}
        </Svg>
      ) : (
        <View style={{ height: ALTO }} />
      )}

      <Text style={estilos.pie}>Meses desde hoy</Text>
    </View>
  );
}

/**
 * Hasta dónde dibujar. Se corta dos meses después de llegar al 99%, o del mes
 * destacado si queda más allá, para que la zona donde la curva sube ocupe el
 * gráfico completo.
 */
function recorte(curva: number[], mesDestacado: number | null): number[] {
  const casiSeguro = curva.findIndex((p) => p >= 0.99);
  const hasta = casiSeguro === -1 ? curva.length : casiSeguro + 2;
  return curva.slice(0, Math.max(hasta, mesDestacado ? mesDestacado + 1 : 0, 4));
}

/** Marcas del eje: entre cuatro y seis, siempre incluyendo el último mes. */
function marcas(largo: number): number[] {
  const paso = Math.max(1, Math.ceil(largo / 5));
  const salida: number[] = [];
  for (let m = 1; m <= largo; m += paso) salida.push(m);
  if (salida[salida.length - 1] !== largo) salida.push(largo);
  return salida;
}

const estilos = StyleSheet.create({
  tarjeta: {
    backgroundColor: colores.tarjeta,
    borderRadius: radio.l,
    padding: espacio.l,
    marginTop: espacio.m,
  },
  pie: {
    color: colores.texto3,
    fontFamily: fuente.texto,
    fontSize: 12,
    textAlign: "center",
    marginTop: espacio.xs,
  },
});
