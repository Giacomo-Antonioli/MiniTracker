// Copies the official One Page Rules army books from Army Forge into the built site, so the web app can download them
// (Army Forge sends no CORS headers). Run by the Pages deploy; the books are never committed to the repository.
// Usage: node tools/opr/mirror.mjs <out dir> [published copy to fall back on]
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const API = 'https://army-forge.onepagerules.com/api/army-books'
const GAMES = { 'grimdark-future': 2, 'grimdark-future-firefight': 3, 'age-of-fantasy': 4, 'age-of-fantasy-skirmish': 5, 'age-of-fantasy-regiments': 6 }
const [out, fallback] = process.argv.slice(2)
if (!out) throw new Error('Usage: node tools/opr/mirror.mjs <out dir> [published copy to fall back on]')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function get(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    } catch (e) {
      if (attempt === 3) throw new Error(`${url}: ${e.message}`)
      await sleep(2000 * attempt)
    }
  }
}

/** All books of one game, fetched one at a time to go easy on the server. Nothing is returned unless all arrive. */
async function fetchGame(listUrl, bookUrl) {
  const list = JSON.parse(await get(listUrl))
  if (!Array.isArray(list) || !list.length) throw new Error(`${listUrl}: no army books`)
  const files = new Map()
  for (const { uid } of list) {
    if (!/^[\w-]+$/.test(uid)) throw new Error(`Unexpected book id: ${uid}`)
    const text = await get(bookUrl(uid))
    if (!Array.isArray(JSON.parse(text).units)) throw new Error(`${uid}: not an army book`)
    files.set(`${uid}.json`, text)
    await sleep(150)
  }
  files.set('index.json', JSON.stringify(list.map(({ uid, modifiedAt }) => ({ uid, modifiedAt }))))
  return files
}

let failed = false
for (const [slug, system] of Object.entries(GAMES)) {
  let files
  try {
    files = await fetchGame(`${API}?filters=official&gameSystemSlug=${slug}`, (uid) => `${API}/${uid}?gameSystem=${system}`)
  } catch (e) {
    console.log(`::warning::Army Forge download failed for ${slug}: ${e.message}`)
    // Keep what the site already has rather than publishing without the game.
    try {
      if (!fallback) throw new Error('no fallback given')
      files = await fetchGame(`${fallback}/${slug}/index.json`, (uid) => `${fallback}/${slug}/${uid}.json`)
      console.log(`${slug}: kept the published copy`)
    } catch (e2) {
      console.log(`::error::No copy of ${slug}: ${e2.message}`)
      failed = true
      continue
    }
  }
  await mkdir(join(out, slug), { recursive: true })
  for (const [name, text] of files) await writeFile(join(out, slug, name), text)
  console.log(`${slug}: ${files.size - 1} books`)
}
// Failing the job leaves the previous deployment online.
if (failed) process.exit(1)
