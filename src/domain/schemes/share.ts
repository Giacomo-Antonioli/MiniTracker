/** Share links for schemes (#95): the scheme file, compressed into the URL hash. No server involved. */
export const SHARE_HASH = '#scheme='

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream))
  return new Uint8Array(await out.arrayBuffer())
}

const toB64url = (b: Uint8Array) => btoa(Array.from(b, (c) => String.fromCharCode(c)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

/** Compresses text into a URL-safe token. */
export async function encodeShare(text: string): Promise<string> {
  return toB64url(await pipe(new TextEncoder().encode(text), new CompressionStream('deflate-raw')))
}

/** Reverses encodeShare; throws a friendly error on a broken link. */
export async function decodeShare(token: string): Promise<string> {
  try {
    return new TextDecoder().decode(await pipe(fromB64url(token), new DecompressionStream('deflate-raw')))
  } catch {
    throw new Error('This share link is broken or incomplete')
  }
}

export const shareToken = (hash: string): string | null => (hash.startsWith(SHARE_HASH) && hash.length > SHARE_HASH.length ? hash.slice(SHARE_HASH.length) : null)

export async function shareUrl(base: string, text: string): Promise<string> {
  return `${base.split('#')[0]}${SHARE_HASH}${await encodeShare(text)}`
}

/** The URL when it is a plain http(s) link, else undefined (shared schemes may carry anything). */
export function httpUrl(u: string): URL | undefined {
  try {
    const url = new URL(u.trim())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : undefined
  } catch {
    return undefined
  }
}
