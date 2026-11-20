import { useMemo, useState } from "react"
import { Flag, FlagOff, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Ayuda } from "@/components/ayuda"
import { CampoPin } from "@/components/campo-pin"
import { CONFIG } from "@/config"
import { ErrorApi, marcarFalsaAlarma, SIN_RESPUESTA } from "@/lib/api"
import {
  duracionMs,
  fechaHora,
  hora,
  NOMBRE_EVENTO,
  NOMBRE_SENSOR,
} from "@/lib/formato"
import { esAlerta, latenciaDe } from "@/lib/metricas"
import type { Evento } from "@/lib/tipos"

type Filtro = "todos" | "alertas" | "criticos"
const PAGINA = 20

function NivelBadge({ nivel }: { nivel: string }) {
  if (nivel === "critico") return <Badge variant="destructive">Crítico</Badge>
  if (nivel === "leve") return <Badge variant="outline">Leve</Badge>
  if (nivel === "advertencia")
    return (
      <Badge variant="outline" className="gap-1.5">
        <span className="size-1.5 rounded-full bg-aviso" aria-hidden />
        Advertencia
      </Badge>
    )
  return <Badge variant="secondary">Info</Badge>
}

export function TablaEventos({
  eventos,
  pin,
  setPin,
  onMarcado,
  className,
}: {
  eventos: Evento[] | null
  pin: string
  setPin: (p: string) => void
  onMarcado: (timestamp: string, falsa: boolean) => void
  className?: string
}) {
  const [filtro, setFiltro] = useState<Filtro>("todos")
  const [mostrar, setMostrar] = useState(PAGINA)
  const [elegido, setElegido] = useState<Evento | null>(null)
  const [enviando, setEnviando] = useState(false)

  const filas = useMemo(() => {
    const lista = eventos ?? []
    if (filtro === "alertas") return lista.filter(esAlerta)
    if (filtro === "criticos") return lista.filter((e) => e.nivel === "critico")
    return lista
  }, [eventos, filtro])

  async function confirmar() {
    if (!elegido || pin.length !== CONFIG.PIN_LENGTH) return
    const falsa = !elegido.falsa
    setEnviando(true)
    try {
      await marcarFalsaAlarma(pin, elegido.timestamp, falsa)
      onMarcado(elegido.timestamp, falsa)
      toast.success(
        falsa
          ? "Alerta marcada como falsa"
          : "Se quitó la marca de falsa alarma"
      )
      setElegido(null)
    } catch (e) {
      if (e instanceof ErrorApi && e.status === 401) {
        setPin("")
        toast.error("PIN incorrecto")
      } else if (
        e instanceof ErrorApi &&
        (e.status === SIN_RESPUESTA || e.message === "Not Found")
      ) {
        // Una ruta inexistente llega como error de red (API Gateway responde 404 sin CORS)
        toast.error("Sin respuesta de POST /falsa_alarma", {
          description: "Puede que la ruta todavía no esté desplegada en AWS.",
        })
      } else {
        toast.error(
          e instanceof Error ? e.message : "No se pudo marcar la alerta"
        )
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex items-center gap-2">
          <CardTitle>Historial de eventos</CardTitle>
          <Ayuda titulo="Historial de eventos">
            Del más reciente al más antiguo. Las alertas del ESP32 se pueden
            marcar como falsas, y entonces cuentan en la tasa de falsas
            alarmas.
          </Ayuda>
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={filtro}
          onValueChange={(v) => {
            if (v) {
              setFiltro(v as Filtro)
              setMostrar(PAGINA)
            }
          }}
          aria-label="Filtrar eventos"
        >
          <ToggleGroupItem value="todos">Todos</ToggleGroupItem>
          <ToggleGroupItem value="alertas">Alertas</ToggleGroupItem>
          <ToggleGroupItem value="criticos">Críticos</ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent>
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Hora</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead className="sm:w-24">Nivel</TableHead>
              <TableHead className="hidden lg:table-cell">Detalle</TableHead>
              <TableHead className="hidden w-20 text-right sm:table-cell">
                Latencia
              </TableHead>
              <TableHead className="hidden w-14 text-right md:table-cell">
                Seq
              </TableHead>
              <TableHead className="w-10 text-right sm:w-28">
                <span className="sr-only">Falsa alarma</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {eventos === null && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  Cargando eventos…
                </TableCell>
              </TableRow>
            )}
            {eventos !== null && filas.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No hay eventos en esta ventana
                </TableCell>
              </TableRow>
            )}
            {filas.slice(0, mostrar).map((e) => {
              const lat = latenciaDe(e)
              return (
                <TableRow
                  key={e.timestamp}
                  className={cn(e.falsa && "text-muted-foreground")}
                >
                  <TableCell className="font-mono tabular-nums">
                    {hora(e.timestamp)}
                  </TableCell>
                  <TableCell>
                    <div
                      className={cn(
                        "font-medium",
                        e.falsa && "line-through decoration-muted-foreground/60"
                      )}
                    >
                      {NOMBRE_EVENTO[e.tipo] ?? e.tipo}
                    </div>
                    {e.con && (
                      <div className="text-muted-foreground">
                        con {(NOMBRE_SENSOR[e.con] ?? e.con).toLowerCase()}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <NivelBadge nivel={e.nivel} />
                  </TableCell>
                  <TableCell
                    className="hidden max-w-72 truncate text-muted-foreground lg:table-cell"
                    title={e.mensaje}
                  >
                    {e.mensaje}
                  </TableCell>
                  <TableCell className="hidden text-right font-mono tabular-nums sm:table-cell">
                    {lat === null ? "—" : duracionMs(lat)}
                  </TableCell>
                  <TableCell className="hidden text-right font-mono text-muted-foreground tabular-nums md:table-cell">
                    {e.seq ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {esAlerta(e) && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setElegido(e)}
                        aria-label={
                          e.falsa
                            ? "Quitar la marca de falsa alarma"
                            : "Marcar como falsa alarma"
                        }
                      >
                        {e.falsa ? <FlagOff /> : <Flag />}
                        <span className="hidden sm:inline">
                          {e.falsa ? "Desmarcar" : "Falsa"}
                        </span>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {filas.length > mostrar && (
          <div className="flex items-center justify-between gap-3 pt-3 text-xs text-muted-foreground">
            <span>
              {mostrar} de {filas.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMostrar((n) => n + PAGINA)}
            >
              Mostrar {Math.min(PAGINA, filas.length - mostrar)} más
            </Button>
          </div>
        )}
      </CardContent>

      <Dialog
        open={elegido !== null}
        onOpenChange={(o) => !o && !enviando && setElegido(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {elegido?.falsa
                ? "Quitar la marca de falsa alarma"
                : "Marcar como falsa alarma"}
            </DialogTitle>
            <DialogDescription>
              {elegido && (
                <>
                  {NOMBRE_EVENTO[elegido.tipo] ?? elegido.tipo} (
                  {elegido.nivel === "critico" ? "crítico" : "leve"}) del{" "}
                  {fechaHora(elegido.timestamp)}. Cuenta en la tasa de falsas
                  alarmas.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col items-center gap-2 py-2"
            onSubmit={(ev) => {
              ev.preventDefault()
              void confirmar()
            }}
          >
            <Label
              htmlFor="pin-falsa"
              className="text-xs text-muted-foreground"
            >
              PIN de la puerta
            </Label>
            <CampoPin
              id="pin-falsa"
              value={pin}
              onChange={setPin}
              disabled={enviando}
            />
          </form>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setElegido(null)}
              disabled={enviando}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void confirmar()}
              disabled={enviando || pin.length !== CONFIG.PIN_LENGTH}
            >
              {enviando && <Loader2 className="animate-spin" />}
              {elegido?.falsa ? "Quitar marca" : "Marcar falsa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
