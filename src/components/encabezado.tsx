import { DoorClosed, Moon, RefreshCw, Snowflake, Sun } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Punto } from "@/components/estado-indicador"
import { Cenefa, Estrella, GorroNavidad, Luces } from "@/components/navidad"
import { useTheme } from "@/components/theme-provider"
import { VENTANAS, type Ventana } from "@/hooks/use-datos"
import { haceCuanto, hora } from "@/lib/formato"
import type { Estado } from "@/lib/tipos"

export function Encabezado({
  estado,
  ventana,
  setVentana,
  cargando,
  actualizado,
  ahora,
  onActualizar,
  nieve,
  setNieve,
}: {
  estado: Estado | null
  ventana: Ventana
  setVentana: (v: Ventana) => void
  cargando: boolean
  actualizado: number | null
  ahora: number
  onActualizar: () => void
  nieve: boolean
  setNieve: (v: boolean) => void
}) {
  const { theme, setTheme } = useTheme()
  const oscuro =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  const conectado = estado?.dispositivo === "conectado"

  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <Luces />
      <Cenefa />
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-3 px-4 pt-6 pb-3 sm:px-6">
        <div className="flex min-w-0 flex-[1_1_15rem] items-center gap-3">
          <div className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <DoorClosed className="size-5" />
            <GorroNavidad className="absolute -top-3 -left-2 size-6 -rotate-12 drop-shadow-sm" />
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-baseline gap-2">
              <h1 className="truncate text-base leading-tight font-semibold">
                Puerta inteligente
              </h1>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-festivo-rojo">
                <Estrella className="size-3" />
                Feliz Navidad
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              Nodo esp32_puerta · AWS IoT Core
            </p>
          </div>
          <span
            className="ml-1 hidden items-center gap-2 rounded-full border px-2.5 py-1 text-xs sm:inline-flex"
            aria-live="polite"
          >
            <Punto
              tono={estado === null ? "neutro" : conectado ? "ok" : "critico"}
              latido={conectado}
            />
            {estado === null
              ? "Consultando…"
              : conectado
                ? "En línea"
                : "Sin conexión"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={ventana}
            onValueChange={(v) => v && setVentana(v as Ventana)}
            aria-label="Ventana de tiempo de las métricas"
          >
            {(Object.keys(VENTANAS) as Ventana[]).map((v) => (
              <ToggleGroupItem key={v} value={v} title={VENTANAS[v].etiqueta}>
                {v.replace("h", " h")}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
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
            className="motion-reduce:hidden"
            onClick={() => setNieve(!nieve)}
            aria-pressed={nieve}
            aria-label={nieve ? "Quitar la nieve" : "Poner nieve"}
            title={nieve ? "Quitar la nieve" : "Poner nieve"}
          >
            <Snowflake className={cn(!nieve && "opacity-50")} />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setTheme(oscuro ? "light" : "dark")}
            aria-label={oscuro ? "Usar tema claro" : "Usar tema oscuro"}
          >
            {oscuro ? <Sun /> : <Moon />}
          </Button>
        </div>
      </div>
    </header>
  )
}
