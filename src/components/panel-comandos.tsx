import { useState } from "react"
import {
  BellOff,
  DoorOpen,
  Loader2,
  ShieldCheck,
  ShieldOff,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Ayuda } from "@/components/ayuda"
import { CampoPin } from "@/components/campo-pin"
import { CONFIG } from "@/config"
import { enviarComando, ErrorApi } from "@/lib/api"
import type { Accion, Estado } from "@/lib/tipos"

const ACCIONES: {
  accion: Accion
  texto: string
  icono: LucideIcon
  hecho: string
}[] = [
  {
    accion: "abrir",
    texto: "Abrir puerta",
    icono: DoorOpen,
    hecho: "Orden de abrir enviada",
  },
  {
    accion: "armar",
    texto: "Armar",
    icono: ShieldCheck,
    hecho: "Orden de armar enviada",
  },
  {
    accion: "desarmar",
    texto: "Desarmar",
    icono: ShieldOff,
    hecho: "Orden de desarmar enviada",
  },
  {
    accion: "silenciar",
    texto: "Silenciar",
    icono: BellOff,
    hecho: "Orden de silenciar enviada",
  },
]

export function PanelComandos({
  estado,
  pin,
  setPin,
  onEnviado,
  className,
}: {
  estado: Estado | null
  pin: string
  setPin: (p: string) => void
  onEnviado: () => void
  className?: string
}) {
  const [enviando, setEnviando] = useState<Accion | null>(null)
  const desconectado = estado?.dispositivo === "desconectado"
  const pinCompleto = pin.length === CONFIG.PIN_LENGTH

  async function enviar(accion: Accion, hecho: string) {
    setEnviando(accion)
    try {
      await enviarComando(pin, accion)
      toast.success(
        hecho,
        desconectado
          ? { description: "El nodo está desconectado: la orden se perderá." }
          : undefined
      )
      onEnviado()
    } catch (e) {
      if (e instanceof ErrorApi && e.status === 401) {
        setPin("")
        toast.error("PIN incorrecto")
      } else {
        toast.error(
          e instanceof Error ? e.message : "No se pudo enviar la orden"
        )
      }
    } finally {
      setEnviando(null)
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="flex items-center justify-between gap-2">
        <CardTitle>Comandos</CardTitle>
        <Ayuda titulo="Comandos">
          Las mismas órdenes que la app, con el mismo PIN. El PIN solo queda en
          memoria mientras la página esté abierta. Silenciar apaga el buzzer de
          una intrusión y el del humo, pero no el de puerta abierta, que se
          detiene al cerrarla.
        </Ayuda>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2">
          <Label
            htmlFor="pin-comandos"
            className="text-xs text-muted-foreground"
          >
            PIN de la puerta
          </Label>
          <CampoPin
            id="pin-comandos"
            value={pin}
            onChange={setPin}
            disabled={enviando !== null}
          />
        </div>
        {desconectado && (
          <Alert>
            <TriangleAlert />
            <AlertDescription className="text-xs">
              Nodo desconectado: la orden no llegará.
            </AlertDescription>
          </Alert>
        )}
        <div className="grid grid-cols-2 gap-2">
          {ACCIONES.map(({ accion, texto, icono: Icono, hecho }) => (
            <Button
              key={accion}
              variant={accion === "abrir" ? "default" : "outline"}
              size="lg"
              className={accion === "abrir" ? "col-span-2" : undefined}
              disabled={!pinCompleto || enviando !== null}
              onClick={() => void enviar(accion, hecho)}
            >
              {enviando === accion ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Icono />
              )}
              {texto}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
