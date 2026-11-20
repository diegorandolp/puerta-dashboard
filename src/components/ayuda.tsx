import { Info } from "lucide-react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/**
 * Explicación que no ocupa lugar en la página: se abre con un toque o un clic. Va en un
 * popover y no en un tooltip porque el tooltip no se abre con el dedo.
 */
export function Ayuda({
  titulo,
  children,
}: {
  titulo: string
  children: React.ReactNode
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Más información: ${titulo}`}
          // El margen negativo agranda el área táctil a 28 px sin mover nada
          className="-m-1.5 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:text-foreground"
        >
          <Info className="size-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="text-xs leading-relaxed text-pretty"
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}
