/**
 * Una cuenta — su saldo y solo sus movimientos, mes a mes.
 *
 * Inicio y Gastos mezclan todas las cuentas de todos los bancos, que es lo que
 * sirve para saber cuánto se gastó. Pero para revisar la cuenta corriente o la
 * tarjeta hay que poder mirarla sola, con abonos y cargos, como en la cartola
 * del banco.
 *
 * El movimiento se cruza con su cuenta por el id que le da el banco y por el
 * banco: dos instituciones distintas podrían usar el mismo id.
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Cifra } from "@/components/Cifra";
import { nombreCuenta } from "@/components/FilaConexion";
import { FilaMovimiento } from "@/components/FilaMovimiento";
import { Nota, Pantalla } from "@/components/Pantalla";
import { SelectorMes } from "@/components/SelectorMes";
import { Superficie } from "@/components/Superficie";
import { espacio, fuente } from "@/constants/tema";
import { crearEstilos } from "@/tema/TemaContexto";
import { useMovimientos } from "@/datos/MovimientosContexto";
import { claveMes, pesos, tiempoRelativo } from "@/utils/formato";

export default function DetalleCuenta() {
  const estilos = useEstilos();
  const router = useRouter();
  const { conexion: idConexion, cuenta: idCuenta } = useLocalSearchParams<{ conexion: string; cuenta: string }>();
  const { conexiones, movimientos } = useMovimientos();

  const conexion = conexiones.find((c) => c.id === idConexion);
  const cuenta = conexion?.cuentas.find((c) => c.id === idCuenta);

  const propios = useMemo(
    () =>
      cuenta && conexion
        ? movimientos.filter((m) => m.cuentaId === cuenta.idExterno && m.institucion === conexion.institucion)
        : [],
    [movimientos, cuenta, conexion],
  );

  const meses = useMemo(
    () => [...new Set(propios.map((m) => claveMes(m.fecha)))].sort().reverse(),
    [propios],
  );
  // Derivado, como en Gastos: si una sincronización se lleva el mes elegido,
  // cae al más reciente que exista en vez de quedar en blanco.
  const [mesElegido, setMesElegido] = useState<string | null>(null);
  const mes = mesElegido && meses.includes(mesElegido) ? mesElegido : meses[0];

  const delMes = useMemo(() => propios.filter((m) => claveMes(m.fecha) === mes), [propios, mes]);
  const entradas = delMes.filter((m) => m.monto > 0).reduce((s, m) => s + m.monto, 0);
  const salidas = delMes.filter((m) => m.monto < 0).reduce((s, m) => s + Math.abs(m.monto), 0);

  // La cuenta ya no existe (se desvinculó el banco, o se llegó por un enlace viejo).
  if (!conexion || !cuenta) {
    return (
      <Pantalla titulo="Cuenta" onAtras={() => router.back()}>
        <Nota>Esta cuenta ya no está en Velvet. Puede que hayas desvinculado su banco.</Nota>
      </Pantalla>
    );
  }

  const { titulo, detalle } = nombreCuenta(cuenta);

  return (
    <Pantalla
      titulo={titulo}
      onAtras={() => router.back()}
      accesorio={meses.length ? <SelectorMes meses={meses} valor={mes} onCambio={setMesElegido} /> : undefined}
    >
      <Superficie nivel={1} style={estilos.zona}>
        <Text style={estilos.rotulo}>{conexion.institucion.toUpperCase()}</Text>
        {detalle ? <Text style={estilos.producto}>{detalle}</Text> : null}
        {cuenta.saldo === null ? (
          <Text style={estilos.sinSaldo}>El banco no informó el saldo de esta cuenta.</Text>
        ) : (
          <Cifra valor={cuenta.saldo} style={[estilos.saldo, cuenta.saldo < 0 && estilos.negativo]} />
        )}
        <Text style={estilos.pie}>
          {conexion.ultimaSincronizacion
            ? `Saldo informado ${tiempoRelativo(conexion.ultimaSincronizacion)}`
            : "Aún sin sincronizar"}
        </Text>

        {mes ? (
          <View style={estilos.par}>
            <View style={estilos.columna}>
              <Text style={estilos.rotuloChico}>ENTRÓ</Text>
              <Text style={[estilos.cifraChica, estilos.positivo]}>{pesos(entradas)}</Text>
            </View>
            <View style={estilos.columna}>
              <Text style={estilos.rotuloChico}>SALIÓ</Text>
              <Text style={estilos.cifraChica}>{pesos(salidas)}</Text>
            </View>
          </View>
        ) : null}
      </Superficie>

      {propios.length === 0 ? (
        <Nota>Esta cuenta todavía no tiene movimientos en Velvet. Sincroniza para traer los últimos.</Nota>
      ) : (
        <View style={estilos.lista}>
          <Text style={estilos.resumen}>
            {delMes.length} {delMes.length === 1 ? "movimiento" : "movimientos"}
          </Text>
          {delMes.map((m) => (
            <FilaMovimiento key={m.id} movimiento={m} onPress={() => router.push(`/gastos/${m.id}`)} />
          ))}
        </View>
      )}
    </Pantalla>
  );
}

const useEstilos = crearEstilos((colores) => StyleSheet.create({
  zona: { padding: espacio.l },
  rotulo: { color: colores.texto3, fontFamily: fuente.tituloMedio, fontSize: 12, letterSpacing: 1.4 },
  producto: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 14, marginTop: 2 },
  saldo: { color: colores.texto, fontFamily: fuente.titulo, fontSize: 34, marginTop: espacio.s },
  negativo: { color: colores.alerta },
  sinSaldo: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 15, marginTop: espacio.s },
  pie: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 12, marginTop: espacio.xs },
  par: { flexDirection: "row", gap: espacio.l, marginTop: espacio.l },
  columna: { flex: 1, gap: 2 },
  rotuloChico: { color: colores.texto3, fontFamily: fuente.tituloMedio, fontSize: 11, letterSpacing: 1.2 },
  cifraChica: { color: colores.texto, fontFamily: fuente.tituloMedio, fontSize: 17 },
  positivo: { color: colores.ok },
  lista: { marginTop: espacio.l },
  resumen: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 13, paddingBottom: espacio.s },
}));
