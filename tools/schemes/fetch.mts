// Polite fetcher: identifies itself, waits between requests, honours Retry-After, caches pages on disk.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const UA = 'MiniTrackerBot/0.1 (+https://github.com/Giacomo-Antonioli/MiniTracker)'
const CACHE = new URL('./.cache/', import.meta.url)
const DELAY_MS = 3000
let last = 0

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function getPage(url: string): Promise<string> {
  mkdirSync(CACHE, { recursive: true })
  const file = new URL(createHash('sha1').update(url).digest('hex') + '.html', CACHE)
  if (existsSync(file)) return readFileSync(file, 'utf8')
  for (let attempt = 0; attempt < 3; attempt++) {
    const wait = last + DELAY_MS - Date.now()
    if (wait > 0) await sleep(wait)
    last = Date.now()
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow' })
    if (res.status === 429 || res.status === 503) {
      const retry = Number(res.headers.get('retry-after')) || 60
      console.warn(`  ${res.status} on ${url}, waiting ${retry}s`)
      await sleep(retry * 1000)
      continue
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    const html = await res.text()
    if (html.length < 500) throw new Error(`Empty or blocked page for ${url} (bot protection?)`)
    writeFileSync(file, html)
    return html
  }
  throw new Error(`Gave up on ${url}`)
}
