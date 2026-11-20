import { REGEXP_ONLY_DIGITS } from "input-otp"

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { CONFIG } from "@/config"

/** Seis casillas para el PIN de la puerta (el mismo de la app). */
export function CampoPin({
  value,
  onChange,
  onComplete,
  id,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  onComplete?: (v: string) => void
  id?: string
  disabled?: boolean
}) {
  return (
    <InputOTP
      id={id}
      maxLength={CONFIG.PIN_LENGTH}
      pattern={REGEXP_ONLY_DIGITS}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      disabled={disabled}
      inputMode="numeric"
      autoComplete="off"
    >
      <InputOTPGroup>
        {Array.from({ length: CONFIG.PIN_LENGTH }, (_, i) => (
          // El PIN no se muestra: cada casilla llena es un punto
          <InputOTPSlot key={i} index={i} mask className="size-10 text-base" />
        ))}
      </InputOTPGroup>
    </InputOTP>
  )
}
