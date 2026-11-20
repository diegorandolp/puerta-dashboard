// Mismos valores que el firmware (esp32/puerta_aws/puerta_aws.ino) y la app (app/app/src/config.js).
export const CONFIG = {
  // Se puede cambiar sin tocar el código con VITE_API_URL en un archivo .env.local
  API_URL:
    import.meta.env?.VITE_API_URL ??
    "https://9vfikc9zla.execute-api.us-east-1.amazonaws.com",
  ESTADO_MS: 10_000, // cada cuánto se pide GET /estado
  VENTANA_MS: 30_000, // cada cuánto se piden eventos y latidos de la ventana
  PIN_LENGTH: 6,
  GAS_ALARMA: 1800, // UMBRAL_GAS: desde aquí hay humo
  GAS_NORMAL: 1600, // por debajo vuelve a normal
  GAS_MAX: 4095, // ADC de 12 bits
  LATIDO_MS: 30_000, // el ESP32 manda un latido cada 30 s
  DESCONEXION_MS: 70_000, // misma regla que consultarPuerta: 70 s sin latidos = desconectado
  META_LATENCIA_P95_MS: 2000, // objetivo del informe: p95 menor a 2 s
  ZONA_HORARIA: "America/Lima",
} as const
