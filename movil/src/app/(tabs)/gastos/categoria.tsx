/**
 * Desglose de una categoría — "en qué se fue, dentro de esto".
 *
 * El panel llega hasta la categoría: "Supermercado, $386.053". Esta pantalla es
 * el nivel que faltaba, y baja dos: primero en qué comercios se fue, y al tocar
 * un comercio, qué compras exactas lo forman.
 *
 * El período llega por parámetro y no se vuelve a elegir aquí: se abre desde el
 * mes o desde los seis meses que el usuario estaba mirando, y tiene que seguir
 * hablando del mismo período, o las cifras no van a cuadrar con las de atrás.
 *
 * El nombre de la categoría viaja como parámetro de consulta y no como segmento
 * de la ruta: "Educación" y "Sin categorizar" traen tildes y espacios, y en la
 * ruta habría que codificarlos y decodificarlos a mano en cada salto.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AvatarComercio } from "@/components/AvatarComercio";
import { BarraAvance } from "@/components/BarraAvance";
import { Cifra } from "@/components/Cifra";
import { FilaMovimiento } from "@/components/FilaMovimiento";
import { Tocable } from "@/components/Movimiento";
import { Nota, Pantalla, Seccion } from "@/components/Pantalla";
import { colores, espacio, fuente, movimiento as tiempos, radio } from "@/constants/tema";
import { useMovimientos } from "@/datos/MovimientosContexto";
import { retraso } from "@/utils/animacion";
import { desglosar, type GrupoDeGasto } from "@/utils/desglose";
import { fechaCorta, nombreMes, pesos } from "@/utils/formato";

/**
 * Una fila del desglose: comercio o categoría, con cuánto pesa dentro del total.
 *
 * La barrita no es decoración: con montos de seis cifras en pesos, la
 * proporción entre dos filas no se lee de un vistazo, y es justamente la
 * pregunta ("¿esto es la mitad o un décimo?").
 */
function FilaGrupo({
  grupo,
  abierto,
  onPress,
  comoCategoria,
  demora,
}: {
  grupo: GrupoDeGasto;
  abierto: boolean;
  onPress: () => void;
  /** El grupo es una categoría (dentro de "Otros"), no un comercio. */
  comoCategoria: boolean;
  /** Retraso de entrada, para que las filas crezcan una tras otra. */
  demora: number;
}) {
  return (
    <Tocable onPress={onPress} style={estilos.grupo}>
      <View style={estilos.grupoFila}>
        {comoCategoria ? (
          <View style={estilos.cuadroCategoria}>
            <Ionicons name="pricetag-outline" size={17} color={colores.texto2} />
          </View>
        ) : (
          <AvatarComercio nombre={grupo.nombre} sinIdentificar={grupo.sinIdentificar} tamano={36} />
        )}

        <View style={estilos.grupoIdentidad}>
          <Text
            style={[estilos.grupoNombre, grupo.sinIdentificar && estilos.grupoNombreMono]}
            numberOfLines={1}
          >
            {grupo.nombre}
          </Text>
          <Text style={estilos.grupoPie}>
            {grupo.cantidad} {grupo.cantidad === 1 ? "movimiento" : "movimientos"} ·{" "}
            {Math.round(grupo.fraccion * 100)}%
          </Text>
        </View>

        <Text style={estilos.grupoMonto}>{pesos(grupo.total)}</Text>
        <Ionicons
          name={comoCategoria ? "chevron-forward" : abierto ? "chevron-up" : "chevron-down"}
          size={16}
          color={colores.texto3}
        />
      </View>

      {/* La proporción entre dos filas no se lee de un vistazo con montos de
          seis cifras, y es justo la pregunta: ¿esto es la mitad o un décimo? */}
      <BarraAvance fraccion={grupo.fraccion} alto={4} demora={demora} />
    </Tocable>
  );
}

export default function Categoria() {
  const router = useRouter();
  const { movimientos } = useMovimientos();
  const { nombre, mes, meses } = useLocalSearchParams<{
    nombre?: string;
    mes?: string;
    meses?: string;
  }>();
  // Qué comercio está desplegado. Uno a la vez: abrir el siguiente cierra el
  // anterior, para que la pantalla no crezca sin control.
  const [abierto, setAbierto] = useState<string | null>(null);

  const categoria = nombre ?? "Sin categorizar";
  const periodo = meses ? new Set(meses.split(",")) : (mes ?? "");
  const cuantosMeses = meses ? meses.split(",").length : 1;
  // En castellano los meses van en minúscula dentro de una frase; `nombreMes`
  // los devuelve capitalizados porque también se usa como título.
  const textoPeriodo = meses
    ? `en los últimos ${cuantosMeses} meses`
    : `en ${nombreMes(mes ?? "").toLowerCase()}`;

  const d = desglosar(movimientos, categoria, periodo);

  if (d.cantidad === 0) {
    return (
      <Pantalla titulo={categoria} onAtras={() => router.back()}>
        <Nota>No hay movimientos de esta categoría en el período.</Nota>
      </Pantalla>
    );
  }

  const porCategoria = d.agrupadoPor === "categoria";
  const haySinIdentificar = d.grupos.some((g) => g.sinIdentificar);

  /** Dentro de "Otros" cada grupo es una categoría: se abre su propio desglose. */
  function tocarGrupo(g: GrupoDeGasto) {
    if (!porCategoria) {
      setAbierto(abierto === g.nombre ? null : g.nombre);
      return;
    }
    router.push({
      pathname: "/gastos/categoria",
      params: meses ? { nombre: g.nombre, meses } : { nombre: g.nombre, mes: mes ?? "" },
    });
  }

  return (
    <Pantalla
      titulo={categoria}
      onAtras={() => router.back()}
      etiqueta={meses ? `${cuantosMeses} meses` : nombreMes(mes ?? "")}
    >
      <View style={estilos.resumen}>
        <Cifra valor={d.total} style={estilos.resumenMonto} />
        <Text style={estilos.resumenPie}>
          {Math.round(d.fraccionDelGasto * 100)}% de tu gasto {textoPeriodo} ·{" "}
          {d.cantidad} {d.cantidad === 1 ? "movimiento" : "movimientos"}
        </Text>
      </View>

      {/* Con un solo movimiento no hay nada que destacar: el desglose de abajo
          ya es ese mismo cargo, y repetirlo solo ocupa pantalla. */}
      {d.mayor && d.cantidad > 1 ? (
        <>
          <Seccion titulo="El cargo más grande" />
          <Tocable onPress={() => router.push(`/gastos/${d.mayor!.id}`)} style={estilos.mayor}>
            <AvatarComercio
              nombre={d.mayor.comercio ?? d.mayor.glosaOriginal}
              sinIdentificar={!d.mayor.comercio}
              tamano={40}
            />
            <View style={estilos.grupoIdentidad}>
              {/* Sin comercio reconocido se muestra la glosa en crudo, en
                  monoespaciada, igual que en la lista de Gastos. */}
              <Text
                style={[estilos.mayorNombre, !d.mayor.comercio && estilos.mayorNombreMono]}
                numberOfLines={1}
              >
                {d.mayor.comercio ?? d.mayor.glosaOriginal}
              </Text>
              <Text style={estilos.grupoPie}>
                {fechaCorta(d.mayor.fecha)} · {Math.round((Math.abs(d.mayor.monto) / d.total) * 100)}% de
                la categoría
              </Text>
            </View>
            <Text style={estilos.mayorMonto}>{pesos(Math.abs(d.mayor.monto))}</Text>
          </Tocable>
        </>
      ) : null}

      <Seccion titulo={porCategoria ? "Qué categorías lo componen" : "En qué comercios"} />
      {porCategoria ? (
        <Text style={estilos.ayuda}>
          «Otros» no es una categoría: es el resto que el gráfico agrupa para no mostrar quince
          porciones. Esto es lo que hay dentro.
        </Text>
      ) : null}

      {d.grupos.map((g, i) => (
        <View key={g.nombre}>
          <FilaGrupo
            grupo={g}
            abierto={abierto === g.nombre}
            comoCategoria={porCategoria}
            demora={retraso(i, tiempos.escalon)}
            onPress={() => tocarGrupo(g)}
          />
          {abierto === g.nombre ? (
            <View style={estilos.movimientos}>
              {g.movimientos.map((m) => (
                <FilaMovimiento
                  key={m.id}
                  movimiento={m}
                  onPress={() => router.push(`/gastos/${m.id}`)}
                />
              ))}
            </View>
          ) : null}
        </View>
      ))}

      {haySinIdentificar ? (
        <Nota>
          Las filas en tipografía de máquina son glosas tal como las manda el banco: ahí no hay un
          comercio reconocido todavía. Se muestran en crudo a propósito, para que se vea qué dato
          está sin resolver en vez de aparentar que está limpio.
        </Nota>
      ) : null}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  resumen: {
    backgroundColor: colores.tarjeta,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colores.borde,
    borderTopColor: colores.bordeAlto,
    borderRadius: radio.l,
    padding: espacio.l,
    gap: 2,
  },
  resumenMonto: { color: colores.texto, fontFamily: fuente.titulo, fontSize: 34, letterSpacing: -0.8 },
  resumenPie: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 13, lineHeight: 19 },

  ayuda: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 13, lineHeight: 19, marginBottom: espacio.s },

  mayor: {
    flexDirection: "row",
    alignItems: "center",
    gap: espacio.m,
    backgroundColor: colores.acentoSuave,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colores.acentoBorde,
    borderRadius: radio.m,
    padding: espacio.m,
  },
  mayorNombre: { color: colores.texto, fontFamily: fuente.textoFuerte, fontSize: 15.5 },
  mayorNombreMono: { fontFamily: fuente.mono, fontSize: 13.5 },
  mayorMonto: { color: colores.texto, fontFamily: fuente.titulo, fontSize: 18, letterSpacing: -0.3 },

  grupo: {
    backgroundColor: colores.tarjeta,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colores.borde,
    borderTopColor: colores.bordeAlto,
    borderRadius: radio.m,
    padding: espacio.m,
    marginBottom: espacio.s,
    gap: espacio.m,
  },
  grupoFila: { flexDirection: "row", alignItems: "center", gap: espacio.m },
  cuadroCategoria: {
    width: 36,
    height: 36,
    borderRadius: radio.m,
    backgroundColor: colores.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  grupoIdentidad: { flex: 1, gap: 1 },
  grupoNombre: { color: colores.texto, fontFamily: fuente.textoFuerte, fontSize: 15 },
  grupoNombreMono: { fontFamily: fuente.mono, fontSize: 13 },
  grupoPie: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 12.5 },
  grupoMonto: { color: colores.texto, fontFamily: fuente.tituloMedio, fontSize: 15.5 },

  movimientos: { paddingHorizontal: espacio.m, marginBottom: espacio.m },
});
