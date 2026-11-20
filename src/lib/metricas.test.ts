// Pruebas del procesamiento previo. Se corren con `npm run test:metricas` (Node ≥ 23, sin compilar).
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  calcularMetricas,
  disponibilidad,
  eventosPorSensor,
  falsasAlarmas,
  latencia,
  percentil,
  perdida,
} from "./metricas.ts"
import type { Evento, Latido } from "./tipos.ts"

const T0 = Date.parse("2026-11-18T20:00:00.000Z")
const iso = (t: number) => new Date(t).toISOString()

const evento = (t: number, extra: Partial<Evento> = {}): Evento => ({
  dispositivo: "esp32_puerta",
  timestamp: iso(t),
  tipo: "movimiento",
  nivel: "leve",
  ...extra,
})
const latido = (t: number, extra: Partial<Latido> = {}): Latido => ({
  timestamp: iso(t),
  ...extra,
})

test("percentil por rango más cercano", () => {
  const xs = Array.from({ length: 20 }, (_, i) => i + 1) // 1..20
  assert.equal(percentil(xs, 95), 19)
  assert.equal(percentil(xs, 50), 10)
  assert.equal(percentil([7], 95), 7)
  assert.ok(Number.isNaN(percentil([], 95)))
})

test("latencia: recepción menos ts_evento, solo alertas del ESP32", () => {
  const evs = [
    evento(T0 + 1000, { ts_evento: T0 + 800 }), // 200 ms
    evento(T0 + 2000, {
      ts_evento: T0 + 1700,
      tipo: "vibracion",
      nivel: "critico",
    }), // 300 ms
    evento(T0 + 3000, { tipo: "apertura", nivel: "info" }), // lo escribe AWS: no cuenta
    evento(T0 + 4000), // sin ts_evento: no cuenta
  ]
  const l = latencia(evs)
  assert.equal(l.n, 2)
  assert.equal(l.media, 250)
  assert.equal(l.p95, 300)
  assert.equal(l.cumpleMeta, true)
})

test("pérdida: huecos de seq por arranque, sumando eventos y latidos", () => {
  // Arranque 1: seq 1..10 sin el 4 ni el 7. Arranque 2: seq 1..5 completos.
  const evs = [1, 2, 3, 5].map((s) =>
    evento(T0 + s * 1000, { seq: s, boot: 1 })
  )
  const lats = [6, 8, 9, 10].map((s) =>
    latido(T0 + s * 1000, { seq: s, boot: 1 })
  )
  const lats2 = [1, 2, 3, 4, 5].map((s) =>
    latido(T0 + 60_000 + s * 1000, { seq: s, boot: 2 })
  )
  const p = perdida(evs, [...lats, ...lats2], T0, T0 + 3_600_000)
  assert.equal(p.arranques, 2)
  assert.equal(p.esperados, 15)
  assert.equal(p.recibidos, 13)
  assert.equal(p.perdidos, 2)
})

test("pérdida: ignora los últimos 15 s y los duplicados", () => {
  const lats = [1, 2, 2, 3].map((s) =>
    latido(T0 + s * 1000, { seq: s, boot: 1 })
  )
  const tardio = latido(T0 + 50_000, { seq: 9, boot: 1 })
  const p = perdida([], [...lats, tardio], T0, T0 + 60_000)
  assert.equal(p.esperados, 3)
  assert.equal(p.perdidos, 0)
})

test("disponibilidad: latido cada 30 s durante una hora es 100 %", () => {
  const lats = Array.from({ length: 121 }, (_, i) => latido(T0 + i * 30_000))
  const d = disponibilidad(lats, T0, T0 + 3_600_000)
  assert.equal(d.fraccion, 1)
  assert.equal(d.cortes.length, 0)
  assert.equal(d.esperados, 120)
})

test("disponibilidad: un corte de 10 min y el nodo encendido a la mitad", () => {
  const H = 3_600_000
  // Encendido a los 30 min; latidos cada 30 s, salvo entre 40 y 50 min
  const lats: Latido[] = []
  for (let t = T0 + H / 2; t <= T0 + H; t += 30_000) {
    if (t > T0 + 40 * 60_000 && t < T0 + 50 * 60_000) continue
    lats.push(latido(t))
  }
  const d = disponibilidad(lats, T0, T0 + H)
  assert.equal(d.cortes.length, 1)
  // El corte empieza 70 s después del último latido (40:00) y acaba con el siguiente (50:00)
  assert.equal(d.cortes[0].desde, T0 + 40 * 60_000 + 70_000)
  assert.equal(d.cortes[0].hasta, T0 + 50 * 60_000)
  const caido = 10 * 60_000 - 70_000
  assert.ok(Math.abs(d.fraccionDesdePrimero - (H / 2 - caido) / (H / 2)) < 1e-9)
  assert.ok(Math.abs(d.fraccion - (H / 2 - caido) / H) < 1e-9)
})

test("eventos por sensor: conteos, por hora e intervalos", () => {
  const H = 3_600_000
  const evs = [
    evento(T0 + 60_000, { tipo: "vibracion", nivel: "critico" }),
    evento(T0 + 120_000, { tipo: "vibracion" }),
    evento(T0 + 400_000, { tipo: "humo", nivel: "critico" }),
    evento(T0 + 500_000, { tipo: "comando_armar", nivel: "info" }),
  ]
  const r = eventosPorSensor(evs, T0, T0 + H)
  assert.equal(r.total, 3)
  assert.equal(r.porSensor.vibracion.critico, 1)
  assert.equal(r.porSensor.vibracion.leve, 1)
  assert.equal(r.porSensor.vibracion.porHora, 2)
  assert.equal(r.masActivo, "vibracion")
  assert.equal(r.serie.length, 12) // una hora en barras de 5 min
  // La ventana real dura unos ms más que la hora pedida y no debe cambiar de escala
  assert.equal(eventosPorSensor(evs, T0, T0 + H + 250).intervaloMs, 5 * 60_000)
  assert.equal(r.serie[0].vibracion, 2)
  assert.equal(r.serie[1].humo, 1)
})

test("falsas alarmas: marcadas sobre el total de alertas", () => {
  const evs = [
    evento(T0, { nivel: "critico", falsa: true }),
    evento(T0 + 1, { nivel: "critico" }),
    evento(T0 + 2, { falsa: true }),
    evento(T0 + 3),
    evento(T0 + 4, { tipo: "pin_incorrecto", nivel: "advertencia" }),
  ]
  const f = falsasAlarmas(evs)
  assert.equal(f.alertas, 4)
  assert.equal(f.falsas, 2)
  assert.equal(f.tasa, 0.5)
  assert.equal(f.criticasFalsas, 1)
})

test("sin latidos, las métricas que dependen de ellos quedan en null", () => {
  const m = calcularMetricas([evento(T0)], null, {
    desdeMs: T0,
    hastaMs: T0 + 3_600_000,
  })
  assert.equal(m.perdida, null)
  assert.equal(m.disponibilidad, null)
  assert.equal(m.enlace, null)
  assert.equal(m.eventos.total, 1)
})

test("las métricas de eventos usan los mismos eventos de la ventana", () => {
  const H = 3_600_000
  // Uno llegó después del fin de la ventana (mientras se hacía la consulta)
  const evs = [
    evento(T0 + 1000, { nivel: "critico" }),
    evento(T0 + H + 500, { nivel: "critico" }),
  ]
  const m = calcularMetricas(evs, [], { desdeMs: T0, hastaMs: T0 + H })
  assert.equal(m.eventos.total, 1)
  assert.equal(m.falsas.alertas, 1)
})

test("el ritmo por hora usa solo el tramo con eventos completos", () => {
  const H = 3_600_000
  const evs = Array.from({ length: 10 }, (_, i) =>
    evento(T0 + H - 600_000 + i * 1000)
  )
  const m = calcularMetricas(evs, null, {
    desdeMs: T0,
    hastaMs: T0 + H,
    desdeEventosMs: T0 + H - 600_000,
  })
  assert.equal(m.eventos.horas, 600_000 / H)
  assert.equal(m.eventos.porSensor.movimiento.porHora, 60)
})
