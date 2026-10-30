/**
 * Tu sueldo (RF-36).
 *
 * El principio del proyecto es cero fricción mensual: lo que no cambia no se
 * vuelve a escribir. El sueldo es el caso puro, así que se configura una vez.
 *
 * Esta pantalla va un paso más allá de "escribe tu sueldo". Como el abono ya
 * llega por el estándar, el backend lo detecta y aquí solo se CONFIRMA, con la
 * evidencia a la vista para que la persona pueda juzgarla: qué glosa es y en
 * cuántos meses se vio. Escribir el monto queda como salida, no como entrada.
 *
 * Por qué se guarda si se sabe detectar: el detectado es una inferencia y se
 * mueve si el banco cambia la glosa o si hay un mes raro; el declarado es una
 * afirmación de la persona y no cambia solo. La proyección de metas prefiere
 * el declarado.
 */
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Boton } from "@/components/Boton";
import { Campo } from "@/components/Campo";
import { Nota, Pantalla, Seccion } from "@/components/Pantalla";
import { colores, espacio, fuente, radio } from "@/constants/tema";
import {
  guardarSueldo,
  obtenerPerfil,
  type Perfil,
  type SueldoDetectado,
} from "@/servicios/perfil";
import { useSesion } from "@/sesion/SesionContexto";
import { fechaConAnio, pesos } from "@/utils/formato";

/** "850.000" o "$850000" → 850000. null si no hay un número válido. */
function aMonto(texto: string): number | null {
  const limpio = texto.replace(/[^\d]/g, "");
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** La evidencia, en una línea que la persona pueda contrastar con su cuenta. */
function evidencia(d: SueldoDetectado): string {
  const veces = d.meses === 1 ? "un mes" : `${d.meses} meses`;
  return `"${d.glosa}" · se repite en ${veces}, desde ${fechaConAnio(d.desde)}`;
}

export default function Sueldo() {
  const router = useRouter();
  const { anotarSueldo } = useSesion();

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [monto, setMonto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listoMensaje, setListoMensaje] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    obtenerPerfil()
      .then((p) => {
        if (!vivo) return;
        setPerfil(p);
        // El campo arranca con lo declarado: cambiarlo es editar, no empezar
        // de cero. Si no hay nada declarado se deja vacío, porque el camino
        // esperado es confirmar el detectado, no escribir.
        if (p.sueldoDeclarado !== null) setMonto(String(p.sueldoDeclarado));
      })
      .catch((e) => vivo && setError(e instanceof Error ? e.message : "No se pudo cargar."));
    return () => {
      vivo = false;
    };
  }, []);

  async function declarar(valor: number | null, mensaje: string) {
    setGuardando(true);
    setError(null);
    setListoMensaje(null);
    try {
      const p = await guardarSueldo(valor);
      setPerfil(p);
      setMonto(p.sueldoDeclarado !== null ? String(p.sueldoDeclarado) : "");
      await anotarSueldo(p.sueldoDeclarado);
      setListoMensaje(mensaje);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el sueldo.");
    } finally {
      setGuardando(false);
    }
  }

  if (perfil === null) {
    return (
      <Pantalla titulo="Tu sueldo" onAtras={() => router.back()}>
        {error ? <Text style={estilos.error}>{error}</Text> : <Nota>Cargando…</Nota>}
      </Pantalla>
    );
  }

  const { sueldoDeclarado: declarado, sueldoDetectado: detectado } = perfil;
  const escrito = aMonto(monto);
  const cambio = escrito !== null && escrito !== declarado;

  return (
    <Pantalla titulo="Tu sueldo" onAtras={() => router.back()}>
      {declarado !== null ? (
        <>
          <Seccion titulo="Tu sueldo declarado" />
          <View style={estilos.tarjeta}>
            <Text style={estilos.cifra}>{pesos(declarado)}</Text>
            <Text style={estilos.pie}>
              Es el que se usa para proyectar tus metas. No se vuelve a preguntar.
            </Text>
          </View>
        </>
      ) : detectado ? (
        <>
          <Seccion titulo="Esto vemos en tu cuenta" />
          <View style={estilos.tarjeta}>
            <Text style={estilos.cifra}>{pesos(detectado.monto)}</Text>
            <Text style={estilos.pie}>{evidencia(detectado)}</Text>
          </View>
          <Boton
            titulo="Sí, ese es mi sueldo"
            onPress={() => declarar(detectado.monto, "Listo, quedó guardado.")}
            cargando={guardando}
            style={estilos.confirmar}
          />
        </>
      ) : (
        <Nota>
          Todavía no podemos reconocer tu sueldo entre tus abonos: hace falta verlo repetirse al
          menos tres meses. Puedes escribirlo tú mientras tanto.
        </Nota>
      )}

      <Seccion titulo={declarado !== null ? "Cambiarlo" : "O escríbelo tú"} />
      <Campo
        etiqueta="Sueldo líquido mensual"
        placeholder="850000"
        value={monto}
        onChangeText={(t) => {
          setMonto(t);
          setListoMensaje(null);
        }}
        keyboardType="number-pad"
      />
      {escrito !== null ? <Text style={estilos.eco}>{pesos(escrito)}</Text> : null}

      <Boton
        titulo="Guardar"
        onPress={() => declarar(escrito, "Listo, quedó guardado.")}
        cargando={guardando}
        deshabilitado={!cambio}
        style={estilos.guardar}
      />

      {declarado !== null && detectado && detectado.monto !== declarado ? (
        <Pressable
          onPress={() => declarar(detectado.monto, "Listo, quedó el que detectamos.")}
          hitSlop={8}
        >
          <Text style={estilos.enlace}>
            Usar el que detectamos: {pesos(detectado.monto)}
          </Text>
        </Pressable>
      ) : null}

      {declarado !== null ? (
        <Pressable
          onPress={() => declarar(null, "Se borró. Volvemos a estimarlo desde tus abonos.")}
          hitSlop={8}
        >
          <Text style={estilos.enlaceApagado}>Borrar el sueldo declarado</Text>
        </Pressable>
      ) : null}

      {listoMensaje ? <Text style={estilos.listo}>{listoMensaje}</Text> : null}
      {error ? <Text style={estilos.error}>{error}</Text> : null}

      <Nota>
        Sirve para calcular cuánto te queda disponible y para proyectar cuándo alcanzas tus metas.
        Si no lo declaras, lo estimamos a partir de los abonos que se repiten.
      </Nota>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    backgroundColor: colores.tarjeta,
    borderRadius: radio.l,
    padding: espacio.l,
    gap: espacio.xs,
  },
  cifra: { color: colores.texto, fontFamily: fuente.tituloMedio, fontSize: 32 },
  pie: { color: colores.texto2, fontFamily: fuente.texto, fontSize: 14, lineHeight: 20 },
  confirmar: { marginTop: espacio.m },
  eco: { color: colores.texto3, fontFamily: fuente.textoMedio, fontSize: 13, marginTop: espacio.xs },
  guardar: { marginTop: espacio.m },
  enlace: {
    color: colores.acento,
    fontFamily: fuente.textoFuerte,
    fontSize: 14,
    marginTop: espacio.l,
  },
  // El borrado no se destaca: no es una acción que haya que invitar a tocar.
  enlaceApagado: {
    color: colores.texto2,
    fontFamily: fuente.textoMedio,
    fontSize: 14,
    marginTop: espacio.l,
  },
  listo: { color: colores.ok, fontFamily: fuente.textoMedio, fontSize: 14, marginTop: espacio.m },
  error: { color: colores.acento, fontFamily: fuente.textoMedio, fontSize: 14, marginTop: espacio.m },
});
