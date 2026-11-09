/**
 * The two real ends of the Bluetooth link (#168 Phase 4), as BleLink for syncBle.ts:
 * - PC app: the Rust central (src-tauri/src/ble.rs) through Tauri commands and events;
 * - Android app: the Kotlin GATT server (BleServer.kt) through window.MiniTrackerBle and window events.
 * Frames travel as base64 text across both bridges.
 */
import type { BleLink } from './syncBle'

const toB64 = (u: Uint8Array) => btoa(String.fromCharCode(...u))
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

/** What the Kotlin side exposes to the page. */
interface PhoneBridge {
  available(): boolean
  start(): void
  stop(): void
  send(frameBase64: string): void
}
const phoneBridge = (): PhoneBridge | undefined => (typeof window === 'undefined' ? undefined : (window as unknown as { MiniTrackerBle?: PhoneBridge }).MiniTrackerBle)

/** True in the Android app, which can advertise to a PC. */
export const canAdvertiseBle = () => !!phoneBridge()?.available()

/** Link events can arrive before anyone listens (the PC subscribing is what we wait for), so they are kept. */
function makeLink(maxFrame: number, sendFrame: (f: Uint8Array) => void, close: () => void) {
  const frames: Uint8Array[] = []
  let onFrame: ((f: Uint8Array) => void) | undefined
  let closed = false
  let onClose: (() => void) | undefined
  const link: BleLink & { maxFrame: number } = {
    maxFrame,
    send: sendFrame,
    onFrame: (fn) => {
      onFrame = fn
      frames.splice(0).forEach(fn)
    },
    onClose: (fn) => {
      onClose = fn
      if (closed) fn()
    },
    close,
  }
  return {
    link,
    push: (f: Uint8Array) => (onFrame ? onFrame(f) : frames.push(f)),
    end: () => {
      closed = true
      onClose?.()
    },
  }
}

/** PC: scan for a phone, connect, subscribe. Rejects with a readable message when none is found. */
export async function connectToPhone(timeoutS = 30): Promise<BleLink> {
  const [{ invoke }, { listen }] = await Promise.all([import('@tauri-apps/api/core'), import('@tauri-apps/api/event')])
  let made: ReturnType<typeof makeLink> | undefined
  const early: Uint8Array[] = []
  const offs = [
    await listen<string>('ble-frame', ({ payload }) => (made ? made.push(fromB64(payload)) : early.push(fromB64(payload)))),
    await listen('ble-closed', () => made?.end()),
  ]
  try {
    const maxFrame = await invoke<number>('ble_connect', { timeoutS })
    made = makeLink(
      maxFrame,
      (f) => void invoke('ble_send', { data: toB64(f) }).catch(() => made?.end()),
      () => {
        offs.forEach((f) => f())
        void invoke('ble_close').catch(() => {})
        made?.end()
      },
    )
    early.splice(0).forEach(made.push)
    return made.link
  } catch (e) {
    offs.forEach((f) => f())
    throw new Error(typeof e === 'string' ? e : (e as Error).message)
  }
}

const ERRORS: Record<string, string> = {
  permission: 'Bluetooth permission was not given.',
  unavailable: 'Bluetooth is off or not available on this phone.',
}

/** Phone: advertise and wait until a PC connects and subscribes. */
export function waitForPc(timeoutMs = 120_000): { link: Promise<BleLink>; cancel(): void } {
  const bridge = phoneBridge()
  let stop = () => {}
  const link = new Promise<BleLink>((resolve, reject) => {
    if (!bridge) return reject(new Error(ERRORS.unavailable))
    let made: ReturnType<typeof makeLink> | undefined
    let maxFrame = 20
    const timer = setTimeout(() => (done(), reject(new Error('No PC connected in time.'))), timeoutMs)
    const handler = (ev: Event) => {
      const { type, data } = (ev as CustomEvent<{ type: string; data: string }>).detail
      if (type === 'mtu') maxFrame = Math.max(20, Number(data))
      else if (type === 'ready') {
        clearTimeout(timer)
        made = makeLink(maxFrame, (f) => bridge.send(toB64(f)), () => (bridge.stop(), made?.end()))
        resolve(made.link)
      } else if (type === 'frame') made?.push(fromB64(data))
      else if (type === 'closed') {
        if (made) made.end()
        else (done(), reject(new Error('The PC disconnected.')))
      } else if (type === 'error') (done(), reject(new Error(ERRORS[data.split(':')[0]] ?? `Bluetooth error (${data})`)))
    }
    const done = () => {
      clearTimeout(timer)
      window.removeEventListener('minitracker-ble', handler)
      if (!made) bridge.stop()
    }
    stop = done
    window.addEventListener('minitracker-ble', handler)
    bridge.start()
  })
  return { link, cancel: () => stop() }
}
