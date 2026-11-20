import { DoorClosed, Moon, RefreshCw, Sun } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Punto } from "@/components/estado-indicador"
import { useTheme } from "@/components/theme-provider"
import { VENTANAS, type Ventana } from "@/hooks/use-datos"
import { haceCuanto, hora } from "@/lib/formato"
import type { Estado } from "@/lib/tipos"

/**
 * Barra de arriba: la marca con el estado del nodo como subtítulo, la ventana de tiempo y
 * dos botones. En el celular la ventana baja a una segunda fila a lo ancho, con botones
 * más grandes, y la barra no se queda fija para no gastar un cuarto de la pantalla.
 */
export function Encabezado({
  estado,
  ventana,
  setVentana,
  cargando,
  actualizado,
  ahora,
  onActualizar,
}: {
  estado: Estado | null
  ventana: Ventana
  setVentana: (v: Ventana) => void
  cargando: boolean
  actualizado: number | null
  ahora: number
  onActualizar: () => void
}) {
  const { theme, setTheme } = useTheme()
  const oscuro =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  const conectado = estado?.dispositivo === "conectado"

  return (
    <header className="border-b bg-background/80 backdrop-blur-md sm:sticky sm:top-0 sm:z-20">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
        <div className="order-1 flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <DoorClosed className="size-[18px]" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] leading-5 font-semibold tracking-tight">
              Puerta inteligente
            </h1>
            <p
              className="flex items-center gap-1.5 text-xs leading-4 text-muted-foreground"
              aria-live="polite"
            >
              <Punto
                tono={estado === null ? "neutro" : conectado ? "ok" : "critico"}
              />
              {estado === null
                ? "Consultando…"
                : conectado
                  ? "En línea"
                  : "Sin conexión"}
            </p>
          </div>
        </div>

        <div className="order-2 ml-auto flex items-center gap-1 sm:order-3 sm:ml-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-9 sm:size-7"
                onClick={onActualizar}
                aria-label="Actualizar ahora"
              >
                <RefreshCw className={cn(cargando && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {actualizado
                ? `Actualizado a las ${hora(actualizado)} (${haceCuanto(actualizado, ahora)})`
                : "Actualizar"}
            </TooltipContent>
          </Tooltip>

          <Button
            variant="ghost"
            size="icon-sm"
            className="size-9 sm:size-7"
            onClick={() => setTheme(oscuro ? "light" : "dark")}
            aria-label={oscuro ? "Usar tema claro" : "Usar tema oscuro"}
          >
            {oscuro ? <Sun /> : <Moon />}
          </Button>
        </div>

        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={ventana}
          onValueChange={(v) => v && setVentana(v as Ventana)}
          aria-label="Ventana de tiempo de las métricas"
          className="order-3 w-full sm:order-2 sm:ml-auto sm:w-auto"
        >
          {(Object.keys(VENTANAS) as Ventana[]).map((v) => (
            <ToggleGroupItem
              key={v}
              value={v}
              aria-label={VENTANAS[v].etiqueta}
              className="h-9 flex-1 tabular-nums sm:h-7 sm:flex-none"
            >
              {v.replace("h", " h")}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </header>
  )
}
