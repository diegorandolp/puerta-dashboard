import { useCallback, useEffect, useState } from "react"

import { CONFIG } from "@/config"
import {
  getEstado,
  getEventosDesde,
  getLatidosDesde,
  type FaltaLatidos,
} from "@/lib/api"
import type { Estado, Evento, Latido } from "@/lib/tipos"

export type Ventana = "1h" | "6h" | "24h"

export const VENTANAS: Record<Ventana, { ms: number; etiqueta: string }> = {
  "1h": { ms: 3_600_000, etiqueta: "Última hora" },
  "6h": { ms: 6 * 3_600_000, etiqueta: "Últimas 6 h" },
  "24h": { ms: 24 * 3_600_000, etiqueta: "Últimas 24 h" },
}

export interface DatosVentana {
  ventana: Ventana
  desdeMs: number
  hastaMs: number
  eventos: Evento[]
  eventosTruncado: boolean
  eventosConDesde: boolean
  latidos: Latido[] | null
  latidosTruncado: boolean
  faltaLatidos: FaltaLatidos
}

const mensaje = (e: unknown) =>
  e instanceof Error ? e.message : "Error desconocido"
const visible = () => document.visibilityState === "visible"

/**
 * Repite `pedir` cada `cadaMs` mientras la pestaña esté a la vista, y una vez más al volver a
 * ella. `pedir` recibe una función que dice si el efecto sigue vigente, para descartar
 * respuestas que llegan tarde (por ejemplo, de la ventana anterior).
 */
function useSondeo(pedir: (vigente: () => boolean) => void, cadaMs: number) {
  useEffect(() => {
    let vivo = true
    const vigente = () => vivo
    pedir(vigente)
    const i = setInterval(() => visible() && pedir(vigente), cadaMs)
    const alVolver = () => visible() && pedir(vigente)
    document.addEventListener("visibilitychange", alVolver)
    return () => {
      vivo = false
      clearInterval(i)
      document.removeEventListener("visibilitychange", alVolver)
    }
  }, [pedir, cadaMs])
}

/** Consulta /estado cada 10 s y la ventana (eventos y latidos) cada 30 s. */
export function useDatos(ventana: Ventana) {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [errorEstado, setErrorEstado] = useState<string | null>(null)
  const [datos, setDatos] = useState<DatosVentana | null>(null)
  const [errorDatos, setErrorDatos] = useState<string | null>(null)
  const [actualizado, setActualizado] = useState<number | null>(null)
  const [refrescando, setRefrescando] = useState(false)
  // Cambiar estos contadores vuelve a crear `pedir`, y con eso el sondeo pide de inmediato
  const [nEstado, setNEstado] = useState(0)
  const [nVentana, setNVentana] = useState(0)

  const pedirEstado = useCallback(
    (vigente: () => boolean) => {
      void nEstado
      getEstado().then(
        (e) => {
          if (!vigente()) return
          setEstado(e)
          setErrorEstado(null)
        },
        (err) => vigente() && setErrorEstado(mensaje(err))
      )
    },
    [nEstado]
  )

  const pedirVentana = useCallback(
    (vigente: () => boolean) => {
      void nVentana
      const desdeMs = Date.now() - VENTANAS[ventana].ms
      const desde = new Date(desdeMs)
      Promise.all([getEventosDesde(desde), getLatidosDesde(desde)])
        .then(
          ([ev, la]) => {
            if (!vigente()) return
            setDatos({
              ventana,
              desdeMs,
              // El fin de la ventana es la llegada de la respuesta: así entran los eventos
              // que se guardaron mientras se hacía la consulta
              hastaMs: Date.now(),
              eventos: ev.eventos,
              eventosTruncado: ev.truncado,
              eventosConDesde: ev.conDesde,
              latidos: la.latidos,
              latidosTruncado: la.truncado,
              faltaLatidos: la.falta,
            })
            setErrorDatos(null)
            setActualizado(Date.now())
          },
          (err) => vigente() && setErrorDatos(mensaje(err))
        )
        .finally(() => vigente() && setRefrescando(false))
    },
    [ventana, nVentana]
  )

  useSondeo(pedirEstado, CONFIG.ESTADO_MS)
  useSondeo(pedirVentana, CONFIG.VENTANA_MS)

  const actualizar = useCallback(() => {
    setRefrescando(true)
    setNEstado((n) => n + 1)
    setNVentana((n) => n + 1)
  }, [])

  const refrescarEstado = useCallback(() => setNEstado((n) => n + 1), [])

  /** Refleja al instante una alerta marcada o desmarcada como falsa, sin esperar la próxima consulta. */
  const marcarLocal = useCallback((timestamp: string, falsa: boolean) => {
    setDatos(
      (d) =>
        d && {
          ...d,
          eventos: d.eventos.map((e) =>
            e.timestamp === timestamp ? { ...e, falsa } : e
          ),
        }
    )
  }, [])

  // Al cambiar de ventana, los datos de la anterior no se muestran mientras llegan los nuevos
  const vigentes = datos?.ventana === ventana ? datos : null

  return {
    estado,
    errorEstado,
    datos: vigentes,
    errorDatos,
    cargando: refrescando || vigentes === null,
    actualizado,
    actualizar,
    refrescarEstado,
    marcarLocal,
  }
}

/** Fecha actual que se renueva cada `cadaMs`, para los textos "hace 12 s". */
export function useAhora(cadaMs = 1000) {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const i = setInterval(() => setAhora(Date.now()), cadaMs)
    return () => clearInterval(i)
  }, [cadaMs])
  return ahora
}
