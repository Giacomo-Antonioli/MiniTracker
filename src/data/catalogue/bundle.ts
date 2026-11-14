import type { Catalogue } from '../../domain/catalogue/types'

/** File with the catalogues installed on this device, to move them to another device or keep them safe. */
export const BUNDLE_FORMAT = 'minitracker-catalogues'
export const BUNDLE_VERSION = 1

interface Bundle {
  format: typeof BUNDLE_FORMAT
  version: number
  exportedAt: string
  catalogues: Catalogue[]
}

const gzipped = (b: Uint8Array) => b.length > 2 && b[0] === 0x1f && b[1] === 0x8b

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(bytes as BodyInit).body!.pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

/** The catalogues as one gzip-compressed JSON file (plain JSON where the browser cannot compress). */
export async function buildBundle(catalogues: Catalogue[], now: string): Promise<Uint8Array> {
  const bundle: Bundle = { format: BUNDLE_FORMAT, version: BUNDLE_VERSION, exportedAt: now, catalogues }
  const raw = new TextEncoder().encode(JSON.stringify(bundle))
  return typeof CompressionStream === 'undefined' ? raw : pipe(raw, new CompressionStream('gzip'))
}

/** Reads a bundle; undefined when the bytes are not one (so the caller can try them as BSData files). */
export async function readBundle(bytes: Uint8Array): Promise<Catalogue[] | undefined> {
  let raw = bytes
  if (gzipped(raw)) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open compressed files')
    raw = await pipe(raw, new DecompressionStream('gzip'))
  }
  if (raw[0] !== 0x7b) return undefined
  let data: Partial<Bundle>
  try {
    data = JSON.parse(new TextDecoder().decode(raw))
  } catch {
    return undefined
  }
  if (data.format !== BUNDLE_FORMAT) return undefined
  if (typeof data.version !== 'number' || data.version > BUNDLE_VERSION) throw new Error('This catalogue file is from a newer MiniTracker. Update the app first.')
  const list = data.catalogues
  if (!Array.isArray(list) || list.some((c) => !c || typeof c.gameId !== 'string' || !Array.isArray(c.datasheets) || !Array.isArray(c.factions) || !c.source)) {
    throw new Error('The catalogue file is damaged')
  }
  return list
}
