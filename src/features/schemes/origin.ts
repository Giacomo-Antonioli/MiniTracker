import { txr } from '../../i18n'

/** Read at render time, so it follows the chosen language. */
export const ORIGIN_LABEL = {
  get official() { return txr('Official') },
  get community() { return txr('Community') },
  get personal() { return txr('Mine') },
}
export const ORIGIN_STYLE = {
  official: 'border-accent text-accent',
  community: 'border-ok text-ok',
  personal: 'border-line text-muted',
} as const
