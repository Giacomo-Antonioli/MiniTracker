import type { SourceBlock } from '../../domain/schemes/extract'

/** What the bookmarklet sends to the app (in the URL after #recipe=). */
export interface RecipePayload {
  v: 1
  url: string
  title: string
  author?: string
  site: string
  blocks: SourceBlock[]
}

const HASH = '#recipe='

export function readRecipeHash(hash: string): RecipePayload | null {
  if (!hash.startsWith(HASH)) return null
  try {
    const p = JSON.parse(decodeURIComponent(hash.slice(HASH.length))) as RecipePayload
    if (p?.v !== 1 || typeof p.url !== 'string' || !Array.isArray(p.blocks)) return null
    return { ...p, blocks: p.blocks.filter((b) => (b?.type === 'heading' || b?.type === 'step') && typeof b.text === 'string').slice(0, 500) }
  } catch {
    return null
  }
}

/**
 * Runs on the recipe page the user is reading (never on our side): collects headings, list items and
 * paragraphs (plus Paint Pad's tagged paints) and opens MiniTracker with them.
 */
function collect(appUrl: string) {
  const t = (e: Element | null) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim()
  const all = (sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll(sel))
  const root = document.querySelector('.recipe-page__method, .entry-content, article, main') ?? document.body
  const brand: Record<string, string> = {}
  for (const r of all('.paint-list__range')) for (const s of all('.paint-list__paint .paint-swatch', r)) brand[t(s)] = t(r.querySelector('.paint-list__label'))
  const blocks: unknown[] = []
  for (const e of all('h1, h2, h3, h4, li, p', root)) {
    const x = t(e)
    if (!x || x.length > 600 || (e.tagName === 'P' && e.closest('li'))) continue
    if (/^H\d$/.test(e.tagName)) {
      blocks.push({ type: 'heading', text: x })
      continue
    }
    const paints = all('.paint-swatch', e).map((s) => ({
      name: t(s),
      brand: brand[t(s)],
      hex: (s.querySelector('[style]')?.getAttribute('style')?.match(/#[0-9a-f]{6}/i) ?? [])[0],
    }))
    blocks.push(paints.length ? { type: 'step', text: x, paints } : { type: 'step', text: x })
  }
  const meta = (n: string) => document.querySelector<HTMLMetaElement>(`meta[property="${n}"], meta[name="${n}"]`)?.content
  const data = { v: 1, url: location.href, title: meta('og:title') ?? document.title, author: meta('author'), site: meta('og:site_name') ?? location.hostname, blocks: blocks.slice(0, 400) }
  window.open(`${appUrl}#recipe=${encodeURIComponent(JSON.stringify(data))}`, '_blank')
}

/** The javascript: URL to save as a bookmark. */
export function bookmarkletCode(appUrl: string): string {
  return `javascript:(${collect.toString()})(${JSON.stringify(appUrl)})`
}
