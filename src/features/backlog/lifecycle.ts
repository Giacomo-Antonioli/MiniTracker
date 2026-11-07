import { txr } from '../../i18n'

/** A unit's state (active, on hold, sold…) in the chosen language. */
export function lifecycleName(l: string): string {
  const names: Record<string, () => string> = {
    active: () => txr('active'),
    'on-hold': () => txr('on hold'),
    sold: () => txr('sold'),
    traded: () => txr('traded'),
    gifted: () => txr('gifted'),
    lost: () => txr('lost'),
  }
  return names[l]?.() ?? l
}
