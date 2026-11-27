import { isDesktopApp } from '../../app/platform'
import type { SourceFile } from './bsdata'

/**
 * Downloads One Page Rules army books. Army Forge's public (undocumented) API sends no CORS headers, so:
 * - the desktop and Android apps call it through Tauri's HTTP plugin;
 * - the local dev server forwards the requests (server.proxy in vite.config.ts);
 * - the published web app reads the copy the Pages deploy makes next to the site (tools/opr/mirror.mjs).
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

/** Where the books come from: Army Forge's API, or the site's copy of it. */
export interface OprSource {
  fetch: Fetch
  listUrl(slug: string): string
  bookUrl(slug: string, uid: string): string
}

export const apiSource = (f: Fetch, base: string = API): OprSource => ({
  fetch: f,
  listUrl: (slug) => `${base}?filters=official&gameSystemSlug=${slug}`,
  bookUrl: (slug, uid) => `${base}/${encodeURIComponent(uid)}?gameSystem=${SYSTEM_IDS[slug]}`,
})

export const siteSource = (f: Fetch, base: string): OprSource => ({
  fetch: f,
  listUrl: (slug) => `${base}opr/${slug}/index.json`,
  bookUrl: (slug, uid) => `${base}opr/${slug}/${encodeURIComponent(uid)}.json`,
})

async function defaultSource(): Promise<OprSource> {
  if (isDesktopApp()) return apiSource((await import('@tauri-apps/plugin-http')).fetch)
  const web: Fetch = (url, init) => fetch(url, init)
  // Only `npm run dev` runs in "development" mode (tests use "test", builds "production").
  return import.meta.env.MODE === 'development' ? apiSource(web, '/opr-api') : siteSource(web, import.meta.env.BASE_URL)
}

async function get(url: string, from: OprSource): Promise<Response> {
  const res = await from.fetch(url)
  if (!res.ok) throw new Error(`Could not download the One Page Rules army books (HTTP ${res.status}). You can still import army book files.`)
  return res
}

async function listBooks(slug: string, from: OprSource): Promise<BookSummary[]> {
  const list = (await (await get(from.listUrl(slug), from)).json()) as BookSummary[]
  if (!Array.isArray(list) || !list.length) throw new Error('No One Page Rules army books were found')
  return list
}

const slugOf = (repo: string) => repo.replace('army-forge/', '')

/** A version id for the whole game: changes when any book is added, removed or modified. */
export async function latestOprVersion(repo: string, from?: OprSource): Promise<string> {
  const books = await listBooks(slugOf(repo), from ?? (await defaultSource()))
  const text = books.map((b) => `${b.uid}:${b.modifiedAt}`).sort().join('\n')
  const hash = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text))
  return [...new Uint8Array(hash)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

export async function downloadOprBooks(repo: string, onProgress: (done: number, total: number) => void = () => {}, from?: OprSource): Promise<SourceFile[]> {
  const use = from ?? (await defaultSource())
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
        const res = await get(use.bookUrl(slug, books[i].uid), use)
        out[i] = { name: `${books[i].uid}.json`, text: await res.text() }
        onProgress(++done, books.length)
      }
    }),
  )
  return out
}
