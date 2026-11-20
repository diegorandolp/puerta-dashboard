import {
  DoorClosed,
  DoorOpen,
  Flame,
  Lock,
  LockOpen,
  Radio,
  ShieldCheck,
  ShieldOff,
  Wifi,
  type LucideIcon,
} from "lucide-react"
import { cn } from "cn"

import { Skeleton } from "@/components/ui/skeleton"
import { Indicador, colorTono, type Tono } from "@/components/estado-indicador"
import { SUPERFICIE } from "@/components/superficie"
import { CONFIG } from "@/config"
import { haceCuanto } from "@/lib/formato"
import { calidadRssi } from "@/lib/metricas"
import type { Estado } from "@/lib/tipos"

interface Celda {
  titulo: string
  icono: LucideIcon
  valor: string
  tono: Tono
  detalle?: React.ReactNode
  extra?: React.ReactNode
}

const REJILLA = cn(SUPERFICIE, "grid-cols-2 md:grid-cols-3 xl:grid-cols-6")

function Casilla({ t, apagado }: { t: Celda; apagado: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <t.icono
          className={cn("size-4", !apagado && colorTono[t.tono])}
          aria-hidden
        />
        {t.titulo}
      </div>
      <div
        className={cn(
          "text-xl font-semibold tracking-tight tabular-nums",
          apagado && "text-muted-foreground"
        )}
      >
        {t.valor}
      </div>
      {t.extra}
      {t.detalle && (
        <div className="text-xs text-muted-foreground">{t.detalle}</div>
      )}
    </div>
  )
}

function Gas({ valor }: { valor: number }) {
  const pct = (v: number) => `${(100 * v) / CONFIG.GAS_MAX}%`
  const tono =
    valor >= CONFIG.GAS_ALARMA
      ? "bg-critico"
      : valor >= CONFIG.GAS_NORMAL
        ? "bg-aviso"
        : "bg-chart-1"
  return (
    <div className="relative h-1.5 w-full rounded-full bg-muted" aria-hidden>
      {/* Sin transición: el dato llega cada 10 s y animar el ancho no dice nada */}
      <div
        className={cn("h-full rounded-full", tono)}
        style={{ width: pct(Math.min(valor, CONFIG.GAS_MAX)) }}
      />
      {/* marca del umbral de alarma */}
      <div
        className="absolute -top-0.5 h-2.5 w-0.5 rounded-full bg-foreground/60"
        style={{ left: pct(CONFIG.GAS_ALARMA) }}
      />
    </div>
  )
}

const CALIDAD = { buena: "Buena", aceptable: "Aceptable", debil: "Débil" }

export function EstadoActual({
  estado,
  ahora,
}: {
  estado: Estado | null
  ahora: number
}) {
  if (!estado) {
    return (
      <div className={REJILLA}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2.5 bg-card p-4">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
    )
  }

  const conectado = estado.dispositivo === "conectado"
  const ultima = estado.ultima_conexion
    ? Date.parse(estado.ultima_conexion)
    : null
  const sinDatos = estado.armado === undefined && estado.gas === undefined
  const gas = typeof estado.gas === "number" ? estado.gas : null
  const rssi = typeof estado.rssi === "number" ? estado.rssi : null
  const calidad = rssi === null ? null : calidadRssi(rssi)
  const sinEnviar =
    typeof estado.no_enviados === "number" && estado.no_enviados > 0
      ? estado.no_enviados
      : null

  const celdas: Celda[] = [
    {
      titulo: "Conexión",
      icono: Radio,
      valor: conectado ? "En línea" : "Sin conexión",
      tono: conectado ? "ok" : "critico",
      detalle: ultima
        ? `${conectado ? "Latido" : "Último latido"} ${haceCuanto(ultima, ahora)}`
        : "Sin latidos",
    },
    {
      titulo: "Puerta",
      icono: estado.puerta === "abierta" ? DoorOpen : DoorClosed,
      valor:
        estado.puerta === "abierta"
          ? "Abierta"
          : estado.puerta === "cerrada"
            ? "Cerrada"
            : "Desconocida",
      tono:
        estado.puerta === "abierta"
          ? "aviso"
          : estado.puerta === "cerrada"
            ? "ok"
            : "neutro",
    },
    {
      titulo: "Cerradura",
      icono: estado.cerradura === "desbloqueada" ? LockOpen : Lock,
      valor:
        estado.cerradura === "bloqueada"
          ? "Trabada"
          : estado.cerradura === "desbloqueada"
            ? "Suelta"
            : "Desconocida",
      tono:
        estado.cerradura === "bloqueada"
          ? "ok"
          : estado.cerradura === "desbloqueada"
            ? "aviso"
            : "neutro",
    },
    {
      titulo: "Sistema",
      icono: estado.armado ? ShieldCheck : ShieldOff,
      valor: estado.armado
        ? "Armado"
        : estado.armado === false
          ? "Desarmado"
          : "—",
      tono: estado.alarma ? "critico" : estado.armado ? "ok" : "neutro",
      detalle: estado.alarma ? (
        <Indicador tono="critico">Buzzer sonando</Indicador>
      ) : undefined,
    },
    {
      titulo: "Humo",
      icono: Flame,
      valor: gas === null ? "—" : `${gas}`,
      tono:
        gas === null
          ? "neutro"
          : gas >= CONFIG.GAS_ALARMA
            ? "critico"
            : gas >= CONFIG.GAS_NORMAL
              ? "aviso"
              : "ok",
      extra: gas === null ? null : <Gas valor={gas} />,
      detalle: gas === null ? undefined : `Umbral ${CONFIG.GAS_ALARMA}`,
    },
    {
      titulo: "Señal Wi-Fi",
      icono: Wifi,
      valor: rssi === null ? "—" : `${rssi} dBm`,
      tono:
        calidad === "buena"
          ? "ok"
          : calidad === "aceptable"
            ? "aviso"
            : calidad === "debil"
              ? "critico"
              : "neutro",
      detalle:
        [
          calidad && CALIDAD[calidad],
          sinEnviar && `${sinEnviar} sin enviar`,
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
    },
  ]

  return (
    <div className={REJILLA}>
      {celdas.map((t, i) => (
        // Sin conexión, todo menos la conexión es el último dato conocido
        <Casilla
          key={t.titulo}
          t={t}
          apagado={(!conectado || sinDatos) && i > 0}
        />
      ))}
    </div>
  )
}
