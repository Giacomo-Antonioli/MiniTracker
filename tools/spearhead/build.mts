/**
 * Builds src/data/spearhead/boxes.json (#99): the fixed contents of every Age of Sigmar Spearhead army.
 * Spearhead has no machine-readable data, so this reads the free rules PDFs Games Workshop publishes on
 * Warhammer Community. Wahapedia's faction pages link each faction's PDFs, which is how they are found.
 * Only facts are stored (army name, faction, units and model counts) with a link to the PDF.
 * Needs `pdftotext` (poppler-utils). Run with: npm run spearhead:build
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CACHE = 'tools/spearhead/.cache'
const OUT = 'src/data/spearhead/boxes.json'
const FACTIONS: string[] = JSON.parse(readFileSync('tools/spearhead/factions.json', 'utf8'))
const UA = { 'User-Agent': 'MiniTracker data builder (https://github.com/Giacomo-Antonioli/MiniTracker)' }

mkdirSync(CACHE, { recursive: true })
const slug = (s: string) => s.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

async function cached(url: string, file: string): Promise<Buffer> {
  const path = join(CACHE, file)
  if (!existsSync(path)) {
    const res = await fetch(url, { headers: UA })
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
    writeFileSync(path, Buffer.from(await res.arrayBuffer()))
    await new Promise((r) => setTimeout(r, 1000))
  }
  return readFileSync(path)
}

export interface Entry {
  name: string
  models: number
}
export interface SpearheadBox {
  id: string
  name: string
  faction: string
  general: Entry
  units: Entry[]
  source: string
}

const BULLET = /^(\s*)([^\sA-Za-z0-9(])\s+(\S.*)$/
const first = (s: string) => s.trim().split(/\s{3,}/)[0].trim()
const isHeading = (re: RegExp) => (l: string) => re.test(l.replace(/(?<=[A-Z]) (?=[A-Z])/g, ''))
const GENERAL = isHeading(/^\s*GENERAL\b/)
const UNITS = isHeading(/^\s*UNITS\b/)

/** "5 Freeguild Fusiliers with 1 Blackpowder Squire token" → { models: 5, name: 'Freeguild Fusiliers' }. */
export function entry(text: string): Entry {
  // "Even though the Sunblood Pack is a unit of three models, it is referred to as your ‘general’."
  const note = /unit of (\w+) models/.exec(text)?.[1]
  const t = text
    .replace(/Designer[’']s Note:.*$/, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+with (?:\d+ )?[^,]*tokens?\b.*$/i, '')
    .replace(/‑/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  const m = /^(\d+)\s+(.*)$/.exec(t)
  const words: Record<string, number> = { two: 2, three: 3, four: 4, five: 5 }
  return m ? { models: Number(m[1]), name: m[2] } : { models: (note && words[note]) || 1, name: t }
}

const SMALL = new Set(['of', 'the', 'and', 'a', 'in', 'on'])
/** "FANGS OF THE BLOOD GOD" → "Fangs of the Blood God", "FUSIL-PLATOON" → "Fusil-Platoon". */
export const titleCase = (s: string) =>
  s
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.replace(/(^|-)(\p{L})/gu, (_, p: string, c: string) => p + c.toUpperCase())))
    .join(' ')

/** Reads the army page of a Spearhead PDF (as `pdftotext -layout` prints it). */
export function parseSpearhead(text: string): Omit<SpearheadBox, 'id' | 'faction' | 'source'> | undefined {
  const L = text.split('\n')
  const ci = L.findIndex((l) => l.includes('This Spearhead army consists'))
  const gi = L.findIndex(GENERAL)
  if (ci < 0 || gi < 0) return undefined
  // Army name: the last all-caps heading above "This Spearhead army consists" (the faction is the one before it).
  const heads = L.slice(0, ci).map(first).filter((s) => s && s !== 'SPEARHEAD' && /[A-Z]/.test(s) && s === s.toUpperCase())
  const items: Record<'general' | 'units', string[]> = { general: [], units: [] }
  let sect: 'general' | 'units' = 'general'
  let textCol: number | undefined
  for (const l of L.slice(gi + 1, gi + 45)) {
    if (UNITS(l)) {
      sect = 'units'
      continue
    }
    const m = BULLET.exec(l)
    if (m) {
      textCol = l.length - l.trimStart().length + m[2].length + 1
      items[sect].push(first(m[3]))
      continue
    }
    const s = first(l)
    const indent = l.length - l.trimStart().length
    const list = items[sect]
    if (s && textCol !== undefined && Math.abs(indent - textCol) <= 1 && s.length < 32 && list.length) list[list.length - 1] += ' ' + s
    else if (sect === 'units' && list.length) break
  }
  if (!items.general.length || !items.units.length) return undefined
  const name = heads.at(-1)!
  return { name: titleCase(name), general: entry(items.general.join(' ')), units: items.units.map(entry) }
}

async function main() {
  const boxes = new Map<string, SpearheadBox>()
  for (const faction of FACTIONS) {
    let html: string
    try {
      html = (await cached(`https://wahapedia.ru/aos4/factions/${slug(faction)}/`, `${slug(faction)}.html`)).toString('utf8')
    } catch (e) {
      console.warn(`no faction page for ${faction}: ${(e as Error).message}`)
      continue
    }
    const pdfs = [...new Set(html.match(/https:\/\/assets\.warhammer-community\.com\/[^"]*spearhead[^"]*\.pdf/gi) ?? [])]
    for (const url of pdfs) {
      const file = url.split('/').at(-1)!
      await cached(url, file)
      const text = execFileSync('pdftotext', ['-layout', '-l', '2', join(CACHE, file), '-'], { encoding: 'utf8' })
      const box = parseSpearhead(text)
      if (!box) {
        console.warn(`skipped (layout not recognised): ${file}`)
        continue
      }
      const id = slug(box.name)
      // Newer PDFs of the same army replace older ones (the file names start with the publication date).
      const prev = boxes.get(id)
      if (!prev || file > prev.source.split('/').at(-1)!) boxes.set(id, { id, faction, ...box, source: url })
    }
  }
  const out = [...boxes.values()].sort((a, b) => a.faction.localeCompare(b.faction) || a.name.localeCompare(b.name))
  writeFileSync(OUT, JSON.stringify({ source: 'Warhammer Community Spearhead rules PDFs', boxes: out }, null, 1) + '\n')
  console.log(`${out.length} Spearhead armies → ${OUT}`)
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
