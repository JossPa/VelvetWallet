/**
 * Una cifra que cuenta desde cero hasta su valor.
 *
 * Es el gesto que más dice en una app de plata: la cifra no estaba ahí
 * esperando, se acaba de calcular con tus datos. Lo hacen Copilot, Revolut y
 * casi toda la categoría, y es barato.
 *
 * Tres decisiones que vale la pena poder defender:
 *
 *  · **No usa Reanimated.** Reanimated anima en el hilo de interfaz, que es lo
 *    correcto para mover cosas, pero el texto de un número tiene que pasar por
 *    JavaScript de todas formas para volver a formatearse. Un reloj de cuadros
 *    normal hace lo mismo con menos piezas y se comporta igual en web que en
 *    el teléfono. El componente es una hoja: al re-dibujarse cada cuadro,
 *    arrastra solo su propio texto y no la pantalla entera.
 *
 *  · **Aterriza en el valor exacto.** El último cuadro no interpola: asigna.
 *    Una cifra financiera que queda a un peso del total por error de punto
 *    flotante no es un detalle estético.
 *
 *  · **Respeta a quien apagó las animaciones.** Si el sistema tiene activado
 *    "reducir movimiento", la cifra aparece puesta. No es un adorno de
 *    accesibilidad: para alguien con sensibilidad vestibular, números que
 *    saltan son un problema real.
 */
import { useEffect, useRef, useState } from "react";
import { Text, type TextProps, type TextStyle } from "react-native";

import { useMovimientoReducido } from "@/components/Movimiento";
import { movimiento as tiempos } from "@/constants/tema";
import { avance, interpolar, salidaSuave } from "@/utils/animacion";
import { pesos } from "@/utils/formato";

/**
 * Números de ancho fijo.
 *
 * Sin esto, cada dígito mide distinto y la cifra tiembla mientras cuenta —y
 * los montos de una columna no quedan alineados. Es el detalle que separa una
 * tabla de cifras bien hecha de una que baila.
 */
export const numerosTabulares: TextStyle = { fontVariant: ["tabular-nums"] };

type Props = TextProps & {
  valor: number;
  /** Cómo se escribe el número. Por defecto, pesos chilenos. */
  formato?: (n: number) => string;
  /** Milisegundos del recorrido. 0 lo deja quieto. */
  duracion?: number;
  /** Espera antes de arrancar, para entradas escalonadas. */
  demora?: number;
};

export function Cifra({
  valor,
  formato = pesos,
  duracion = tiempos.lento,
  demora = 0,
  style,
  ...resto
}: Props) {
  const reducido = useMovimientoReducido();
  // Desde dónde cuenta. En el primer montaje, desde cero; después, desde lo
  // que se estaba mostrando, para que cambiar de mes se lea como un
  // movimiento y no como un corte.
  const desde = useRef(0);
  const [mostrado, setMostrado] = useState(reducido ? valor : 0);

  useEffect(() => {
    const partida = desde.current;
    const total = reducido ? 0 : duracion;

    if (total <= 0) {
      desde.current = valor;
      setMostrado(valor);
      return;
    }

    let cuadro = 0;
    let inicio = 0;

    const paso = (ahora: number) => {
      if (inicio === 0) inicio = ahora + demora;
      const t = salidaSuave(avance(ahora, inicio, total));
      if (t >= 1) {
        desde.current = valor;
        setMostrado(valor);   // el último cuadro asigna, no interpola
        return;
      }
      setMostrado(interpolar(partida, valor, t));
      cuadro = requestAnimationFrame(paso);
    };

    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [valor, duracion, demora, reducido]);

  return (
    <Text
      style={[numerosTabulares, style]}
      // Para un lector de pantalla la cifra es el valor final, no el conteo.
      accessibilityLabel={formato(valor)}
      {...resto}
    >
      {formato(mostrado)}
    </Text>
  );
}
