import type { CSSProperties } from "react"
import { cn } from "cn"

/**
 * Adornos navideños. Son solo decoración: van con aria-hidden, no reciben clics y las
 * animaciones se apagan con prefers-reduced-motion (ver los estilos en index.css).
 */

// ------------------------------------------------------------------ Nieve

interface Copo {
  x: number // % del ancho
  s: number // tamaño en px
  d: number // segundos que tarda en caer
  r: number // retraso negativo, para que al cargar ya haya copos a media caída
  v: number // px que se mece hacia cada lado
  m: number // segundos de cada vaivén
  o: number // opacidad
  b: number // desenfoque en px (los chicos, más borrosos, parecen lejanos)
  cristal: boolean
}

// Generador pseudoaleatorio con semilla fija: los copos son los mismos en cada carga
// y el render queda puro.
function mulberry32(semilla: number) {
  let a = semilla
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const COPOS: Copo[] = (() => {
  const azar = mulberry32(2025)
  const entre = (a: number, b: number) => a + (b - a) * azar()
  return Array.from({ length: 36 }, (_, i) => {
    const cristal = i % 6 === 3
    const d = entre(16, 32)
    return {
      x: (i * 61.8 + entre(0, 12)) % 100,
      s: cristal ? entre(11, 17) : entre(2.5, 6),
      d,
      r: -entre(0, d),
      v: entre(8, 34),
      m: entre(3, 7),
      o: cristal ? entre(0.5, 0.8) : entre(0.4, 0.9),
      b: cristal ? 0 : entre(0, 1.4),
      cristal,
    }
  })
})()

/** Copos que caen despacio detrás del contenido. Se oculta con prefers-reduced-motion. */
export function Nieve({ activa }: { activa: boolean }) {
  if (!activa) return null
  return (
    <div
      aria-hidden
      className="nieve pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {COPOS.map((c, i) => (
        <span
          key={i}
          className={cn("copo", c.cristal && "copo-cristal")}
          style={
            {
              "--x": `${c.x.toFixed(1)}%`,
              "--s": `${c.s.toFixed(1)}px`,
              "--d": `${c.d.toFixed(1)}s`,
              "--r": `${c.r.toFixed(1)}s`,
              "--v": `${c.v.toFixed(0)}px`,
              "--m": `${c.m.toFixed(1)}s`,
              "--o": c.o.toFixed(2),
              "--b": `${c.b.toFixed(1)}px`,
            } as CSSProperties
          }
        >
          <i />
        </span>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ Luces y cenefa

/** Guirnalda de luces que cuelga del borde de arriba del contenedor (que debe ser relative). */
export function Luces() {
  return (
    <div className="luces" aria-hidden>
      <i />
      <i />
      <i />
      <i />
    </div>
  )
}

/** Bastón de caramelo pegado al borde de abajo del contenedor (que debe ser relative). */
export function Cenefa() {
  return <div className="cenefa" aria-hidden />
}

// ------------------------------------------------------------------ Ilustraciones

type Props = { className?: string }

/** Gorro de Papá Noel. Los colores son fijos: es un dibujo, no un ícono de interfaz. */
export function GorroNavidad({ className }: Props) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path
        d="M5 21C5 11 12 4 24 5c-3 3-3 7-2 10l4 6z"
        fill="#d4283b"
        stroke="#8f1424"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path
        d="M4 21.5c0-1.7 1.3-3 3-3h18.5c1.7 0 3 1.3 3 3s-1.3 3-3 3H7c-1.7 0-3-1.3-3-3z"
        fill="#fbfdfb"
        stroke="#c9d6cc"
        strokeWidth="1"
      />
      <circle cx="25" cy="5.5" r="3.4" fill="#fbfdfb" stroke="#c9d6cc" />
    </svg>
  )
}

/** Bola de árbol: usa currentColor para el cuerpo. */
export function Bola({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="10" y="1.5" width="4" height="3.5" rx="1" fill="#d9a521" />
      <path
        d="M12 5v1.5"
        stroke="#d9a521"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="12" cy="14.5" r="8" fill="currentColor" />
      <path
        d="M7.5 12.5a5.5 5.5 0 0 1 4-3.4"
        fill="none"
        stroke="#fff"
        strokeOpacity=".6"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M5 15.5c3 1.8 11 1.8 14 0"
        fill="none"
        stroke="#fff"
        strokeOpacity=".4"
        strokeWidth="1.2"
      />
    </svg>
  )
}

/** Estrella de cinco puntas, en dorado. */
export function Estrella({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="m12 2.5 2.8 6.1 6.7.7-5 4.5 1.4 6.6L12 17l-5.9 3.4 1.4-6.6-5-4.5 6.7-.7z"
        fill="#f1c232"
        stroke="#b88a10"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Arbolito con estrella, para el pie de página. */
export function Pino({ className }: Props) {
  return (
    <svg viewBox="0 0 24 28" className={className} aria-hidden>
      <path
        d="M12 5 5 13h3.5L3.5 19.5H9L4 25h16l-5-5.5h5.5L15.5 13H19z"
        fill="#1f7a4a"
        stroke="#0f4d2c"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <rect x="10.5" y="25" width="3" height="2.5" fill="#7a4a24" />
      <path
        d="m12 .8.9 2 2.2.2-1.7 1.4.5 2.1L12 5.4 10.1 6.5l.5-2.1L8.9 3l2.2-.2z"
        fill="#f1c232"
      />
      <circle cx="9.5" cy="19.5" r="1" fill="#e63946" />
      <circle cx="14.5" cy="16" r="1" fill="#f1c232" />
      <circle cx="13" cy="22" r="1" fill="#e63946" />
    </svg>
  )
}
