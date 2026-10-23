/**
 * Deudas — los créditos del usuario, traídos por el estándar.
 *
 * Llegan por la API de Operaciones de Crédito del SFA, no se escriben a mano.
 * Esa es la diferencia con cualquier app de finanzas: el dato lo afirma la
 * institución, no la memoria de la persona.
 *
 * **Lo que esta pantalla no muestra, y por qué.** No hay CAE ni tabla de
 * amortización. El estándar no los entrega —de la tabla solo llega un enlace
 * al calendario del proveedor— y calcularlos exigiría conocer comisiones,
 * seguros y gastos que tampoco vienen. Un CAE estimado con datos incompletos
 * se ve igual de cierto que uno correcto, y alguien tomaría decisiones de
 * dinero con él. Se muestra lo que el banco afirma y se dice de dónde sale.
 */
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Nota, Pantalla, Seccion } from "@/components/Pantalla";
import { colores, espacio, fuente, radio } from "@/constants/tema";
import { pesos } from "@/utils/formato";
import { obtenerCreditos, type Credito } from "@/servicios/creditos";

/** "22 de 36" se entiende mejor que "faltan 22". */
function avance(c: Credito): { pagadas: number; total: number; fraccion: number } | null {
  if (!c.plazoMeses || c.cuotasRestantes === null) return null;
  const pagadas = c.plazoMeses - c.cuotasRestantes;
  return { pagadas, total: c.plazoMeses, fraccion: pagadas / c.plazoMeses };
}

function Tarjeta({ c }: { c: Credito }) {
  const a = avance(c);
  const terminado = (c.cuotasRestantes ?? 0) === 0;

  return (
    <View style={[estilos.tarjeta, terminado && estilos.apagada]}>
      <View style={estilos.cabecera}>
        <View style={estilos.identidad}>
          <Text style={estilos.producto} numberOfLines={1}>
            {c.producto}
          </Text>
          <Text style={estilos.institucion}>
            {c.institucion}
            {c.proposito ? ` · ${c.proposito}` : ""}
          </Text>
        </View>
        {c.enMora ? (
          <View style={estilos.mora}>
            <Ionicons name="alert-circle" size={13} color={colores.acento} />
            <Text style={estilos.moraTexto}>En mora</Text>
          </View>
        ) : null}
      </View>

      <View style={estilos.cifras}>
        <View style={estilos.cifra}>
          <Text style={estilos.cifraRotulo}>CUOTA MENSUAL</Text>
          <Text style={estilos.cifraValor}>
            {c.cuotaMensual !== null ? pesos(c.cuotaMensual) : "—"}
          </Text>
          {c.diaDePago ? <Text style={estilos.cifraPie}>cada día {c.diaDePago}</Text> : null}
        </View>
        <View style={estilos.cifra}>
          <Text style={estilos.cifraRotulo}>TE QUEDA POR PAGAR</Text>
          <Text style={estilos.cifraValor}>
            {c.saldoActual !== null ? pesos(c.saldoActual) : "—"}
          </Text>
          {c.tasaInteres !== null ? (
            <Text style={estilos.cifraPie}>
              {c.tasaInteres}% mensual{c.tipoTasa ? ` · ${c.tipoTasa.toLowerCase()}` : ""}
            </Text>
          ) : null}
        </View>
      </View>

      {a ? (
        <>
          <View style={estilos.pista}>
            <View style={[estilos.avance, { width: `${Math.round(a.fraccion * 100)}%` }]} />
          </View>
          <View style={estilos.piePista}>
            <Text style={estilos.cuotas}>
              {a.pagadas} de {a.total} cuotas
            </Text>
            <Text style={estilos.restantes}>
              {terminado ? "pagado" : `quedan ${c.cuotasRestantes}`}
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

export default function Deudas() {
  const [datos, setDatos] = useState<{
    creditos: Credito[];
    cuotaTotalMensual: number;
    saldoTotal: number;
    vigentes: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      obtenerCreditos().then(setDatos).catch((e) => setError(e.message));
    }, []),
  );

  if (error) {
    return (
      <Pantalla titulo="Deudas">
        <Nota>{error}</Nota>
      </Pantalla>
    );
  }

  if (!datos) {
    return (
      <Pantalla titulo="Deudas">
        <ActivityIndicator color={colores.acento} style={estilos.cargando} />
      </Pantalla>
    );
  }

  if (datos.creditos.length === 0) {
    return (
      <Pantalla titulo="Deudas">
        <View style={estilos.vacio}>
          <Ionicons name="card-outline" size={32} color={colores.texto3} />
          <Text style={estilos.vacioTexto}>
            No tienes créditos vigentes en las instituciones que vinculaste.
          </Text>
        </View>
        <Nota>
          Los créditos llegan solos desde tu banco, igual que tus movimientos. Si tienes uno y no
          aparece acá, puede que la institución todavía no exponga esa información.
        </Nota>
      </Pantalla>
    );
  }

  return (
    <Pantalla
      titulo="Deudas"
      etiqueta={`${datos.vigentes} vigente${datos.vigentes === 1 ? "" : "s"}`}
    >
      <View style={estilos.total}>
        <Text style={estilos.totalRotulo}>PAGAS CADA MES</Text>
        <Text style={estilos.totalMonto}>{pesos(datos.cuotaTotalMensual)}</Text>
        <Text style={estilos.totalPie}>
          Te quedan {pesos(datos.saldoTotal)} por pagar en total.
        </Text>
      </View>

      <Seccion titulo="Tus créditos" />
      {datos.creditos.map((c) => (
        <Tarjeta key={c.id} c={c} />
      ))}

      <Nota>
        Estos datos los entrega tu institución a través del Sistema de Finanzas Abiertas, no los
        escribiste tú. No mostramos la Carga Anual Equivalente ni el detalle cuota a cuota porque
        el estándar no los entrega: preferimos no calcular una cifra que parecería exacta sin
        serlo.
      </Nota>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  cargando: { marginTop: espacio.xl },

  vacio: { alignItems: "center", gap: espacio.m, paddingVertical: espacio.xl },
  vacioTexto: {
    color: colores.texto2,
    fontFamily: fuente.texto,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },

  total: { backgroundColor: colores.tarjeta, borderRadius: radio.l, padding: espacio.l, gap: 2 },
  totalRotulo: { color: colores.texto3, fontFamily: fuente.tituloMedio, fontSize: 11, letterSpacing: 1.2 },
  totalMonto: { color: colores.texto, fontFamily: fuente.titulo, fontSize: 32, letterSpacing: -0.7 },
  totalPie: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 13, marginTop: 2 },

  tarjeta: {
    backgroundColor: colores.tarjeta,
    borderRadius: radio.l,
    padding: espacio.l,
    marginTop: espacio.m,
  },
  apagada: { opacity: 0.6 },
  cabecera: { flexDirection: "row", alignItems: "flex-start", gap: espacio.m },
  identidad: { flex: 1, gap: 2 },
  producto: { color: colores.texto, fontFamily: fuente.tituloMedio, fontSize: 17 },
  institucion: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 12.5 },
  mora: { flexDirection: "row", alignItems: "center", gap: 3 },
  moraTexto: { color: colores.acento, fontFamily: fuente.textoFuerte, fontSize: 12 },

  cifras: { flexDirection: "row", gap: espacio.l, marginTop: espacio.l },
  cifra: { flex: 1, gap: 1 },
  cifraRotulo: { color: colores.texto3, fontFamily: fuente.tituloMedio, fontSize: 10, letterSpacing: 0.8 },
  cifraValor: { color: colores.texto, fontFamily: fuente.tituloMedio, fontSize: 18 },
  cifraPie: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 11.5 },

  pista: {
    height: 6,
    backgroundColor: colores.chip,
    borderRadius: 3,
    marginTop: espacio.l,
    overflow: "hidden",
  },
  avance: { height: "100%", backgroundColor: colores.acento, borderRadius: 3 },
  piePista: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  cuotas: { color: colores.texto2, fontFamily: fuente.textoMedio, fontSize: 12.5 },
  restantes: { color: colores.texto3, fontFamily: fuente.texto, fontSize: 12.5 },
});
