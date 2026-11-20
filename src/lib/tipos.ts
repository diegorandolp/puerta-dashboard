// Formas de los datos que devuelve la API (ver aws/README.md, "Contrato de la API").

export type Nivel = "leve" | "critico" | "info" | "advertencia"

export interface Evento {
  dispositivo: string
  timestamp: string // hora de recepción en IoT Core, en UTC (la agrega la regla)
  tipo: string
  nivel: Nivel | string
  mensaje?: string
  con?: string | null // sensor con el que se correlacionó
  valor?: number
  seq?: number // contador compartido con los latidos
  boot?: number // cambia en cada reinicio del ESP32
  ts_evento?: number // hora del evento en el ESP32 (ms desde 1970, por NTP)
  falsa?: boolean // marcada como falsa alarma desde el dashboard
}

export interface Latido {
  timestamp: string
  seq?: number
  boot?: number
  ts_evento?: number
  rssi?: number
  gas?: number
  no_enviados?: number
  puerta?: string
  cerradura?: string
  armado?: boolean
  alarma?: boolean
}

export interface Estado {
  dispositivo: "conectado" | "desconectado"
  puerta?: string
  cerradura?: string
  armado?: boolean | null
  alarma?: boolean | null
  gas?: number | null
  rssi?: number | null
  no_enviados?: number | null
  ultima_conexion: string | null
}

export type Accion = "abrir" | "armar" | "desarmar" | "silenciar"
