import { CloudOff, Flame, Info, Siren, WifiOff } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CONFIG } from "@/config"
import type { DatosVentana } from "@/hooks/use-datos"
import { haceCuanto } from "@/lib/formato"
import type { Estado } from "@/lib/tipos"

/** Avisos arriba de todo: alarma, humo, nodo caído, errores de la API y rutas que faltan en AWS. */
export function Avisos({
  estado,
  datos,
  errorEstado,
  errorDatos,
  ahora,
}: {
  estado: Estado | null
  datos: DatosVentana | null
  errorEstado: string | null
  errorDatos: string | null
  ahora: number
}) {
  const conectado = estado?.dispositivo === "conectado"
  const ultima = estado?.ultima_conexion
    ? Date.parse(estado.ultima_conexion)
    : null
  const humo =
    conectado &&
    typeof estado?.gas === "number" &&
    estado.gas >= CONFIG.GAS_ALARMA

  const faltas: string[] = []
  if (datos?.faltaLatidos === "ruta") faltas.push("la ruta GET /latidos")
  if (datos?.faltaLatidos === "tabla")
    faltas.push("TABLA_LATIDOS en consultarPuerta")
  if (datos && !datos.eventosConDesde)
    faltas.push("?desde= en GET /eventos (solo se ven los últimos 100)")

  const avisos = [
    conectado && estado?.alarma && (
      <Alert key="alarma" variant="destructive" className="border-critico/40">
        <Siren />
        <AlertTitle>La alarma está sonando</AlertTitle>
      </Alert>
    ),
    humo && (
      <Alert key="humo" variant="destructive" className="border-critico/40">
        <Flame />
        <AlertTitle>Humo detectado</AlertTitle>
        <AlertDescription>
          MQ-2 en {estado?.gas} (umbral {CONFIG.GAS_ALARMA}). La puerta queda
          destrabada.
        </AlertDescription>
      </Alert>
    ),
    estado && !conectado && (
      <Alert key="caido">
        <WifiOff />
        <AlertTitle>El nodo no envía latidos</AlertTitle>
        <AlertDescription>
          {ultima
            ? `Último latido ${haceCuanto(ultima, ahora)}. Se muestra el último estado conocido.`
            : "Todavía no llegó ninguno."}
        </AlertDescription>
      </Alert>
    ),
    (errorEstado || errorDatos) && (
      <Alert key="error" variant="destructive">
        <CloudOff />
        <AlertTitle>No se pudo consultar la API</AlertTitle>
        <AlertDescription>
          {errorEstado ?? errorDatos}. Se reintenta solo.
        </AlertDescription>
      </Alert>
    ),
    faltas.length > 0 && (
      <Alert key="faltas">
        <Info />
        <AlertTitle>Backend incompleto en AWS</AlertTitle>
        <AlertDescription>
          Falta {faltas.join(" y ")}. Las métricas que dependen de eso quedan
          incompletas.
        </AlertDescription>
      </Alert>
    ),
    datos && (datos.eventosTruncado || datos.latidosTruncado) && (
      <Alert key="tope">
        <Info />
        <AlertTitle>Ventana incompleta</AlertTitle>
        <AlertDescription>
          La API no trae todo el periodo. Elige una ventana más corta.
        </AlertDescription>
      </Alert>
    ),
  ].filter(Boolean)

  if (!avisos.length) return null
  return <div className="grid gap-3">{avisos}</div>
}
