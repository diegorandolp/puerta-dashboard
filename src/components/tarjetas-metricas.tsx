import { Info } from "lucide-react"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Indicador, type Tono } from "@/components/estado-indicador"
import { CONFIG } from "@/config"
import {
  decimal,
  duracionLarga,
  duracionMs,
  entero,
  NOMBRE_SENSOR,
  porcentaje,
} from "@/lib/formato"
import { SENSORES, type Metricas } from "@/lib/metricas"

interface Props {
  metricas: Metricas | null
  faltaLatidos: "ruta" | "tabla" | null
}

const SIN_LATIDOS = {
  ruta: "Falta la ruta GET /latidos en API Gateway",
  tabla: "Falta TABLA_LATIDOS en la Lambda consultarPuerta",
}

function Metrica({
  numero,
  titulo,
  calculo,
  valor,
  detalle,
  estado,
  children,
}: {
  numero: number
  titulo: string
  calculo: string
  valor: string
  detalle: React.ReactNode
  estado: { tono: Tono; texto: string } | null
  children?: React.ReactNode
}) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground/70">
            {numero}
          </span>
          {titulo}
        </CardDescription>
        <CardAction>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={`Cómo se calcula: ${titulo}`}
              >
                <Info className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-72 text-pretty">
              {calculo}
            </TooltipContent>
          </Tooltip>
        </CardAction>
        <CardTitle className="text-3xl font-semibold tracking-tight">
          {valor}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 text-xs text-muted-foreground">
        <div>{detalle}</div>
        {children}
      </CardContent>
      {estado && (
        <CardFooter className="bg-transparent py-2.5">
          <Indicador tono={estado.tono}>{estado.texto}</Indicador>
        </CardFooter>
      )}
    </Card>
  )
}

export function TarjetasMetricas({ metricas: m, faltaLatidos }: Props) {
  if (!m) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[196px] rounded-xl" />
        ))}
      </div>
    )
  }

  const sinLatidos = faltaLatidos
    ? { tono: "neutro" as const, texto: SIN_LATIDOS[faltaLatidos] }
    : null
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

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <Metrica
        numero={1}
        titulo="Latencia de alerta (p95)"
        calculo="Hora de recepción en IoT Core, que agrega la regla, menos la hora del evento en el ESP32 (ts_evento, por NTP). Solo cuenta las alertas que manda el ESP32. Percentil 95 por rango más cercano."
        valor={duracionMs(l.p95)}
        detalle={
          l.n ? (
            <>
              Media {duracionMs(l.media)} · mediana {duracionMs(l.p50)} · máx.{" "}
              {duracionMs(l.max)} · {entero(l.n)} alertas
            </>
          ) : (
            "No hay alertas con hora del ESP32 en esta ventana"
          )
        }
        estado={
          l.cumpleMeta === null
            ? { tono: "neutro", texto: `Meta: p95 menor a ${meta}` }
            : l.cumpleMeta
              ? { tono: "ok", texto: `Cumple la meta de p95 menor a ${meta}` }
              : { tono: "critico", texto: `Supera la meta de ${meta}` }
        }
      />

      <Metrica
        numero={2}
        titulo="Pérdida de mensajes"
        calculo="Números de secuencia (seq) que faltan dentro de un mismo arranque (boot), sumando eventos y latidos, sobre el total esperado. Deja fuera los últimos 15 s. Los eventos que el ESP32 no pudo enviar sin conexión van aparte, en no_enviados."
        valor={p ? porcentaje(p.tasa) : "—"}
        detalle={
          p ? (
            p.esperados ? (
              <>
                {entero(p.perdidos)} de {entero(p.esperados)} mensajes ·{" "}
                {p.arranques} {p.arranques === 1 ? "arranque" : "arranques"}
              </>
            ) : (
              "No llegaron mensajes con seq en esta ventana"
            )
          ) : (
            "Necesita el historial de latidos, porque comparten el contador seq"
          )
        }
        estado={
          !p
            ? sinLatidos
            : !p.esperados
              ? null
              : p.perdidos === 0
                ? { tono: "ok", texto: "Sin mensajes perdidos" }
                : {
                    tono: "aviso",
                    texto: `${entero(p.perdidos)} ${p.perdidos === 1 ? "mensaje perdido" : "mensajes perdidos"}`,
                  }
        }
      />

      <Metrica
        numero={3}
        titulo="Disponibilidad del nodo"
        calculo="Fracción de la ventana en la que el nodo contaba como conectado: cada latido lo cubre por 70 s, la misma regla con la que GET /estado lo marca desconectado. El ESP32 manda un latido cada 30 s."
        valor={d ? porcentaje(d.fraccion) : "—"}
        detalle={
          d ? (
            d.latidos ? (
              <>
                Desde el primer latido: {porcentaje(d.fraccionDesdePrimero)} ·{" "}
                {entero(d.latidos)} latidos ({entero(d.esperados)} esperados en
                la ventana)
              </>
            ) : (
              "No llegó ningún latido en esta ventana"
            )
          ) : (
            "Necesita el historial de latidos"
          )
        }
        estado={
          !d
            ? sinLatidos
            : !d.latidos
              ? { tono: "critico", texto: "Nodo apagado o sin conexión" }
              : d.cortes.length === 0
                ? { tono: "ok", texto: "Sin cortes desde el primer latido" }
                : {
                    tono: "aviso",
                    texto: `${d.cortes.length} ${d.cortes.length === 1 ? "corte" : "cortes"}, ${duracionLarga(tiempoCaido)} en total`,
                  }
        }
      />

      <Metrica
        numero={4}
        titulo="Eventos por sensor"
        calculo="Conteo de alertas (leves y críticas) por sensor en la ventana, y su ritmo por hora. Un sensor con muchas más activaciones que los demás puede estar mal calibrado o con ruido."
        valor={entero(e.total)}
        detalle={
          e.total ? (
            <>
              {decimal(e.total / e.horas)} por hora ·{" "}
              {entero(SENSORES.reduce((s, k) => s + e.porSensor[k].critico, 0))}{" "}
              críticos
            </>
          ) : (
            "Ningún sensor se activó en esta ventana"
          )
        }
        estado={
          e.masActivo
            ? {
                tono: "neutro",
                texto: `Más activo: ${NOMBRE_SENSOR[e.masActivo].toLowerCase()} (${entero(e.porSensor[e.masActivo].total)})`,
              }
            : null
        }
      >
        {e.total > 0 && <BarraSegmentada metricas={m} />}
      </Metrica>

      <Metrica
        numero={5}
        titulo="Tasa de falsas alarmas"
        calculo="Alertas marcadas como falsas desde la tabla de eventos (requiere el PIN) sobre el total de alertas de la ventana."
        valor={porcentaje(f.tasa)}
        detalle={
          f.alertas ? (
            <>
              {entero(f.falsas)} de {entero(f.alertas)} alertas ·{" "}
              {entero(f.criticasFalsas)} de {entero(f.criticas)} críticas
            </>
          ) : (
            "No hay alertas en esta ventana"
          )
        }
        estado={
          f.alertas
            ? { tono: "neutro", texto: "Se marcan en la tabla de eventos" }
            : null
        }
      />

      <Metrica
        numero={6}
        titulo="Calidad del enlace"
        calculo="RSSI promedio del Wi-Fi que reporta el ESP32 en cada latido. Bandas: −67 dBm o más es buena, hasta −80 dBm aceptable, por debajo débil."
        valor={w && w.n ? `${decimal(w.media)} dBm` : "—"}
        detalle={
          w ? (
            w.n ? (
              <>
                Mín. {w.min} dBm · máx. {w.max} dBm · {entero(w.n)} lecturas
              </>
            ) : (
              "Sin lecturas de RSSI en esta ventana"
            )
          ) : (
            "Necesita el historial de latidos"
          )
        }
        estado={
          !w
            ? sinLatidos
            : w.calidad === "buena"
              ? { tono: "ok", texto: "Señal buena" }
              : w.calidad === "aceptable"
                ? { tono: "aviso", texto: "Señal aceptable" }
                : w.calidad === "debil"
                  ? { tono: "critico", texto: "Señal débil" }
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
    <div className="mt-auto flex flex-col gap-2">
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
      <div className="flex flex-wrap gap-x-3 gap-y-1">
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
