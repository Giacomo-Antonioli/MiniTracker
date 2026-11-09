/**
 * Sync over Bluetooth LE (#168 Phase 4), data only. The phone advertises a GATT service and the PC connects
 * to it; this file is the radio-independent part: it turns the raw GATT link (small frames, in order) into
 * the same Channel every other sync uses, so runSync does not change.
 *
 * Bluetooth LE links are not encrypted unless the devices bond, so the app does its own:
 * 1. each side sends a fresh ECDH P-256 public key and its name;
 * 2. both show a 6-digit code made from the two keys (a device in the middle would make the codes differ);
 * 3. once both people confirm, an AES-GCM key from the shared secret encrypts everything that follows.
 * Every BLE sync asks for the code: there is no long-lived key to recognise a known device by.
 */
import type { Channel } from './syncChannel'
import type { Device } from './syncDevice'

/** A raw ordered link to the other device: the GATT write/notify pair, one frame at a time. */
export interface BleLink {
  /** Largest frame the link takes (the negotiated MTU minus the 3-byte ATT header). */
  readonly maxFrame: number
  send(frame: Uint8Array): void
  onFrame(fn: (frame: Uint8Array) => void): void
  onClose(fn: () => void): void
  close(): void
}

export const NOT_CONFIRMED_BLE = 'The pairing was not confirmed on both devices.'

const LAST = 1
const MORE = 0

/** Cuts a message into frames: one flag byte (1 = last piece) then up to maxFrame-1 bytes. */
export function toFrames(bytes: Uint8Array, maxFrame: number): Uint8Array[] {
  const size = Math.max(1, maxFrame - 1)
  const out: Uint8Array[] = []
  for (let at = 0; at === 0 || at < bytes.length; at += size) {
    const part = bytes.subarray(at, at + size)
    const frame = new Uint8Array(part.length + 1)
    frame[0] = at + size >= bytes.length ? LAST : MORE
    frame.set(part, 1)
    out.push(frame)
  }
  return out
}

/** Puts frames back together; returns whole messages as they complete. */
export function reassembler(onMessage: (bytes: Uint8Array) => void): (frame: Uint8Array) => void {
  let parts: Uint8Array[] = []
  return (frame) => {
    if (frame.length === 0) return
    parts.push(frame.subarray(1))
    if (frame[0] !== LAST) return
    const whole = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
    let at = 0
    for (const p of parts) (whole.set(p, at), (at += p.length))
    parts = []
    onMessage(whole)
  }
}

/** A message-sized byte pipe on top of the frames. */
export function messagePipe(link: BleLink) {
  const handlers: ((b: Uint8Array) => void)[] = []
  const early: Uint8Array[] = []
  link.onFrame(
    reassembler((b) => {
      if (handlers.length) handlers.forEach((h) => h(b))
      else early.push(b)
    }),
  )
  return {
    send: (b: Uint8Array) => toFrames(b, link.maxFrame).forEach((f) => link.send(f)),
    onMessage: (fn: (b: Uint8Array) => void) => {
      handlers.push(fn)
      early.splice(0).forEach(fn)
    },
  }
}

const enc = new TextEncoder()
const dec = new TextDecoder()
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

type Hello = { t: 'hi'; id: string; name: string; key: string }
type Verdict = { t: 'ok' } | { t: 'no' }

/** The 6-digit code for two public keys: the same on both devices whichever way round they are given. */
export async function bleCode(a: Uint8Array, b: Uint8Array): Promise<string> {
  const [x, y] = [b64(a), b64(b)].sort()
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`${x}|${y}`)))
  return String(new DataView(hash.buffer).getUint32(0) % 1_000_000).padStart(6, '0')
}

/** An AES-GCM channel; the nonce is a counter per direction, so a replayed or reordered message fails. */
function secure(link: BleLink, pipe: ReturnType<typeof messagePipe>, key: CryptoKey, iAmFirst: boolean): Channel {
  let out = 0
  let inn = 0
  const nonce = (n: number, first: boolean) => {
    const iv = new Uint8Array(12)
    iv[0] = first ? 1 : 2
    new DataView(iv.buffer).setUint32(8, n)
    return iv
  }
  let onMsg: (t: string) => void = () => {}
  let chain = Promise.resolve()
  pipe.onMessage((cipher) => {
    chain = chain.then(async () => {
      try {
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce(inn++, !iAmFirst) }, key, cipher as Uint8Array<ArrayBuffer>)
        onMsg(dec.decode(plain))
      } catch {
        link.close() // tampered, replayed or out of order
      }
    })
  })
  let sending = Promise.resolve()
  return {
    send: (text) => {
      const n = out++
      sending = sending.then(async () => pipe.send(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce(n, iAmFirst) }, key, enc.encode(text)))))
    },
    onMessage: (fn) => (onMsg = fn),
    onClose: (fn) => link.onClose(fn),
    close: () => link.close(),
  }
}

export interface BleOptions {
  me: Device
  /** Shows the code and asks the person to compare it on both screens. */
  decide(p: { other: Device; code: string }): Promise<boolean>
  /** Gives up waiting for the other device after this long. */
  timeoutMs?: number
}

/**
 * Pairs over a connected link and returns the encrypted channel. `central` is the side that opened the
 * connection (the PC); it fixes which direction uses which nonce.
 */
export async function blePair(link: BleLink, central: boolean, o: BleOptions): Promise<{ channel: Channel; other: Device }> {
  const pipe = messagePipe(link)
  const inbox: Uint8Array[] = []
  const waiting: (() => void)[] = []
  let closed = false
  pipe.onMessage((b) => (inbox.push(b), waiting.splice(0).forEach((w) => w())))
  link.onClose(() => ((closed = true), waiting.splice(0).forEach((w) => w())))
  const ms = o.timeoutMs ?? 5 * 60_000
  const read = async <T,>(): Promise<T> => {
    const deadline = Date.now() + ms
    while (!inbox.length) {
      if (closed) throw new Error(NOT_CONFIRMED_BLE)
      if (Date.now() > deadline) throw new Error('The other device did not answer')
      await new Promise<void>((r) => (waiting.push(r), setTimeout(r, Math.max(0, deadline - Date.now()))))
    }
    return JSON.parse(dec.decode(inbox.shift())) as T
  }
  const say = (m: Hello | Verdict) => pipe.send(enc.encode(JSON.stringify(m)))
  try {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])
    const mine = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
    say({ t: 'hi', id: o.me.deviceId, name: o.me.deviceName, key: b64(mine) })
    const hi = await read<Hello>()
    if (hi.t !== 'hi') throw new Error(NOT_CONFIRMED_BLE)
    const theirs = unb64(hi.key)
    const other = { deviceId: hi.id, deviceName: hi.name }
    const code = await bleCode(mine, theirs)
    const theirKey = await crypto.subtle.importKey('raw', theirs, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
    const secret = await crypto.subtle.deriveBits({ name: 'ECDH', public: theirKey }, pair.privateKey, 256)
    const theirVerdict = read<Verdict>()
    theirVerdict.catch(() => {})
    if (!(await o.decide({ other, code }))) {
      say({ t: 'no' })
      link.close()
      throw new Error(NOT_CONFIRMED_BLE)
    }
    say({ t: 'ok' })
    if ((await theirVerdict).t !== 'ok') throw new Error(NOT_CONFIRMED_BLE)
    const [x, y] = [b64(mine), b64(theirs)].sort()
    const base = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey'])
    const key = await crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode(`${x}|${y}`), info: enc.encode('minitracker-ble') }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    return { channel: secure(link, pipe, key, central), other }
  } catch (e) {
    link.close()
    throw e
  }
}
