/**
 * Las dos cifras que el panel no sabía responder (RF-23, RF-25).
 *
 *   · Tu mes: de lo que entra, cuánto queda después de los gastos fijos y las
 *     cuotas. Es estructural y no cambia de un día para otro.
 *   · Hasta el día de pago: del saldo de hoy, con qué se llega al próximo
 *     sueldo descontando los cargos que vienen y el gasto variable esperado.
 *
 * Las dos se muestran desglosadas a propósito. Una cifra sola invita a creerle
 * o a desconfiar, y no hay forma de saber cuál de las dos corresponde; con el
 * desglose la persona puede seguir la cuenta y encontrar el error si lo hay.
 *
 * Se recalcula cuando cambian los movimientos: sincronizar o corregir algo
 * mueve estas cifras, y mostrarlas viejas sería peor que no mostrarlas.
 */
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Ficha } from "@/components/Ficha";
import { Nota, Seccion } from "@/components/Pantalla";
import { colores, espacio, fuente } from "@/constants/tema";
import { obtenerFlujo, type RespuestaFlujo } from "@/servicios/flujo";
import { fechaCorta, pesos } from "@/utils/formato";

/** Los montos que se restan se muestran con su signo: la cuenta se sigue sola. */
const menos = (monto: number) => `−${pesos(monto)}`;

export function PanelFlujo({ recalcularCon }: { recalcularCon: unknown }) {
  const [datos, setDatos] = useState<RespuestaFlujo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verCargos, setVerCargos] = useState(false);

  useEffect(() => {
    let vivo = true;
    obtenerFlujo()
      .then((r) => vivo && setDatos(r))
      .catch((e) => vivo && setError(e instanceof Error ? e.message : "No se pudo calcular."));
    return () => {
      vivo = false;
    };
  }, [recalcularCon]);

  // Mientras no haya datos no se ocupa espacio: el panel ya tiene qué mostrar.
  if (error) return <Nota>{error}</Nota>;
  if (!datos) return null;

  const { excedente: e, flujo: f } = datos;

  return (
    <>
      <Seccion titulo="Tu mes" />
      {e.ingresoConocido ? (
        <Ficha
          encabezado={
            <View style={estilos.encabezado}>
              <Text style={[estilos.cifra, e.excedente < 0 && estilos.negativa]}>
                {pesos(e.excedente)}
              </Text>
              <Text style={estilos.pie}>te queda después de lo que ya está comprometido</Text>
            </View>
          }
          filas={[
            { etiqueta: "Sueldo", valor: pesos(e.ingreso) },
            { etiqueta: "Gastos fijos", valor: menos(e.gastosFijos) },
            { etiqueta: "Cuotas", valor: menos(e.cuotas) },
          ]}
        />
      ) : (
        <Nota>
          Para calcular cuánto te queda cada mes necesitamos saber tu sueldo. Puedes configurarlo
          en Cuentas.
        </Nota>
      )}

      <Seccion titulo="Hasta el día de pago" />
      {f === null ? (
        <Nota>
          Todavía no reconocemos tu sueldo entre los abonos, así que no sabemos cuándo es tu día de
          pago. Sin esa fecha no proyectamos: preferimos no responder a responder mal.
        </Nota>
      ) : (
        <>
          <Ficha
            encabezado={
              <View style={estilos.encabezado}>
                <Text style={[estilos.cifra, f.proyectado < 0 && estilos.negativa]}>
                  {pesos(f.proyectado)}
                </Text>
                <Text style={estilos.pie}>
                  {f.proyectado < 0
                    ? `te faltarían para llegar al ${fechaCorta(f.proximoPago)}`
                    : `llegarías con eso al ${fechaCorta(f.proximoPago)}`}
                  {` · faltan ${f.dias} ${f.dias === 1 ? "día" : "días"}`}
                </Text>
              </View>
            }
            filas={[
              { etiqueta: "Saldo hoy", valor: pesos(f.saldo) },
              { etiqueta: "Cargos que vienen", valor: menos(f.comprometido) },
              { etiqueta: "Gasto estimado", valor: menos(f.gastoEstimado) },
              { etiqueta: "Libre hoy", valor: pesos(f.holgura), destacar: f.holgura < 0 },
            ]}
          />

          {f.proximosCargos.length > 0 ? (
            <Pressable onPress={() => setVerCargos((v) => !v)} hitSlop={8}>
              <Text style={estilos.enlace}>
                {verCargos
                  ? "Ocultar los cargos"
                  : `Ver los ${f.proximosCargos.length} cargos que vienen`}
              </Text>
            </Pressable>
          ) : null}

          {verCargos ? (
            <View style={estilos.cargos}>
              {f.proximosCargos.map((c) => (
                <View key={`${c.nombre}-${c.fecha}`} style={estilos.cargo}>
                  <Text style={estilos.cargoNombre} numberOfLines={1}>
                    {c.nombre}
                  </Text>
                  <Text style={estilos.cargoFecha}>{fechaCorta(c.fecha)}</Text>
                  <Text style={estilos.cargoMonto}>{menos(c.monto)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Nota>
            {f.mesesObservados > 0
              ? `El gasto estimado sale de la mediana de tus últimos ${f.mesesObservados} meses, sin contar lo que ya está en "cargos que vienen". Es una estimación, no una promesa.`
              : "Todavía no hay meses completos para estimar tu gasto, así que solo descontamos los cargos que ya conocemos."}
          </Nota>
        </>
      )}
    </>
  );
}

const estilos = StyleSheet.create({
  encabezado: { gap: espacio.xs, paddingBottom: espacio.m },
  cifra: { color: colores.texto, fontFamily: fuente.tituloMedio, fontSize: 30 },
  negativa: { color: colores.acento },
  pie: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 14, lineHeight: 19 },
  enlace: {
    color: colores.acento,
    fontFamily: fuente.textoFuerte,
    fontSize: 14,
    marginTop: espacio.m,
  },
  cargos: { marginTop: espacio.m, gap: espacio.s },
  cargo: { flexDirection: "row", alignItems: "center", gap: espacio.m },
  cargoNombre: { flex: 1, color: colores.texto, fontFamily: fuente.texto, fontSize: 14 },
  cargoFecha: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 13 },
  cargoMonto: {
    color: colores.texto2,
    fontFamily: fuente.textoFuerte,
    fontSize: 14,
    minWidth: 86,
    textAlign: "right",
  },
});
