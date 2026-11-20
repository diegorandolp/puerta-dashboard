import {
  CircleAlert,
  CircleCheck,
  CircleMinus,
  OctagonAlert,
} from "lucide-react"
import { cn } from "cn"

export type Tono = "ok" | "aviso" | "critico" | "neutro"

const ICONO = {
  ok: CircleCheck,
  aviso: CircleAlert,
  critico: OctagonAlert,
  neutro: CircleMinus,
}

const COLOR: Record<Tono, string> = {
  ok: "text-ok",
  aviso: "text-aviso",
  critico: "text-critico",
  neutro: "text-muted-foreground",
}

/** Estado con ícono y texto: el color nunca va solo. El texto queda en tinta normal. */
export function Indicador({
  tono,
  children,
  className,
}: {
  tono: Tono
  children: React.ReactNode
  className?: string
}) {
  const Icono = ICONO[tono]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
        className
      )}
    >
      <Icono className={cn("size-3.5 shrink-0", COLOR[tono])} aria-hidden />
      <span>{children}</span>
    </span>
  )
}

/** Punto de estado (con anillo que late si está en vivo). */
export function Punto({
  tono,
  latido = false,
}: {
  tono: Tono
  latido?: boolean
}) {
  const bg = {
    ok: "bg-ok",
    aviso: "bg-aviso",
    critico: "bg-critico",
    neutro: "bg-muted-foreground",
  }[tono]
  return (
    <span className="relative flex size-2 shrink-0" aria-hidden>
      {latido && (
        <span
          className={cn(
            "absolute inline-flex size-full animate-ping rounded-full opacity-60",
            bg
          )}
        />
      )}
      <span className={cn("relative inline-flex size-2 rounded-full", bg)} />
    </span>
  )
}

export const colorTono = COLOR
