import { cn } from "cn"

import { Skeleton } from "@/components/ui/skeleton"
import { Ayuda } from "@/components/ayuda"
import { Indicador, type Tono } from "@/components/estado-indicador"
import { SUPERFICIE } from "@/components/superficie"
import { CONFIG } from "@/config"
import {
  decimal,
  duracionLarga,
  duracionMs,
  entero,
  NOMBRE_SENSOR,
  plural,
  porcentaje,
} from "@/lib/formato"
import { SENSORES, type Metricas } from "@/lib/metricas"

const REJILLA = cn(SUPERFICIE, "md:grid-cols-2 xl:grid-cols-3")

/** Una métrica: nombre, valor grande con su estado al lado y una línea de contexto. El cálculo va en la ayuda. */
function Metrica({
  titulo,
  calculo,
  valor,
  detalle,
  estado,
  children,
}: {
  titulo: string
  calculo: string
  valor: string
  detalle?: React.ReactNode
  estado?: { tono: Tono; texto: string } | null
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">{titulo}</h3>
        <Ayuda titulo={titulo}>{calculo}</Ayuda>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">
          {valor}
        </span>
        {estado && <Indicador tono={estado.tono}>{estado.texto}</Indicador>}
      </div>
      {detalle && <p className="text-xs text-muted-foreground">{detalle}</p>}
      {children}
    </div>
  )
}

export function TarjetasMetricas({ metricas: m }: { metricas: Metricas | null }) {
  if (!m) {
    return (
      <div className={REJILLA}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 bg-card p-4">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3.5 w-36" />
          </div>
        ))}
      </div>
    )
  }

  const {
    latencia: l,
    perdida: p,
    disponibilidad: d,
    eventos: e,
    falsas: f,
    enlace: w,
  } = m
  const meta = duracionMs(CONFIG.META_LATENCIA_P95_MS)
  const tiempoCaido = d
    ? d.cortes.reduce((s, c) => s + c.hasta - c.desde, 0)
    : 0
  // Sin el historial de latidos esas métricas no se pueden calcular; el aviso de arriba dice por qué
  const SIN_DATOS = "Sin datos de latidos"

  return (
    <div className={REJILLA}>
      <Metrica
        titulo="Latencia de alerta (p95)"
        calculo="Hora de recepción en IoT Core, que agrega la regla, menos la hora del evento en el ESP32 (ts_evento, por NTP). Solo cuenta las alertas que manda el ESP32. Percentil 95 por rango más cercano."
        valor={duracionMs(l.p95)}
        detalle={
          l.n
            ? `Mediana ${duracionMs(l.p50)} · máx. ${duracionMs(l.max)} · ${plural(l.n, "alerta", "alertas")}`
            : "Sin alertas con hora del ESP32"
        }
        estado={
          l.cumpleMeta === null
            ? null
            : l.cumpleMeta
              ? { tono: "ok", texto: `Cumple la meta (< ${meta})` }
              : { tono: "critico", texto: `Supera la meta (< ${meta})` }
        }
      />

      <Metrica
        titulo="Pérdida de mensajes"
        calculo="Números de secuencia (seq) que faltan dentro de un mismo arranque (boot), sumando eventos y latidos, sobre el total esperado. Deja fuera los últimos 15 s. Los eventos que el ESP32 no pudo enviar sin conexión van aparte, en no_enviados."
        valor={p ? porcentaje(p.tasa) : "—"}
        detalle={
          !p
            ? SIN_DATOS
            : p.esperados
              ? `${entero(p.perdidos)} de ${entero(p.esperados)} mensajes`
              : "Sin mensajes con seq"
        }
        estado={
          !p || !p.esperados
            ? null
            : p.perdidos === 0
              ? { tono: "ok", texto: "Sin pérdidas" }
              : {
                  tono: "aviso",
                  texto: plural(p.perdidos, "perdido", "perdidos"),
                }
        }
      />

      <Metrica
        titulo="Disponibilidad del nodo"
        calculo="Fracción de la ventana en la que el nodo contaba como conectado: cada latido lo cubre por 70 s, la misma regla con la que GET /estado lo marca desconectado. El ESP32 manda un latido cada 30 s. «Desde el primer latido» mide solo a partir del primer latido que llegó dentro de la ventana."
        valor={d ? porcentaje(d.fraccion) : "—"}
        detalle={
          !d
            ? SIN_DATOS
            : d.latidos
              ? `${porcentaje(d.fraccionDesdePrimero)} desde el primer latido · ${plural(d.latidos, "latido", "latidos")}`
              : "Ningún latido en la ventana"
        }
        estado={
          !d
            ? null
            : !d.latidos
              ? { tono: "critico", texto: "Nodo sin conexión" }
              : d.cortes.length === 0
                ? { tono: "ok", texto: "Sin cortes" }
                : {
                    tono: "aviso",
                    texto: `${plural(d.cortes.length, "corte", "cortes")} · ${duracionLarga(tiempoCaido)}`,
                  }
        }
      />

      <Metrica
        titulo="Eventos por sensor"
        calculo="Conteo de alertas (leves y críticas) por sensor en la ventana, y su ritmo por hora. Un sensor con muchas más activaciones que los demás puede estar mal calibrado o con ruido."
        valor={entero(e.total)}
        detalle={
          e.total
            ? `${decimal(e.total / e.horas)} por hora · ${plural(
                SENSORES.reduce((s, k) => s + e.porSensor[k].critico, 0),
                "crítico",
                "críticos"
              )}`
            : "Ningún sensor se activó"
        }
      >
        {e.total > 0 && <BarraSegmentada metricas={m} />}
      </Metrica>

      <Metrica
        titulo="Tasa de falsas alarmas"
        calculo="Alertas marcadas como falsas desde la tabla de eventos (requiere el PIN) sobre el total de alertas de la ventana."
        valor={porcentaje(f.tasa)}
        detalle={
          f.alertas
            ? `${entero(f.falsas)} de ${plural(f.alertas, "alerta", "alertas")}`
            : "Sin alertas en la ventana"
        }
      />

      <Metrica
        titulo="Calidad del enlace"
        calculo="RSSI promedio del Wi-Fi que reporta el ESP32 en cada latido. Bandas: −67 dBm o más es buena, hasta −80 dBm aceptable, por debajo débil."
        valor={w && w.n ? `${decimal(w.media)} dBm` : "—"}
        detalle={
          !w
            ? SIN_DATOS
            : w.n
              ? `Mín. ${w.min} · máx. ${w.max} dBm`
              : "Sin lecturas de RSSI"
        }
        estado={
          !w
            ? null
            : w.calidad === "buena"
              ? { tono: "ok", texto: "Buena" }
              : w.calidad === "aceptable"
                ? { tono: "aviso", texto: "Aceptable" }
                : w.calidad === "debil"
                  ? { tono: "critico", texto: "Débil" }
                  : null
        }
      />
    </div>
  )
}

/** Barra fina con la parte de cada sensor. Los números exactos están en la tabla del gráfico. */
function BarraSegmentada({ metricas: m }: { metricas: Metricas }) {
  const partes = SENSORES.map((s, i) => ({
    s,
    n: m.eventos.porSensor[s].total,
    color: `var(--chart-${i + 1})`,
  })).filter((p) => p.n > 0)
  return (
    <div className="mt-auto flex flex-col gap-2 pt-1">
      <div
        className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={partes
          .map((p) => `${NOMBRE_SENSOR[p.s]}: ${p.n}`)
          .join(", ")}
      >
        {partes.map((p) => (
          <div
            key={p.s}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ flexGrow: p.n, background: p.color }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {partes.map((p) => (
          <span key={p.s} className="inline-flex items-center gap-1.5">
            <span
              className="size-2 rounded-[2px]"
              style={{ background: p.color }}
              aria-hidden
            />
            {NOMBRE_SENSOR[p.s]} {entero(p.n)}
          </span>
        ))}
      </div>
    </div>
  )
}
