// Site adapters: page HTML → recipe blocks + metadata. Only facts are kept (areas, steps, paints); no prose or images.
import { parse, type HTMLElement } from 'node-html-parser'
import type { SourceBlock } from '../../src/domain/schemes/extract.ts'

export interface Scraped {
  title: string
  author?: string
  date?: string
  site: string
  blocks: SourceBlock[]
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()
const text = (el: HTMLElement | null | undefined) => clean(el?.text ?? '')

/** Paint Pad: structured recipe (headings, steps, tagged paint swatches; brands in the Paints tab). */
export function paintPad(html: string): Scraped {
  const doc = parse(html)
  const brandOf = new Map<string, string>()
  for (const range of doc.querySelectorAll('.paint-list__range')) {
    const brand = text(range.querySelector('.paint-list__range-heading .paint-list__label'))
    for (const sw of range.querySelectorAll('.paint-list__paint .paint-swatch')) brandOf.set(text(sw), brand)
  }
  const blocks: SourceBlock[] = []
  const method = doc.querySelector('.recipe-page__method')
  for (const el of method?.querySelectorAll('.recipe-item') ?? []) {
    const content = el.querySelector('.recipe-item__content')
    if (el.classList.contains('recipe-item--heading')) {
      blocks.push({ type: 'heading', text: text(content) })
    } else if (el.classList.contains('recipe-item--step')) {
      const paints = (content?.querySelectorAll('.paint-swatch') ?? []).map((sw) => {
        const name = text(sw)
        const hex = sw.querySelector('.paint-swatch__sample')?.getAttribute('style')?.match(/#[0-9a-f]{6}/i)?.[0]
        return { name, brand: brandOf.get(name), hex }
      })
      blocks.push({ type: 'step', text: text(content), paints })
    }
  }
  const title = text(doc.querySelector('title')).replace(/\s*\|\s*Paint Pad$/, '')
  const m = title.match(/^(.*) by (.*)$/)
  const date = html.match(/Published\s*<\/[^>]+>\s*<[^>]+>\s*([^<]+)</)?.[1]?.trim()
  return { title: m ? m[1] : title, author: m?.[2], date, site: 'Paint Pad', blocks }
}

/** Paint Pad faction listing → recipe URLs and the next page. */
export function paintPadListing(html: string, base: string): { urls: string[]; next?: string } {
  const doc = parse(html)
  const urls = [...new Set(doc.querySelectorAll('a[href^="/recipes/"]').map((a) => a.getAttribute('href')!).filter((h) => /^\/recipes\/\d+/.test(h)))].map(
    (h) => new URL(h, base).toString(),
  )
  const next = doc.querySelectorAll('a').find((a) => /^next/i.test(text(a)))?.getAttribute('href')
  return { urls, next: next ? new URL(next, base).toString() : undefined }
}

const AREAS: [RegExp, string][] = [
  [/\b(cloth|trousers|sleeves|gloves|balaclava|robe|fabric)/i, 'Cloth'],
  [/\b(armou?r|plates?|helmet|panel)/i, 'Armour'],
  [/\bskin\b/i, 'Skin'],
  [/\b(lens|lenses|eye|eyes|osl|glow)/i, 'Lenses'],
  [/\b(gun|weapon|rifle|hooves)/i, 'Weapons'],
  [/\b(marking|symbol|sept)/i, 'Markings'],
  [/\b(base|rim)\b/i, 'Base'],
]

/** Blog posts (Tale of Painters, Army Painter…): numbered/bulleted list items become steps, grouped by area keywords. */
export function blogPost(html: string, site: string): Scraped {
  const doc = parse(html)
  const article = doc.querySelector('.entry-content') ?? doc.querySelector('article') ?? doc.querySelector('.article__content') ?? doc
  const blocks: SourceBlock[] = []
  let area = ''
  for (const li of article.querySelectorAll('ol > li')) {
    const t = text(li)
    if (t.length < 8) continue
    const a = AREAS.find(([re]) => re.test(t))?.[1] ?? area
    if (a && a !== area) {
      blocks.push({ type: 'heading', text: a })
      area = a
    }
    blocks.push({ type: 'step', text: t })
  }
  const title = clean(doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? text(doc.querySelector('title')))
  const author = doc.querySelector('meta[name="author"]')?.getAttribute('content') ?? text(doc.querySelector('.author a, a[rel="author"]'))
  const date = doc.querySelector('meta[property="article:published_time"]')?.getAttribute('content')?.slice(0, 10)
  return { title, author: author || undefined, date, site, blocks }
}

const decode = (s: string) => parse(s).text
const htext = (s: string) => clean(decode(s.replace(/<[^>]+>/g, ' ')))

export interface EavyStep { text: string; stage: string; paints: { name: string; parts?: number }[]; note: string }
export interface EavyScheme { slug: string; title: string; areas: { area: string; tags: string[]; steps: EavyStep[] }[] }

/** 'Eavy Archive faction page: each modal is a scheme, each card an area, each <li> "Stage: Paint & Paint 1:1" a step. */
export function eavyArchive(html: string): EavyScheme[] {
  const out: EavyScheme[] = []
  const modals = html.split(/<div class="modal m-0" id="/).slice(1)
  for (const m of modals) {
    const slug = m.slice(0, m.indexOf('"'))
    const title = decode(m.match(/data-recipe-title="([^"]*)"/)?.[1] ?? slug)
    const areas: EavyScheme['areas'] = []
    for (const card of m.split(/<div class="card mb-3" id="/).slice(1)) {
      const area = htext(card.match(/<h5 class="card-title">([\s\S]*?)<(?:a|button|\/h5)/)?.[1] ?? '')
      const tags = [...card.matchAll(/>#([^<]+)<\/button>/g)].map((t) => t[1].trim())
      const steps: EavyStep[] = []
      for (const li of card.match(/<ol>([\s\S]*?)<\/ol>/)?.[1].match(/<li>[\s\S]*?<\/li>/g) ?? []) {
        // Generic names ("Black") link to alternatives; the last one is the Citadel paint.
        const raw = li.replace(/<a [^>]*data-bs-content="([^"]*)"[^>]*>[\s\S]*?<\/a>/g, (_, alts: string) => decode(alts).split(';').pop()!.trim())
        const line = htext(raw)
        const colon = line.indexOf(':')
        const stage = colon > 0 ? line.slice(0, colon).trim() : ''
        let body = colon > 0 ? line.slice(colon + 1).trim() : line
        // "(Ridges & Edges)" is a note; "A/B 3:1" or "A & B 1:1" is a mix; "A, B, C" are used one after another.
        const note = [...body.matchAll(/\(([^)]*)\)/g)].map((x) => x[1].trim()).join('; ')
        body = body.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
        const ratio = body.match(/\s*(\d+(?::\d+)+)\s*$/)
        if (ratio) body = body.slice(0, ratio.index).trim()
        const parts = ratio?.[1].split(':').map(Number)
        const names = body.split(/\s*(?:&|\/|,|\+|\bor\b|\band\b)\s*/).filter(Boolean)
        steps.push({ text: line, stage, note, paints: names.map((name, i) => ({ name, ...(parts && parts.length === names.length ? { parts: parts[i] } : {}) })) })
      }
      if (area && steps.length) areas.push({ area, tags, steps })
    }
    if (areas.length) out.push({ slug, title, areas })
  }
  return out
}
