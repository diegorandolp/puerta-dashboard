import { useMemo, useState } from "react"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Avisos } from "@/components/avisos"
import { Encabezado } from "@/components/encabezado"
import { EstadoActual } from "@/components/estado-actual"
import {
  GraficoDisponibilidad,
  GraficoEventos,
  GraficoGas,
  GraficoLatencia,
  GraficoRssi,
} from "@/components/graficos"
import { Nieve, Pino } from "@/components/navidad"
import { PanelComandos } from "@/components/panel-comandos"
import { TablaEventos } from "@/components/tabla-eventos"
import { TarjetasMetricas } from "@/components/tarjetas-metricas"
import {
  useAhora,
  useDatos,
  VENTANAS,
  type DatosVentana,
  type Ventana,
} from "@/hooks/use-datos"
import { useNieve } from "@/hooks/use-nieve"
import { horaCorta } from "@/lib/formato"
import { calcularMetricas } from "@/lib/metricas"

const masAntiguo = (xs: { timestamp: string }[]) =>
  xs.reduce((min, x) => Math.min(min, Date.parse(x.timestamp)), Infinity)

/**
 * Si una consulta se cortó por el tope (o la Lambda aún no acepta ?desde=), faltan sus
 * mensajes más antiguos: los eventos solo están completos desde el más antiguo que llegó, y
 * la pérdida solo se puede medir desde donde están completos eventos y latidos a la vez.
 */
function tramosCompletos(d: DatosVentana) {
  let desdeEventosMs = d.desdeMs
  if ((d.eventosTruncado || !d.eventosConDesde) && d.eventos.length)
    desdeEventosMs = Math.max(d.desdeMs, masAntiguo(d.eventos))
  let desdeCompletoMs = desdeEventosMs
  if (d.latidosTruncado && d.latidos?.length)
    desdeCompletoMs = Math.max(desdeCompletoMs, masAntiguo(d.latidos))
  return { desdeEventosMs, desdeCompletoMs }
}

function Seccion({
  titulo,
  detalle,
  children,
}: {
  titulo: string
  detalle?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold tracking-tight">{titulo}</h2>
        {detalle && <p className="text-xs text-muted-foreground">{detalle}</p>}
      </div>
      {children}
    </section>
  )
}

export function App() {
  const [ventana, setVentana] = useState<Ventana>("1h")
  const [pin, setPin] = useState("")
  const ahora = useAhora()
  const [nieve, setNieve] = useNieve()
  const {
    estado,
    errorEstado,
    datos,
    errorDatos,
    cargando,
    actualizado,
    actualizar,
    refrescarEstado,
    marcarLocal,
  } = useDatos(ventana)

  const metricas = useMemo(
    () =>
      datos
        ? calcularMetricas(datos.eventos, datos.latidos, {
            desdeMs: datos.desdeMs,
            hastaMs: datos.hastaMs,
            ...tramosCompletos(datos),
          })
        : null,
    [datos]
  )

  const rango = datos
    ? `${VENTANAS[ventana].etiqueta}: ${horaCorta(datos.desdeMs)} a ${horaCorta(datos.hastaMs)}, hora de Lima`
    : null

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative isolate min-h-svh">
        <Nieve activa={nieve} />
        <Encabezado
          estado={estado}
          ventana={ventana}
          setVentana={setVentana}
          cargando={cargando}
          actualizado={actualizado}
          ahora={ahora}
          onActualizar={actualizar}
          nieve={nieve}
          setNieve={setNieve}
        />

        <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6">
          <Avisos
            estado={estado}
            datos={datos}
            errorEstado={errorEstado}
            errorDatos={errorDatos}
            ahora={ahora}
          />

          <Seccion titulo="Estado actual" detalle="GET /estado, cada 10 s">
            <EstadoActual estado={estado} ahora={ahora} />
          </Seccion>

          <Seccion titulo="Métricas de desempeño" detalle={rango}>
            <TarjetasMetricas
              metricas={metricas}
              faltaLatidos={datos?.faltaLatidos ?? null}
            />
          </Seccion>

          {metricas && (
            <Seccion
              titulo="Series de tiempo"
              detalle="Pasen el cursor sobre un gráfico para ver cada valor"
            >
              <div className="grid gap-3 lg:grid-cols-2">
                <GraficoLatencia m={metricas} />
                <GraficoDisponibilidad m={metricas} />
                <GraficoEventos m={metricas} />
                <GraficoRssi m={metricas} latidos={datos?.latidos ?? null} />
                <GraficoGas m={metricas} latidos={datos?.latidos ?? null} />
              </div>
            </Seccion>
          )}

          <div className="grid items-start gap-3 xl:grid-cols-3">
            <TablaEventos
              className="xl:col-span-2"
              eventos={datos?.eventos ?? null}
              pin={pin}
              setPin={setPin}
              onMarcado={marcarLocal}
            />
            <PanelComandos
              className="xl:sticky xl:top-20"
              estado={estado}
              pin={pin}
              setPin={setPin}
              onEnviado={() => setTimeout(refrescarEstado, 2500)}
            />
          </div>

          <footer className="pb-4 text-center text-xs text-muted-foreground">
            <div
              className="mb-2 flex items-center justify-center gap-2 text-festivo-oro"
              aria-hidden
            >
              <Pino className="h-5" />
              <span className="font-medium">Felices fiestas</span>
              <Pino className="h-5" />
            </div>
            Proyecto 2 · CS5055 Internet de las Cosas · UTEC. Las métricas se
            calculan en el navegador con los datos de DynamoDB.
          </footer>
        </main>

        <Toaster position="bottom-right" />
      </div>
    </TooltipProvider>
  )
}

export default App
