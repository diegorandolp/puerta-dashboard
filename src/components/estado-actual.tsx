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

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Indicador, colorTono, type Tono } from "@/components/estado-indicador"
import { CONFIG } from "@/config"
import { haceCuanto, hora } from "@/lib/formato"
import { calidadRssi } from "@/lib/metricas"
import type { Estado } from "@/lib/tipos"

interface Tile {
  titulo: string
  icono: LucideIcon
  valor: string
  tono: Tono
  detalle: React.ReactNode
  extra?: React.ReactNode
}

function Tarjeta({ t, apagado }: { t: Tile; apagado: boolean }) {
  return (
    <Card size="sm" className="gap-2">
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <t.icono
            className={cn(
              "size-4",
              apagado ? "text-muted-foreground" : colorTono[t.tono]
            )}
            aria-hidden
          />
          <span className="text-xs font-medium">{t.titulo}</span>
        </div>
        <div
          className={cn(
            "text-xl font-semibold tracking-tight",
            apagado && "text-muted-foreground"
          )}
        >
          {t.valor}
        </div>
        {t.extra}
        <div className="text-xs text-muted-foreground">{t.detalle}</div>
      </CardContent>
    </Card>
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
      <div
        className={cn("h-full rounded-full transition-[width]", tono)}
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

export function EstadoActual({
  estado,
  ahora,
}: {
  estado: Estado | null
  ahora: number
}) {
  if (!estado) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-xl" />
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

  const tiles: Tile[] = [
    {
      titulo: "Conexión",
      icono: Radio,
      valor: conectado ? "En línea" : "Sin conexión",
      tono: conectado ? "ok" : "critico",
      detalle: ultima ? (
        <>
          Último latido {hora(ultima)} · {haceCuanto(ultima, ahora)}
        </>
      ) : (
        "Todavía no llegó ningún latido"
      ),
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
      detalle: "Sensor magnético MC-38",
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
      detalle:
        estado.cerradura === "desbloqueada"
          ? "Servo a 0°, LED verde"
          : "Servo a 90°, LED rojo",
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
      ) : (
        "Buzzer apagado"
      ),
    },
    {
      titulo: "Humo (MQ-2)",
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
      detalle: `Alarma desde ${CONFIG.GAS_ALARMA} de ${CONFIG.GAS_MAX}`,
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
        typeof estado.no_enviados === "number"
          ? `${calidad ? `Señal ${calidad === "debil" ? "débil" : calidad} · ` : ""}${estado.no_enviados} sin enviar`
          : calidad
            ? `Señal ${calidad === "debil" ? "débil" : calidad}`
            : "Sin lectura",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t, i) => (
        // Sin conexión, todo menos la conexión es el último dato conocido
        <Tarjeta
          key={t.titulo}
          t={t}
          apagado={(!conectado || sinDatos) && i > 0}
        />
      ))}
    </div>
  )
}
