/**
 * Inicio — responde la primera pregunta del producto:
 * "¿Cuánto tengo disponible este mes?"
 *
 * Todo lo que se muestra se calcula en utils/resumen.ts. El bloque de saldo
 * proyectado queda reservado hasta que exista el motor de proyección; se
 * prefiere un espacio honesto a una fórmula simple que después habría que botar.
 */
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Aviso } from "@/components/Aviso";
import { Pantalla } from "@/components/Pantalla";
import { colores, espacio, fuente, radio } from "@/constants/tema";
import { CONEXIONES } from "@/datos/conexiones";
import { MOVIMIENTOS } from "@/datos/movimientos";
import type { Conexion } from "@/modelo/tipos";
import { claveMes, fechaCorta, nombreMes, pesos, tiempoRelativo } from "@/utils/formato";
import { conexionesConProblema, resumenDelMes } from "@/utils/resumen";

/** Texto del aviso según el tipo de problema de la conexión. */
function describirProblema(c: Conexion): { titulo: string; detalle: string } {
  if (c.estado === "autorizacion_vencida") {
    return {
      titulo: `${c.institucion} necesita reautorización.`,
      detalle: c.autorizacionVencioEl ? `Vencida el ${fechaCorta(c.autorizacionVencioEl)}.` : "",
    };
  }
  return {
    titulo: `Falta ${c.institucion} por actualizar.`,
    detalle: `Último dato: ${tiempoRelativo(c.ultimaSincronizacion)}.`,
  };
}

export default function Inicio() {
  const router = useRouter();

  const mes = claveMes(MOVIMIENTOS[0].fecha);
  const resumen = resumenDelMes(MOVIMIENTOS, mes);
  const conProblema = conexionesConProblema(CONEXIONES);

  const aviso = conProblema.length > 0 ? describirProblema(conProblema[0]) : null;
  const otros = conProblema.length - 1;

  return (
    <Pantalla titulo="Velvet Wallet" marca etiqueta={nombreMes(mes)}>
      <Text style={estilos.rotulo}>DISPONIBLE ESTE MES</Text>
      <Text style={[estilos.disponible, resumen.disponible < 0 && estilos.negativo]}>
        {pesos(resumen.disponible)}
      </Text>

      {aviso ? (
        <Aviso
          detalle={otros > 0 ? `${aviso.detalle} Y ${otros} más.` : aviso.detalle}
          onPress={() => router.push("/cuentas")}
        >
          {aviso.titulo}
        </Aviso>
      ) : null}

      <View style={estilos.par}>
        <View style={estilos.tarjeta}>
          <Text style={estilos.rotuloTarjeta}>INGRESOS</Text>
          <Text style={estilos.cifra}>{pesos(resumen.ingresos)}</Text>
        </View>
        <View style={estilos.tarjeta}>
          <Text style={estilos.rotuloTarjeta}>GASTOS</Text>
          <Text style={estilos.cifra}>{pesos(resumen.gastos)}</Text>
          <Text style={estilos.pieTarjeta}>{resumen.cantidadGastos} movimientos</Text>
        </View>
      </View>

      <View style={estilos.proyeccion}>
        <Text style={estilos.rotuloTarjeta}>
          SALDO PROYECTADO HASTA EL DÍA DE PAGO
          {resumen.diaDePago ? ` · ${resumen.diaDePago} DE ${nombreMes(mes).toUpperCase()}` : ""}
        </Text>
        <View style={estilos.reservado}>
          <Text style={estilos.reservadoTexto}>
            Aquí va la proyección de tu saldo día a día hasta el próximo sueldo, con la probabilidad de
            llegar con holgura. Se activa con el motor de proyección.
          </Text>
        </View>
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  rotulo: {
    color: colores.texto3,
    fontFamily: fuente.tituloMedio,
    fontSize: 12,
    letterSpacing: 1.4,
    marginTop: espacio.s,
  },
  disponible: {
    color: colores.texto,
    fontFamily: fuente.titulo,
    fontSize: 52,
    letterSpacing: -1.5,
    marginTop: espacio.xs,
    marginBottom: espacio.s,
  },
  negativo: { color: colores.acento },
  par: { flexDirection: "row", gap: espacio.m, marginTop: espacio.l },
  tarjeta: {
    flex: 1,
    backgroundColor: colores.tarjeta,
    borderRadius: radio.l,
    padding: espacio.l,
    gap: espacio.s,
  },
  rotuloTarjeta: { color: colores.texto3, fontFamily: fuente.tituloMedio, fontSize: 12, letterSpacing: 1.2 },
  cifra: { color: colores.texto, fontFamily: fuente.titulo, fontSize: 24, letterSpacing: -0.5, marginTop: espacio.s },
  pieTarjeta: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 12 },
  proyeccion: {
    backgroundColor: colores.tarjeta,
    borderRadius: radio.l,
    padding: espacio.l,
    marginTop: espacio.m,
    gap: espacio.m,
  },
  reservado: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colores.linea,
    borderRadius: radio.m,
    padding: espacio.l,
    minHeight: 120,
    justifyContent: "center",
  },
  reservadoTexto: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 13, lineHeight: 19, textAlign: "center" },
});
