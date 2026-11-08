import { txr } from '../../i18n'

/** Text for "Nearby devices" (#168), translated when read (getters), so it follows the chosen language. */
export const LAN_TEXT = {
  get title() { return txr('Nearby devices') },
  get intro() { return txr('MiniTracker apps on this network (PC or phone app, Sync page open). No code to type: the first time, check that both screens show the same number.') },
  get none() { return txr('None found. Open ⇄ Sync in the MiniTracker app on the other device, on the same Wi-Fi.') },
  pair: (name: string) => txr('Pair with {{name}}', { name }),
  syncNow: (name: string) => txr('Sync now with {{name}}', { name }),
  get pairLabel() { return txr('Pair') },
  get syncLabel() { return txr('⇄ Sync now') },
  get paired() { return txr('paired') },
  connecting: (name: string) => txr('Connecting to {{name}}…', { name }),
  unreachable: (name: string) => txr("Can't reach {{name}} on this network. Check both devices are on the same Wi-Fi, or use a pairing code.", { name }),
  get confirmTitle() { return txr('Pair these devices?') },
  confirmBody: (name: string) => txr('Pairing with {{name}}. Check it shows the same number:', { name }),
  get confirmHint() { return txr('Different number? Cancel: another device may be in the middle.') },
  get changedTitle() { return txr('This device looks different') },
  changed: (name: string) => txr("{{name}} paired with this device before, but its identity has changed (reinstalled, reset, or a different device using its name). Pair again only if you're sure it's yours.", { name }),
  get confirm() { return txr('Same number: pair') },
  get cancel() { return txr('Cancel') },
  get unavailable() { return txr('Nearby sync is not available on this device.') },
}
