import { CloudOff, Flame, Info, Siren, WifiOff } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CONFIG } from "@/config"
import type { DatosVentana } from "@/hooks/use-datos"
import { fechaHora, haceCuanto } from "@/lib/formato"
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
  if (datos?.faltaLatidos === "ruta")
    faltas.push("la ruta GET /latidos (Lambda consultarPuerta)")
  if (datos?.faltaLatidos === "tabla")
    faltas.push("la variable TABLA_LATIDOS en consultarPuerta")
  if (datos && !datos.eventosConDesde)
    faltas.push(
      "el parámetro ?desde= de GET /eventos (se usan solo los últimos 100 eventos)"
    )

  const avisos = [
    conectado && estado?.alarma && (
      <Alert key="alarma" variant="destructive" className="border-critico/40">
        <Siren />
        <AlertTitle>La alarma está sonando</AlertTitle>
        <AlertDescription>
          El buzzer del nodo está activo. Se puede silenciar desde Comandos.
        </AlertDescription>
      </Alert>
    ),
    humo && (
      <Alert key="humo" variant="destructive" className="border-critico/40">
        <Flame />
        <AlertTitle>Humo detectado</AlertTitle>
        <AlertDescription>
          El MQ-2 marca {estado?.gas}, sobre el umbral de {CONFIG.GAS_ALARMA}.
          La puerta queda destrabada para poder salir.
        </AlertDescription>
      </Alert>
    ),
    estado && !conectado && (
      <Alert key="caido">
        <WifiOff />
        <AlertTitle>El nodo no está enviando latidos</AlertTitle>
        <AlertDescription>
          {ultima
            ? `El último llegó el ${fechaHora(ultima)} (${haceCuanto(ultima, ahora)}). El estado de abajo es el último conocido.`
            : "Todavía no llegó ningún latido."}
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
        <AlertTitle>Falta desplegar parte del backend en AWS</AlertTitle>
        <AlertDescription>
          Falta {faltas.join(" y ")}. Las métricas que dependen de eso quedan
          incompletas. Los pasos están en aws/README.md.
        </AlertDescription>
      </Alert>
    ),
    datos && (datos.eventosTruncado || datos.latidosTruncado) && (
      <Alert key="tope">
        <Info />
        <AlertTitle>
          La ventana tiene más datos de los que trae la API
        </AlertTitle>
        <AlertDescription>
          Se dejaron fuera los más antiguos. Elijan una ventana más corta para
          medir todo el periodo.
        </AlertDescription>
      </Alert>
    ),
  ].filter(Boolean)

  if (!avisos.length) return null
  return <div className="grid gap-3">{avisos}</div>
}
