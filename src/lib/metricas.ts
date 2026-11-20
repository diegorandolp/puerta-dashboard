// Procesamiento previo: convierte los eventos y latidos crudos de DynamoDB en las seis
// métricas de desempeño del informe (Tabla "Métricas de desempeño del sistema").
// Son funciones puras, sin React, para poder probarlas con `npm run test:metricas`.
import { CONFIG } from "../config.ts"
import type { Evento, Latido } from "./tipos.ts"

export const SENSORES = [
  "vibracion",
  "movimiento",
  "puerta_forzada",
  "humo",
  "puerta_abierta",
] as const
export type Sensor = (typeof SENSORES)[number]

const esSensor = (tipo: string): tipo is Sensor =>
  (SENSORES as readonly string[]).includes(tipo)
const ms = (iso: string) => Date.parse(iso)

/** Alerta = evento de un sensor que manda el ESP32 (nivel leve o crítico). */
export const esAlerta = (e: Evento) =>
  esSensor(e.tipo) && (e.nivel === "leve" || e.nivel === "critico")

/** Latencia de un evento: hora de recepción en IoT Core menos la hora del evento en el ESP32. */
export function latenciaDe(e: Evento): number | null {
  if (typeof e.ts_evento !== "number" || !e.timestamp) return null
  return ms(e.timestamp) - e.ts_evento
}

/** Percentil por rango más cercano (sin interpolar), sobre una lista ya ordenada. */
export function percentil(ordenados: number[], p: number): number {
  if (!ordenados.length) return NaN
  const i = Math.ceil((p / 100) * ordenados.length) - 1
  return ordenados[Math.min(Math.max(i, 0), ordenados.length - 1)]
}

const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

// ---------------------------------------------------------------- 1. Latencia de alerta

export interface Latencia {
  n: number
  media: number
  p50: number
  p95: number
  min: number
  max: number
  cumpleMeta: boolean | null
  serie: { t: number; ms: number; tipo: string }[]
}

export function latencia(eventos: Evento[]): Latencia {
  const serie = eventos
    .filter(esAlerta)
    .map((e) => ({ t: ms(e.timestamp), ms: latenciaDe(e), tipo: e.tipo }))
    .filter((p): p is { t: number; ms: number; tipo: Sensor } => p.ms !== null)
    .sort((a, b) => a.t - b.t)
  const ord = serie.map((p) => p.ms).sort((a, b) => a - b)
  const p95 = percentil(ord, 95)
  return {
    n: ord.length,
    media: ord.length ? media(ord) : NaN,
    p50: percentil(ord, 50),
    p95,
    min: ord.length ? ord[0] : NaN,
    max: ord.length ? ord[ord.length - 1] : NaN,
    cumpleMeta: ord.length ? p95 < CONFIG.META_LATENCIA_P95_MS : null,
    serie,
  }
}

// ---------------------------------------------------------------- 2. Pérdida de mensajes

export interface Perdida {
  esperados: number
  recibidos: number
  perdidos: number
  tasa: number // 0..1
  arranques: number
}

/**
 * El ESP32 usa un solo contador `seq` para eventos y latidos, y lo reinicia en cada
 * arranque (`boot`). Dentro de un arranque, los números que faltan entre el primero y
 * el último que llegaron son mensajes perdidos.
 */
export function perdida(
  eventos: Evento[],
  latidos: Latido[],
  desdeMs: number,
  hastaMs: number
): Perdida {
  // Los últimos 15 s se dejan fuera: un mensaje puede estar en camino o no verse todavía
  // en DynamoDB (lectura eventualmente consistente) y contaría como perdido.
  const hastaEstable = hastaMs - 15_000
  const porArranque = new Map<number, Set<number>>()
  for (const m of [...eventos, ...latidos]) {
    if (typeof m.seq !== "number" || typeof m.boot !== "number") continue
    const t = ms(m.timestamp)
    if (t < desdeMs || t > hastaEstable) continue
    let s = porArranque.get(m.boot)
    if (!s) porArranque.set(m.boot, (s = new Set()))
    s.add(m.seq)
  }
  let esperados = 0
  let recibidos = 0
  for (const seqs of porArranque.values()) {
    let min = Infinity
    let max = -Infinity
    for (const v of seqs) {
      if (v < min) min = v
      if (v > max) max = v
    }
    esperados += max - min + 1
    recibidos += seqs.size
  }
  const perdidos = esperados - recibidos
  return {
    esperados,
    recibidos,
    perdidos,
    tasa: esperados ? perdidos / esperados : NaN,
    arranques: porArranque.size,
  }
}

// ---------------------------------------------------------------- 3. Disponibilidad del nodo

export interface Corte {
  desde: number
  hasta: number
}

export interface Disponibilidad {
  fraccion: number // sobre toda la ventana
  fraccionDesdePrimero: number // desde el primer latido de la ventana
  latidos: number
  esperados: number // uno cada 30 s en toda la ventana
  cortes: Corte[] // huecos de más de 70 s después del primer latido
  serie: { t: number; pct: number }[] // disponibilidad por intervalo
  intervaloMs: number
}

/**
 * El nodo cuenta como disponible en un instante si llegó un latido en los 70 s anteriores,
 * la misma regla con la que GET /estado lo marca conectado o desconectado.
 */
export function disponibilidad(
  latidos: Latido[],
  desdeMs: number,
  hastaMs: number
): Disponibilidad {
  const tol = CONFIG.DESCONEXION_MS
  const ts = latidos
    .map((l) => ms(l.timestamp))
    .filter((t) => t >= desdeMs && t <= hastaMs)
    .sort((a, b) => a - b)

  // Tramos cubiertos: [t, t + 70 s], fusionados
  const tramos: Corte[] = []
  for (const t of ts) {
    const fin = Math.min(t + tol, hastaMs)
    const ultimo = tramos[tramos.length - 1]
    if (ultimo && t <= ultimo.hasta) ultimo.hasta = Math.max(ultimo.hasta, fin)
    else tramos.push({ desde: t, hasta: fin })
  }
  const cubierto = (a: number, b: number) =>
    tramos.reduce(
      (s, r) => s + Math.max(0, Math.min(b, r.hasta) - Math.max(a, r.desde)),
      0
    )

  const cortes: Corte[] = []
  for (let i = 1; i < tramos.length; i++)
    cortes.push({ desde: tramos[i - 1].hasta, hasta: tramos[i].desde })
  const ultimo = tramos[tramos.length - 1]
  if (ultimo && ultimo.hasta < hastaMs)
    cortes.push({ desde: ultimo.hasta, hasta: hastaMs })

  const ventana = hastaMs - desdeMs
  const intervaloMs = intervaloDisponibilidad(ventana)
  const serie: { t: number; pct: number }[] = []
  for (let a = alinear(desdeMs, intervaloMs); a < hastaMs; a += intervaloMs) {
    const ini = Math.max(a, desdeMs)
    const fin = Math.min(a + intervaloMs, hastaMs)
    if (fin > ini)
      serie.push({ t: a, pct: (100 * cubierto(ini, fin)) / (fin - ini) })
  }

  return {
    fraccion: ventana > 0 ? cubierto(desdeMs, hastaMs) / ventana : NaN,
    fraccionDesdePrimero:
      ts.length && hastaMs > ts[0]
        ? cubierto(ts[0], hastaMs) / (hastaMs - ts[0])
        : NaN,
    latidos: ts.length,
    esperados: Math.floor(ventana / CONFIG.LATIDO_MS),
    cortes,
    serie,
    intervaloMs,
  }
}

const MIN = 60_000
const HORA = 60 * MIN
const alinear = (t: number, paso: number) => Math.floor(t / paso) * paso

/**
 * Escala de la ventana. Con margen, porque la ventana termina al llegar la respuesta y
 * dura unos milisegundos más que la hora pedida.
 */
export function escala(ventana: number): "1h" | "6h" | "24h" {
  if (ventana < 1.5 * HORA) return "1h"
  if (ventana < 9 * HORA) return "6h"
  return "24h"
}

const intervaloDisponibilidad = (ventana: number) =>
  ({ "1h": 2 * MIN, "6h": 15 * MIN, "24h": HORA })[escala(ventana)]

/** Intervalo de las barras de eventos: unas 12 a 24 barras por ventana. */
export const intervaloEventos = (ventana: number) =>
  ({ "1h": 5 * MIN, "6h": 30 * MIN, "24h": HORA })[escala(ventana)]

// ---------------------------------------------------------------- 4. Eventos por sensor

export interface ConteoSensor {
  leve: number
  critico: number
  total: number
  porHora: number
}

export interface EventosPorSensor {
  porSensor: Record<Sensor, ConteoSensor>
  total: number
  horas: number // horas en que los eventos están completos (para el ritmo por hora)
  masActivo: Sensor | null
  serie: ({ t: number } & Record<Sensor, number>)[]
  intervaloMs: number
}

export function eventosPorSensor(
  eventos: Evento[],
  desdeMs: number,
  hastaMs: number,
  desdeEventosMs = desdeMs
): EventosPorSensor {
  const horas = (hastaMs - desdeEventosMs) / HORA
  const porSensor = Object.fromEntries(
    SENSORES.map((s) => [s, { leve: 0, critico: 0, total: 0, porHora: 0 }])
  ) as Record<Sensor, ConteoSensor>

  const intervaloMs = intervaloEventos(hastaMs - desdeMs)
  const cero = () =>
    Object.fromEntries(SENSORES.map((s) => [s, 0])) as Record<Sensor, number>
  const serie: ({ t: number } & Record<Sensor, number>)[] = []
  const indice = new Map<number, number>()
  for (let a = alinear(desdeMs, intervaloMs); a < hastaMs; a += intervaloMs) {
    indice.set(a, serie.length)
    serie.push({ t: a, ...cero() })
  }

  for (const e of eventos) {
    if (!esAlerta(e)) continue
    const t = ms(e.timestamp)
    if (t < desdeMs || t > hastaMs) continue
    const s = e.tipo as Sensor
    porSensor[s][e.nivel === "critico" ? "critico" : "leve"]++
    porSensor[s].total++
    const i = indice.get(alinear(t, intervaloMs))
    if (i !== undefined) serie[i][s]++
  }

  let total = 0
  let masActivo: Sensor | null = null
  for (const s of SENSORES) {
    porSensor[s].porHora = horas > 0 ? porSensor[s].total / horas : NaN
    total += porSensor[s].total
    if (
      porSensor[s].total > 0 &&
      (!masActivo || porSensor[s].total > porSensor[masActivo].total)
    )
      masActivo = s
  }
  return { porSensor, total, horas, masActivo, serie, intervaloMs }
}

// ---------------------------------------------------------------- 5. Tasa de falsas alarmas

export interface FalsasAlarmas {
  alertas: number
  falsas: number
  tasa: number
  criticas: number
  criticasFalsas: number
}

export function falsasAlarmas(eventos: Evento[]): FalsasAlarmas {
  const alertas = eventos.filter(esAlerta)
  const criticas = alertas.filter((e) => e.nivel === "critico")
  const falsas = alertas.filter((e) => e.falsa === true).length
  return {
    alertas: alertas.length,
    falsas,
    tasa: alertas.length ? falsas / alertas.length : NaN,
    criticas: criticas.length,
    criticasFalsas: criticas.filter((e) => e.falsa === true).length,
  }
}

// ---------------------------------------------------------------- 6. Calidad del enlace

export type CalidadRssi = "buena" | "aceptable" | "debil"

/** Bandas habituales de Wi-Fi: desde −67 dBm alcanza para casi todo, por debajo de −80 se cae. */
export const calidadRssi = (dbm: number): CalidadRssi =>
  dbm >= -67 ? "buena" : dbm >= -80 ? "aceptable" : "debil"

export interface Enlace {
  n: number
  media: number
  min: number
  max: number
  calidad: CalidadRssi | null
}

export function enlace(latidos: Latido[]): Enlace {
  const xs = latidos
    .map((l) => l.rssi)
    .filter((v): v is number => typeof v === "number")
  if (!xs.length) return { n: 0, media: NaN, min: NaN, max: NaN, calidad: null }
  const m = media(xs)
  return {
    n: xs.length,
    media: m,
    min: Math.min(...xs),
    max: Math.max(...xs),
    calidad: calidadRssi(m),
  }
}

// ---------------------------------------------------------------- Series de latidos

/**
 * Serie de un campo de los latidos. Si hay más de `maxPuntos`, agrupa por intervalos
 * con la media (RSSI) o el máximo (gas, para no esconder un pico de humo).
 */
export function serieLatidos(
  latidos: Latido[],
  campo: "rssi" | "gas",
  modo: "media" | "max",
  maxPuntos = 360
): { t: number; v: number }[] {
  const pts = latidos
    .filter((l) => typeof l[campo] === "number")
    .map((l) => ({ t: ms(l.timestamp), v: l[campo] as number }))
    .sort((a, b) => a.t - b.t)
  if (pts.length <= maxPuntos) return pts
  const paso = Math.ceil((pts[pts.length - 1].t - pts[0].t) / maxPuntos)
  const grupos = new Map<number, number[]>()
  for (const p of pts) {
    const k = alinear(p.t, paso)
    const g = grupos.get(k)
    if (g) g.push(p.v)
    else grupos.set(k, [p.v])
  }
  return [...grupos].map(([t, vs]) => ({
    t,
    v: modo === "max" ? Math.max(...vs) : media(vs),
  }))
}

// ---------------------------------------------------------------- Todo junto

export interface Metricas {
  desdeMs: number
  hastaMs: number
  latencia: Latencia
  perdida: Perdida | null // null sin latidos: el contador seq los incluye
  disponibilidad: Disponibilidad | null
  eventos: EventosPorSensor
  falsas: FalsasAlarmas
  enlace: Enlace | null
}

export interface Ventana {
  desdeMs: number
  hastaMs: number
  /** Desde dónde están todos los eventos (más tarde que desdeMs si la consulta se cortó). */
  desdeEventosMs?: number
  /** Desde dónde están completos eventos y latidos a la vez, para la pérdida. */
  desdeCompletoMs?: number
}

export function calcularMetricas(
  eventos: Evento[],
  latidos: Latido[] | null,
  v: Ventana
): Metricas {
  const { desdeMs, hastaMs } = v
  const desdeEventosMs = v.desdeEventosMs ?? desdeMs
  // Todas las métricas de eventos miran el mismo conjunto
  const enVentana = eventos.filter((e) => {
    const t = ms(e.timestamp)
    return t >= desdeMs && t <= hastaMs
  })
  return {
    desdeMs,
    hastaMs,
    latencia: latencia(enVentana),
    perdida: latidos
      ? perdida(enVentana, latidos, v.desdeCompletoMs ?? desdeMs, hastaMs)
      : null,
    disponibilidad: latidos ? disponibilidad(latidos, desdeMs, hastaMs) : null,
    eventos: eventosPorSensor(enVentana, desdeMs, hastaMs, desdeEventosMs),
    falsas: falsasAlarmas(enVentana),
    enlace: latidos
      ? enlace(
          latidos.filter(
            (l) => ms(l.timestamp) >= desdeMs && ms(l.timestamp) <= hastaMs
          )
        )
      : null,
  }
}
