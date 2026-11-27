import { isDesktopApp } from '../../app/platform'
import type { SourceFile } from './bsdata'

/**
 * Downloads One Page Rules army books from Army Forge's public (undocumented) API. Army Forge sends no CORS headers,
 * so this works in the desktop and Android apps (Tauri's HTTP plugin) and on the local dev server, which forwards the
 * requests (see server.proxy in vite.config.ts). A published web build cannot download.
 */

const API = 'https://army-forge.onepagerules.com/api/army-books'
const SYSTEM_IDS: Record<string, number> = {
  'grimdark-future': 2,
  'grimdark-future-firefight': 3,
  'age-of-fantasy': 4,
  'age-of-fantasy-skirmish': 5,
  'age-of-fantasy-regiments': 6,
}
/** Requests at a time, to go easy on the server. */
const PARALLEL = 4

type Fetch = typeof fetch

interface BookSummary {
  uid: string
  modifiedAt: string
}

/** Only `npm run dev` has the forwarding proxy (tests run in "test" mode, builds in "production"). */
const hasDevProxy = (): boolean => import.meta.env.MODE === 'development'

export const canDownloadOpr = (): boolean => isDesktopApp() || hasDevProxy()

const viaDevProxy: Fetch = (url, init) => fetch(String(url).replace(API, '/opr-api'), init)

async function appFetch(): Promise<Fetch> {
  if (!isDesktopApp()) {
    if (hasDevProxy()) return viaDevProxy
    throw new Error('The browser cannot download from Army Forge. Use the desktop or Android app, or import army book files.')
  }
  return (await import('@tauri-apps/plugin-http')).fetch
}

async function get(url: string, f: Fetch): Promise<Response> {
  const res = await f(url)
  if (!res.ok) throw new Error(`Could not download from Army Forge (HTTP ${res.status})`)
  return res
}

async function listBooks(slug: string, f: Fetch): Promise<BookSummary[]> {
  const list = (await (await get(`${API}?filters=official&gameSystemSlug=${slug}`, f)).json()) as BookSummary[]
  if (!Array.isArray(list) || !list.length) throw new Error('Army Forge returned no army books')
  return list
}

const slugOf = (repo: string) => repo.replace('army-forge/', '')

/** A version id for the whole game: changes when any book is added, removed or modified. */
export async function latestOprVersion(repo: string, f?: Fetch): Promise<string> {
  const books = await listBooks(slugOf(repo), f ?? (await appFetch()))
  const text = books.map((b) => `${b.uid}:${b.modifiedAt}`).sort().join('\n')
  const hash = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text))
  return [...new Uint8Array(hash)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

export async function downloadOprBooks(repo: string, onProgress: (done: number, total: number) => void = () => {}, f?: Fetch): Promise<SourceFile[]> {
  const use = f ?? (await appFetch())
  const slug = slugOf(repo)
  const books = await listBooks(slug, use)
  const out: SourceFile[] = new Array(books.length)
  let next = 0
  let done = 0
  onProgress(0, books.length)
  await Promise.all(
    Array.from({ length: PARALLEL }, async () => {
      while (next < books.length) {
        const i = next++
        const res = await get(`${API}/${encodeURIComponent(books[i].uid)}?gameSystem=${SYSTEM_IDS[slug]}`, use)
        out[i] = { name: `${books[i].uid}.json`, text: await res.text() }
        onProgress(++done, books.length)
      }
    }),
  )
  return out
}
