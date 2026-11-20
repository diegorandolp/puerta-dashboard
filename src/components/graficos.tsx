import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CONFIG } from "@/config"
import {
  decimal,
  duracionLarga,
  duracionMs,
  entero,
  hora,
  horaCorta,
  NOMBRE_SENSOR,
  ORIGEN_SENSOR,
} from "@/lib/formato"
import { escala, SENSORES, serieLatidos, type Metricas } from "@/lib/metricas"
import type { Latido } from "@/lib/tipos"

const MIN = 60_000
const HORA = 60 * MIN
const OFFSET_LIMA = -5 * HORA // Perú no tiene horario de verano

/** Marcas del eje de tiempo en horas redondas de Lima. */
function marcasTiempo(desde: number, hasta: number) {
  const paso = { "1h": 10 * MIN, "6h": HORA, "24h": 4 * HORA }[
    escala(hasta - desde)
  ]
  const marcas: number[] = []
  let t = Math.ceil((desde + OFFSET_LIMA) / paso) * paso - OFFSET_LIMA
  for (; t <= hasta; t += paso) marcas.push(t)
  return marcas
}

const ejeX = (m: Metricas) => ({
  dataKey: "t",
  type: "number" as const,
  scale: "time" as const,
  domain: [m.desdeMs, m.hastaMs],
  ticks: marcasTiempo(m.desdeMs, m.hastaMs),
  tickFormatter: (t: number) => horaCorta(t),
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
})

const ejeY = { tickLine: false, axisLine: false, width: 44, tickMargin: 4 }
const rejilla = <CartesianGrid vertical={false} stroke="var(--border)" />

/** Contenido del tooltip de una serie: hora y valor con unidad, en tinta de texto. */
function TooltipSerie({
  active,
  payload,
  etiqueta,
  valor,
  titulo,
}: {
  active?: boolean
  payload?: { payload: Record<string, number> }[]
  etiqueta: string
  valor: (p: Record<string, number>) => string
  titulo?: (p: Record<string, number>) => string
}) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="grid min-w-36 gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{titulo ? titulo(p) : hora(p.t)}</div>
      <div className="flex justify-between gap-4">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2.5 rounded-[2px] bg-chart-1" aria-hidden />
          {etiqueta}
        </span>
        <span className="font-mono font-medium tabular-nums">{valor(p)}</span>
      </div>
    </div>
  )
}

function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-56 items-center justify-center rounded-lg border border-dashed text-center text-xs text-muted-foreground">
      {children}
    </div>
  )
}

function Grafico({
  titulo,
  descripcion,
  children,
  className,
}: {
  titulo: string
  descripcion: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <CardDescription className="text-xs">{descripcion}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

const config1: ChartConfig = { v: { label: "Valor", color: "var(--chart-1)" } }

// ------------------------------------------------------------------ Latencia

export function GraficoLatencia({ m }: { m: Metricas }) {
  const l = m.latencia
  const meta = CONFIG.META_LATENCIA_P95_MS
  const metaVisible = l.n > 0 && l.max >= meta / 2
  return (
    <Grafico
      titulo="Latencia de cada alerta"
      descripcion={
        <>
          Recepción en IoT Core menos hora del evento en el ESP32. La línea
          marca el p95
          {metaVisible
            ? " y la meta de 2 s"
            : `; la meta de ${duracionMs(meta)} queda fuera de escala`}
          .
        </>
      }
    >
      {l.n === 0 ? (
        <Vacio>No hay alertas con hora del ESP32 en esta ventana</Vacio>
      ) : (
        <ChartContainer config={config1} className="aspect-auto h-56 w-full">
          <ScatterChart
            accessibilityLayer
            margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
          >
            {rejilla}
            <XAxis {...ejeX(m)} />
            <YAxis
              {...ejeY}
              width={60}
              dataKey="ms"
              type="number"
              domain={[
                0,
                metaVisible
                  ? Math.ceil((Math.max(meta, l.max) * 1.05) / 500) * 500
                  : "auto",
              ]}
              tickFormatter={(v: number) => duracionMs(v)}
            />
            <ChartTooltip
              cursor={false}
              content={
                <TooltipSerie
                  etiqueta="Latencia"
                  valor={(p) => duracionMs(p.ms)}
                />
              }
            />
            <ReferenceLine
              y={l.p95}
              stroke="var(--muted-foreground)"
              strokeDasharray="0"
              label={{
                value: `p95 ${duracionMs(l.p95)}`,
                position: "insideBottomLeft",
                fill: "var(--muted-foreground)",
                fontSize: 11,
              }}
            />
            {metaVisible && (
              <ReferenceLine
                y={meta}
                stroke="var(--critico)"
                label={{
                  value: "meta 2 s",
                  position: "insideTopLeft",
                  fill: "var(--muted-foreground)",
                  fontSize: 11,
                }}
              />
            )}
            <Scatter
              data={l.serie}
              fill="var(--color-v)"
              stroke="var(--card)"
              strokeWidth={2}
              shape="circle"
              isAnimationActive={false}
            />
          </ScatterChart>
        </ChartContainer>
      )}
    </Grafico>
  )
}

// ------------------------------------------------------------------ Disponibilidad

export function GraficoDisponibilidad({ m }: { m: Metricas }) {
  const d = m.disponibilidad
  return (
    <Grafico
      titulo="Disponibilidad por intervalo"
      descripcion={
        d ? (
          <>
            Porcentaje de cada intervalo de {duracionLarga(d.intervaloMs)} en
            que el nodo contaba como conectado.
          </>
        ) : (
          "Necesita el historial de latidos (GET /latidos)."
        )
      }
    >
      {!d ? (
        <Vacio>Sin historial de latidos</Vacio>
      ) : (
        <ChartContainer config={config1} className="aspect-auto h-56 w-full">
          <BarChart
            accessibilityLayer
            data={d.serie}
            margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
            barCategoryGap={2}
          >
            {rejilla}
            <XAxis
              dataKey="t"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tickFormatter={(t: number) => horaCorta(t)}
            />
            <YAxis
              {...ejeY}
              domain={[0, 100]}
              ticks={[0, 50, 100]}
              tickFormatter={(v: number) => `${v} %`}
            />
            <ChartTooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
              content={
                <TooltipSerie
                  etiqueta="Disponible"
                  valor={(p) => `${decimal(p.pct)} %`}
                  titulo={(p) =>
                    `${horaCorta(p.t)} – ${horaCorta(p.t + d.intervaloMs)}`
                  }
                />
              }
            />
            <Bar
              dataKey="pct"
              fill="var(--color-v)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              isAnimationActive={false}
            />
          </BarChart>
        </ChartContainer>
      )}
    </Grafico>
  )
}

// ------------------------------------------------------------------ Eventos por sensor

const configSensores: ChartConfig = Object.fromEntries(
  SENSORES.map((s, i) => [
    s,
    { label: NOMBRE_SENSOR[s], color: `var(--chart-${i + 1})` },
  ])
)

export function GraficoEventos({ m }: { m: Metricas }) {
  const e = m.eventos
  const activos = SENSORES.filter((s) => e.porSensor[s].total > 0)
  return (
    <Grafico
      titulo="Eventos por sensor"
      descripcion={
        <>
          Alertas leves y críticas apiladas por sensor, en intervalos de{" "}
          {duracionLarga(e.intervaloMs)}.
        </>
      }
      className="lg:col-span-2"
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,380px)]">
        {e.total === 0 ? (
          <Vacio>Ningún sensor se activó en esta ventana</Vacio>
        ) : (
          <ChartContainer
            config={configSensores}
            className="aspect-auto h-64 w-full"
          >
            <BarChart
              accessibilityLayer
              data={e.serie}
              margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
              barCategoryGap={2}
            >
              {rejilla}
              <XAxis
                dataKey="t"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={(t: number) => horaCorta(t)}
              />
              <YAxis {...ejeY} allowDecimals={false} />
              <ChartTooltip
                cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                content={<TooltipSensores intervaloMs={e.intervaloMs} />}
              />
              <ChartLegend content={<ChartLegendContent />} itemSorter={null} />
              {activos.map((s) => (
                <Bar
                  key={s}
                  dataKey={s}
                  stackId="a"
                  fill={`var(--color-${s})`}
                  stroke="var(--card)"
                  strokeWidth={2}
                  maxBarSize={24}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ChartContainer>
        )}
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead>Sensor</TableHead>
              <TableHead className="text-right">Leves</TableHead>
              <TableHead className="text-right">Críticos</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Por hora</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="tabular-nums">
            {SENSORES.map((s, i) => (
              <TableRow key={s}>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-[2px]"
                      style={{ background: `var(--chart-${i + 1})` }}
                      aria-hidden
                    />
                    {NOMBRE_SENSOR[s]}
                    <span className="text-muted-foreground">
                      {ORIGEN_SENSOR[s]}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {entero(e.porSensor[s].leve)}
                </TableCell>
                <TableCell className="text-right">
                  {entero(e.porSensor[s].critico)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {entero(e.porSensor[s].total)}
                </TableCell>
                <TableCell className="text-right">
                  {decimal(e.porSensor[s].porHora)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Grafico>
  )
}

function TooltipSensores({
  active,
  payload,
  intervaloMs,
}: {
  active?: boolean
  payload?: { dataKey: string; value: number; payload: { t: number } }[]
  intervaloMs: number
}) {
  if (!active || !payload?.length) return null
  const t = payload[0].payload.t
  const filas = payload.filter((p) => p.value > 0)
  return (
    <div className="grid min-w-40 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">
        {horaCorta(t)} – {horaCorta(t + intervaloMs)}
      </div>
      {filas.length === 0 && (
        <div className="text-muted-foreground">Sin eventos</div>
      )}
      {filas.map((p) => (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="size-2.5 rounded-[2px]"
              style={{ background: `var(--color-${p.dataKey})` }}
              aria-hidden
            />
            {NOMBRE_SENSOR[p.dataKey]}
          </span>
          <span className="font-mono font-medium tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ RSSI y gas

function GraficoLinea({
  m,
  latidos,
  campo,
  titulo,
  descripcion,
  etiqueta,
  unidad,
  dominio,
  referencias,
}: {
  m: Metricas
  latidos: Latido[] | null
  campo: "rssi" | "gas"
  titulo: string
  descripcion: React.ReactNode
  etiqueta: string
  unidad: string
  /** Límites del eje a partir del mínimo y el máximo de la serie, y el paso entre marcas. */
  dominio: (
    min: number,
    max: number
  ) => { desde: number; hasta: number; paso: number }
  referencias: {
    y: number
    texto: string
    color: string
    posicion?: "insideTopLeft" | "insideBottomLeft" | "insideTopRight"
  }[]
}) {
  const serie = latidos
    ? serieLatidos(latidos, campo, campo === "gas" ? "max" : "media")
    : []
  const valores = serie.map((p) => p.v)
  const eje = dominio(Math.min(...valores), Math.max(...valores))
  const marcas: number[] = []
  for (let v = eje.desde; v <= eje.hasta; v += eje.paso) marcas.push(v)
  return (
    <Grafico titulo={titulo} descripcion={descripcion}>
      {!latidos ? (
        <Vacio>Sin historial de latidos</Vacio>
      ) : serie.length === 0 ? (
        <Vacio>No llegaron latidos en esta ventana</Vacio>
      ) : (
        <ChartContainer config={config1} className="aspect-auto h-56 w-full">
          <LineChart
            accessibilityLayer
            data={serie}
            margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
          >
            {rejilla}
            <XAxis {...ejeX(m)} />
            <YAxis
              {...ejeY}
              domain={[eje.desde, eje.hasta]}
              ticks={marcas}
              tickFormatter={(v: number) => entero(v)}
            />
            <ChartTooltip
              cursor={{ stroke: "var(--border)" }}
              content={
                <TooltipSerie
                  etiqueta={etiqueta}
                  valor={(p) => `${entero(p.v)}${unidad}`}
                />
              }
            />
            {referencias.map((r) => (
              <ReferenceLine
                key={r.y}
                y={r.y}
                stroke={r.color}
                label={{
                  value: r.texto,
                  position: r.posicion ?? "insideTopLeft",
                  fill: "var(--muted-foreground)",
                  fontSize: 11,
                }}
              />
            ))}
            <Line
              dataKey="v"
              type="linear"
              stroke="var(--color-v)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      )}
    </Grafico>
  )
}

export function GraficoRssi({
  m,
  latidos,
}: {
  m: Metricas
  latidos: Latido[] | null
}) {
  return (
    <GraficoLinea
      m={m}
      latidos={latidos}
      campo="rssi"
      titulo="Señal Wi-Fi (RSSI)"
      descripcion="Lo que reporta el ESP32 en cada latido, en dBm. Más cerca de 0 es mejor."
      etiqueta="RSSI"
      unidad=" dBm"
      // Siempre se ven las dos bandas (−67 y −80)
      dominio={(min, max) => ({
        desde: Math.floor(Math.min(min, -90) / 10) * 10,
        hasta: Math.ceil(Math.max(max, -30) / 10) * 10,
        paso: 20,
      })}
      referencias={[
        { y: -67, texto: "buena desde −67", color: "var(--border)" },
        { y: -80, texto: "débil bajo −80", color: "var(--border)" },
      ]}
    />
  )
}

export function GraficoGas({
  m,
  latidos,
}: {
  m: Metricas
  latidos: Latido[] | null
}) {
  return (
    <GraficoLinea
      m={m}
      latidos={latidos}
      campo="gas"
      titulo="Humo y gas (MQ-2)"
      descripcion={`Lectura del ADC (0 a ${CONFIG.GAS_MAX}) en cada latido. Si se agrupa, se muestra el máximo de cada intervalo para no esconder un pico.`}
      etiqueta="Lectura"
      unidad=""
      // Siempre se ve el umbral de alarma
      dominio={(_, max) => ({
        desde: 0,
        hasta: Math.max(2000, Math.ceil((max * 1.05) / 500) * 500),
        paso: 500,
      })}
      referencias={[
        // Las dos líneas están cerca: una etiqueta arriba a la izquierda y la otra abajo a la derecha
        {
          y: CONFIG.GAS_ALARMA,
          texto: `alarma ${CONFIG.GAS_ALARMA}`,
          color: "var(--critico)",
          posicion: "insideBottomLeft",
        },
        {
          y: CONFIG.GAS_NORMAL,
          texto: `normal bajo ${CONFIG.GAS_NORMAL}`,
          color: "var(--border)",
          posicion: "insideTopRight",
        },
      ]}
    />
  )
}
