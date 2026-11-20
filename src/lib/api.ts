import { CONFIG } from "../config.ts"
import type { Accion, Estado, Evento, Latido } from "./tipos.ts"

/** Estado de un error de red o de CORS (el navegador no deja ver la respuesta). */
export const SIN_RESPUESTA = -1

export class ErrorApi extends Error {
  status: number
  constructor(mensaje: string, status: number) {
    super(mensaje)
    this.status = status
  }
}

async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 15_000)
  try {
    const res = await fetch(`${CONFIG.API_URL}${ruta}`, {
      ...init,
      // Solo los POST llevan cuerpo JSON; en los GET el encabezado forzaría un preflight
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      signal: ctrl.signal,
    })
    const datos = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new ErrorApi(
        datos.mensaje || datos.message || `Error ${res.status}`,
        res.status
      )
    }
    return datos as T
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new ErrorApi("Tiempo de espera agotado", 0)
    }
    if (e instanceof ErrorApi) throw e
    // También llega aquí un 404 de una ruta que no existe: API Gateway lo responde sin CORS
    throw new ErrorApi("Sin respuesta de la API", SIN_RESPUESTA)
  } finally {
    clearTimeout(t)
  }
}

export const getEstado = () => pedir<Estado>("/estado")

export interface EventosVentana {
  eventos: Evento[]
  truncado: boolean
  // false si la Lambda desplegada todavía no entiende ?desde= y solo devolvió los últimos 100
  conDesde: boolean
}

export async function getEventosDesde(desde: Date): Promise<EventosVentana> {
  const iso = desde.toISOString()
  // limite=100 es lo que usa una Lambda sin ?desde=; la nueva lo ignora cuando hay desde
  const r = await pedir<{ eventos: Evento[]; truncado?: boolean }>(
    `/eventos?desde=${encodeURIComponent(iso)}&limite=100`
  )
  return {
    eventos: r.eventos.filter((e) => e.timestamp >= iso),
    truncado: Boolean(r.truncado),
    conDesde: "truncado" in r,
  }
}

export type FaltaLatidos = "ruta" | "tabla" | null

export interface LatidosVentana {
  latidos: Latido[] | null
  truncado: boolean
  falta: FaltaLatidos
}

export async function getLatidosDesde(desde: Date): Promise<LatidosVentana> {
  try {
    const r = await pedir<{ latidos: Latido[]; truncado?: boolean }>(
      `/latidos?desde=${encodeURIComponent(desde.toISOString())}`
    )
    return { latidos: r.latidos, truncado: Boolean(r.truncado), falta: null }
  } catch (e) {
    // Sin la ruta GET /latidos, API Gateway responde 404 sin CORS y el navegador solo ve un
    // error de red. Si la API estuviera caída, también fallaría /eventos y se mostraría ese error.
    // 503: la Lambda no tiene TABLA_LATIDOS.
    if (
      e instanceof ErrorApi &&
      (e.status === 404 || e.status === SIN_RESPUESTA)
    )
      return { latidos: null, truncado: false, falta: "ruta" }
    if (e instanceof ErrorApi && e.status === 503)
      return { latidos: null, truncado: false, falta: "tabla" }
    throw e
  }
}

export const enviarComando = (pin: string, accion: Accion) =>
  pedir<{ success: boolean; mensaje: string }>("/comando", {
    method: "POST",
    body: JSON.stringify({ pin, accion }),
  })

export const marcarFalsaAlarma = (
  pin: string,
  timestamp: string,
  falsa: boolean
) =>
  pedir<{ success: boolean; falsa: boolean }>("/falsa_alarma", {
    method: "POST",
    body: JSON.stringify({ pin, timestamp, falsa }),
  })
