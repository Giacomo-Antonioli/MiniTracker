import { useEffect, useState } from 'react'

/** Phone layout below this width (Tailwind's md). */
export const PHONE_QUERY = '(max-width: 767px)'

const matches = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches

/** True on phone-sized screens; follows rotation and window resizes. */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(matches)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const m = window.matchMedia(PHONE_QUERY)
    const on = () => setPhone(m.matches)
    m.addEventListener?.('change', on)
    return () => m.removeEventListener?.('change', on)
  }, [])
  return phone
}
