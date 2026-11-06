/**
 * QR carousel (#161): a sync file without photos shown as a loop of QR codes, read by the other
 * device's camera. Works with no network at all. Frames can be read in any order; missed ones
 * come round again on the next loop.
 */
import { pieceToText, toPieces } from '../domain/sync/protocol'
import { parseSyncFile, type SyncFile } from './syncFile'

/** Characters of data per QR: small enough for a phone camera to read off a screen. */
export const FRAME_SIZES = { small: 300, medium: 600, large: 1000 } as const
export type FrameSize = keyof typeof FRAME_SIZES

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}
const toB64 = (b: Uint8Array) => {
  let s = ''
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000))
  return btoa(s)
}
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

/** Any JSON as QR text: "z" + gzip in base64, or "j" + plain JSON where the browser can't compress. */
export async function packText(json: string): Promise<string> {
  if (typeof CompressionStream === 'undefined') return 'j' + json
  return 'z' + toB64(await pipe(new TextEncoder().encode(json), new CompressionStream('gzip')))
}

export async function unpackText(text: string): Promise<string> {
  if (text.startsWith('j')) return text.slice(1)
  if (!text.startsWith('z')) throw new Error('These QR codes are not from MiniTracker')
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot read compressed QR codes; update it or use a file')
  return new TextDecoder().decode(await pipe(fromB64(text.slice(1)), new DecompressionStream('gzip')))
}

/** A sync file (no photos) as QR text. */
export const packSyncFile = (f: SyncFile) => packText(JSON.stringify({ ...f, photos: undefined }))
export const unpackSyncFile = async (text: string): Promise<SyncFile> => parseSyncFile(await unpackText(text))

/** The QR texts to show in a loop. */
export function carouselFrames(packed: string, size: FrameSize, id: string = Math.random().toString(36).slice(2, 8)): string[] {
  return toPieces(id, packed, FRAME_SIZES[size]).map(pieceToText)
}
