import { useCallback, useState } from "react"

const CLAVE = "puerta-nieve"

/** Si la nieve está encendida. Se recuerda en el navegador; sin almacenamiento, queda encendida. */
export function useNieve() {
  const [activa, setActiva] = useState<boolean>(() => {
    try {
      return localStorage.getItem(CLAVE) !== "off"
    } catch {
      return true
    }
  })

  const cambiar = useCallback((valor: boolean) => {
    setActiva(valor)
    try {
      localStorage.setItem(CLAVE, valor ? "on" : "off")
    } catch {
      // sin almacenamiento: el cambio vale solo hasta recargar
    }
  }, [])

  return [activa, cambiar] as const
}
