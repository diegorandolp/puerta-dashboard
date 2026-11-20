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
import { PanelComandos } from "@/components/panel-comandos"
import { TablaEventos } from "@/components/tabla-eventos"
import { TarjetasMetricas } from "@/components/tarjetas-metricas"
import {
  useAhora,
  useDatos,
  type DatosVentana,
  type Ventana,
} from "@/hooks/use-datos"
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
        <h2 className="text-sm font-medium tracking-tight">{titulo}</h2>
        {detalle && (
          <p className="text-xs text-muted-foreground tabular-nums">
            {detalle}
          </p>
        )}
      </div>
      {children}
    </section>
  )
}

export function App() {
  const [ventana, setVentana] = useState<Ventana>("1h")
  const [pin, setPin] = useState("")
  const ahora = useAhora()
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
    ? `${horaCorta(datos.desdeMs)} a ${horaCorta(datos.hastaMs)} (Lima)`
    : null

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-svh">
        <Encabezado
          estado={estado}
          ventana={ventana}
          setVentana={setVentana}
          cargando={cargando}
          actualizado={actualizado}
          ahora={ahora}
          onActualizar={actualizar}
        />

        <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 pt-6 pb-12 sm:px-6">
          <Avisos
            estado={estado}
            datos={datos}
            errorEstado={errorEstado}
            errorDatos={errorDatos}
            ahora={ahora}
          />

          <Seccion titulo="Estado">
            <EstadoActual estado={estado} ahora={ahora} />
          </Seccion>

          <Seccion titulo="Métricas de desempeño" detalle={rango}>
            <TarjetasMetricas metricas={metricas} />
          </Seccion>

          {metricas && (
            <Seccion titulo="Series de tiempo">
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
        </main>

        <Toaster position="bottom-right" />
      </div>
    </TooltipProvider>
  )
}

export default App
