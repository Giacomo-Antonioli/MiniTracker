/** Sync wire format (#161): pairing codes, hello/clock check, and data split into numbered pieces. Pure. */

export const PROTOCOL_VERSION = 1

// No 0/O, 1/I/L, 5/S, 8/B: easy to read out and type.
const ALPHABET = 'ACDEFGHJKMNPQRTUVWXY234679'
const CODE_LENGTH = 7

/** A new pairing code like K7P42QX (shown as K7P-42QX). */
export function newPairCode(random: () => number = Math.random): string {
  return Array.from({ length: CODE_LENGTH }, () => ALPHABET[Math.floor(random() * ALPHABET.length)]).join('')
}

/** A device's own fixed code, so devices that synced before find each other without typing one. */
export function deviceCodeFor(deviceId: string): string {
  // FNV-1a over the whole id, then stretched over the code length
  let h = 0x811c9dc5
  for (let i = 0; i < deviceId.length; i++) h = Math.imul(h ^ deviceId.charCodeAt(i), 0x01000193) >>> 0
  let out = ''
  while (out.length < CODE_LENGTH) {
    h = Math.imul(h ^ out.length, 0x01000193) >>> 0
    out += ALPHABET[h % ALPHABET.length]
  }
  // never the same as a typed pairing code: those are random, these start with a marker letter
  return 'D' + out.slice(1)
}

export const formatPairCode = (code: string) => `${code.slice(0, 3)}-${code.slice(3)}`

/** Read a typed code or a pairing link; undefined if it isn't one. Forgiving about case, spaces and dashes. */
export function parsePairCode(input: string): string | undefined {
  const fromLink = /[#&?]sync=([^&\s]+)/.exec(input)?.[1]
  const code = (fromLink ?? input).toUpperCase().replace(/[\s-]/g, '')
  return code.length === CODE_LENGTH && [...code].every((c) => ALPHABET.includes(c)) ? code : undefined
}

export const pairLink = (base: string, code: string) => `${base}#sync=${code}`

/** Relay id for a code; namespaced so other apps on the relay can't collide. */
export const peerIdFor = (code: string) => `minitracker-sync-${code.toLowerCase()}`

export interface Hello {
  type: 'hello'
  protocol: number
  deviceId: string
  deviceName: string
  /** Sender's clock at sending time. */
  clock: string
  /** Optional steps this device can take part in (missing = none, i.e. an older version). */
  features?: string[]
}

/** Seconds the other clock is ahead of ours (negative: behind), allowing for the time the message took. */
export function clockSkewSeconds(hello: Hello, receivedAt: string): number {
  return Math.round((Date.parse(hello.clock) - Date.parse(receivedAt)) / 1000)
}

export const CLOCK_WARN_SECONDS = 60

/** One numbered piece of a larger message. */
export interface Piece {
  /** Same for all pieces of one message. */
  id: string
  seq: number
  total: number
  data: string
}

/** Split text into pieces of at most `size` characters. */
export function toPieces(id: string, text: string, size: number): Piece[] {
  const total = Math.max(1, Math.ceil(text.length / size))
  return Array.from({ length: total }, (_, seq) => ({ id, seq, total, data: text.slice(seq * size, (seq + 1) * size) }))
}

/** Pieces as short text lines (for QR codes): "MT1|id|seq|total|data". */
export const pieceToText = (p: Piece) => `MT${PROTOCOL_VERSION}|${p.id}|${p.seq}|${p.total}|${p.data}`

export function pieceFromText(text: string): Piece | undefined {
  const m = /^MT(\d+)\|([^|]+)\|(\d+)\|(\d+)\|([\s\S]*)$/.exec(text)
  if (!m || Number(m[1]) !== PROTOCOL_VERSION) return undefined
  const p = { id: m[2], seq: Number(m[3]), total: Number(m[4]), data: m[5] }
  return p.total > 0 && p.seq < p.total ? p : undefined
}

/** Collects pieces in any order, ignoring repeats and pieces of other messages. */
export class Reassembler {
  private id?: string
  private parts: (string | undefined)[] = []

  /** Add a piece; returns the whole text once every piece arrived. */
  add(p: Piece): string | undefined {
    if (this.id !== p.id) {
      this.id = p.id
      this.parts = new Array<string | undefined>(p.total).fill(undefined)
    }
    this.parts[p.seq] = p.data
    return this.parts.every((x) => x !== undefined) ? this.parts.join('') : undefined
  }

  /** Pieces received so far, for a progress bar. */
  get progress(): { have: number; total: number } {
    return { have: this.parts.filter((x) => x !== undefined).length, total: this.parts.length }
  }
}
