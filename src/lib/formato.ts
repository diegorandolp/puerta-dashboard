import { CONFIG } from "../config.ts"

const zona = { timeZone: CONFIG.ZONA_HORARIA }

const fHora = new Intl.DateTimeFormat("es-PE", {
  ...zona,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})
const fHoraCorta = new Intl.DateTimeFormat("es-PE", {
  ...zona,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})
const fFecha = new Intl.DateTimeFormat("es-PE", {
  ...zona,
  day: "2-digit",
  month: "2-digit",
})

/** 19:11:28 (hora de Lima) */
export const hora = (t: number | string) => fHora.format(new Date(t))
/** 19:11 */
export const horaCorta = (t: number | string) => fHoraCorta.format(new Date(t))
/** 18/11 19:11:28 */
export const fechaHora = (t: number | string) =>
  `${fFecha.format(new Date(t))} ${fHora.format(new Date(t))}`

// Coma decimal y sin separador de miles en números de 4 cifras, como en el informe ("2,26 A", "1800")
const fEntero = new Intl.NumberFormat("es", { maximumFractionDigits: 0 })
const fDecimal = new Intl.NumberFormat("es", { maximumFractionDigits: 1 })

export const entero = (n: number) =>
  Number.isFinite(n) ? fEntero.format(n) : "—"
export const decimal = (n: number) =>
  Number.isFinite(n) ? fDecimal.format(n) : "—"

const reglaPlural = new Intl.PluralRules("es")
/** plural(1, "alerta", "alertas") → "1 alerta"; plural(0, …) → "0 alertas" */
export const plural = (n: number, uno: string, otros: string) =>
  `${entero(n)} ${reglaPlural.select(n) === "one" ? uno : otros}`

/** 0.0123 → "1,2 %"; 1 → "100 %" */
export function porcentaje(fraccion: number) {
  if (!Number.isFinite(fraccion)) return "—"
  const v = fraccion * 100
  const txt =
    v === 100 || v === 0
      ? fEntero.format(v)
      : fDecimal.format(Math.min(v, 99.9))
  return `${txt} %`
}

/** 254 → "254 ms"; 2310 → "2,3 s" */
export function duracionMs(n: number) {
  if (!Number.isFinite(n)) return "—"
  return Math.abs(n) < 1000
    ? `${fEntero.format(n)} ms`
    : `${fDecimal.format(n / 1000)} s`
}

/** 95_000 → "1 min 35 s" */
export function duracionLarga(n: number) {
  const s = Math.round(n / 1000)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return s % 60 ? `${m} min ${s % 60} s` : `${m} min`
  const h = Math.floor(m / 60)
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`
}

/** "hace 12 s", "hace 3 min" */
export function haceCuanto(t: number, ahora = Date.now()) {
  const s = Math.max(0, Math.round((ahora - t) / 1000))
  if (s < 5) return "ahora"
  if (s < 60) return `hace ${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} d`
}

export const NOMBRE_SENSOR: Record<string, string> = {
  vibracion: "Vibración",
  movimiento: "Movimiento",
  puerta_forzada: "Puerta forzada",
  humo: "Humo",
  puerta_abierta: "Puerta abierta",
}

export const ORIGEN_SENSOR: Record<string, string> = {
  vibracion: "SW-420",
  movimiento: "PIR",
  puerta_forzada: "MC-38",
  humo: "MQ-2",
  puerta_abierta: "MC-38",
}

export const NOMBRE_EVENTO: Record<string, string> = {
  ...NOMBRE_SENSOR,
  apertura: "Apertura",
  comando_armar: "Armar",
  comando_desarmar: "Desarmar",
  comando_silenciar: "Silenciar",
  pin_incorrecto: "PIN incorrecto",
}
