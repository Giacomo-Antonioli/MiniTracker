// Builds src/data/schemes/library.json from public recipe pages.
// Usage: npm run schemes:scrape          (pages are cached in tools/schemes/.cache)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { buildDraft, matchPaint } from '../../src/domain/schemes/extract.ts'
import type { PaintDef } from '../../src/domain/paints/types.ts'
import type { PaintScheme } from '../../src/domain/schemes/types.ts'
import { blogPost, paintPad, paintPadListing, type Scraped } from './adapters.mts'
import { getPage } from './fetch.mts'

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'))
const sources = read('./sources.json')
const curation = read('./curation.json')
const paints: PaintDef[] = read('../../src/data/paints/seed.json').paints

const MIN_STEPS = 3
const MIN_MATCH = 0.6

const slug = (s: string) => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const norm = (s: string) => s.toLowerCase().replace(/['’]/g, '')

const schemes: PaintScheme[] = []
const libPaints = new Map<string, PaintDef>()
const report: string[] = []

for (const f of sources.factions) {
  const jobs: { url: string; site: string; name?: string }[] = [...f.pages]
  for (const l of f.listings) {
    let url: string | undefined = l.url
    for (let page = 0; url && page < l.maxPages; page++) {
      const { urls, next } = paintPadListing(await getPage(url), url)
      jobs.push(...urls.map((u) => ({ url: u, site: 'paintpad' })))
      url = next
    }
  }
  console.log(`${f.faction}: ${jobs.length} pages`)

  for (const job of jobs) {
    let s: Scraped
    try {
      const html = await getPage(job.url)
      s = job.site === 'paintpad' ? paintPad(html) : blogPost(html, job.name ?? new URL(job.url).hostname)
    } catch (e) {
      report.push(`SKIP  ${job.url}  (${(e as Error).message})`)
      continue
    }
    const d = buildDraft(s.blocks, paints)
    const ratio = d.stats.paints ? d.stats.matched / d.stats.paints : 0
    const id = `lib/${slug(s.site)}-${job.url.match(/\/recipes\/(\d+)/)?.[1] ?? slug(new URL(job.url).pathname)}`
    const verdict = d.stats.steps < MIN_STEPS ? 'too few steps' : ratio < MIN_MATCH ? 'too many unknown paints' : curation.exclude.includes(id) ? 'excluded' : 'ok'
    report.push(`${verdict === 'ok' ? 'OK  ' : 'DROP'}  ${id}  "${s.title}" by ${s.author ?? '?'}  steps=${d.stats.steps} paints=${d.stats.paints} matched=${Math.round(ratio * 100)}%  ${verdict === 'ok' ? '' : `(${verdict})`}`)
    if (verdict !== 'ok') continue

    const tags = f.tags.filter((t: string) => norm(s.title).includes(norm(t)))
    let n = 0
    const scheme: PaintScheme = {
      id,
      name: s.title,
      description: `Community recipe from ${s.site}${s.author ? ` by ${s.author}` : ''}. Steps and paints only; see the source for the full guide.`,
      origin: 'community',
      factionName: f.faction,
      stage: 'final',
      tags,
      tips: '',
      tutorials: [],
      source: { title: `${s.title} (${s.site})`, url: job.url, ...(s.author ? { author: s.author } : {}) },
      sections: d.sections.map((sec) => ({ id: `${id}/a${++n}`, area: sec.area, steps: sec.steps.map((st) => ({ ...st, id: `${id}/s${++n}` })) })),
      createdAt: s.date ? new Date(s.date).toISOString() : '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-11-02T00:00:00.000Z',
      ...(curation.overrides[id] ?? {}),
    }
    schemes.push(scheme)
    for (const p of d.newPaints) libPaints.set(p.id, p)
  }
}

// Hand-curated entries (structure only, notes in our own words) for pages a scraper can't read cleanly.
for (const file of readdirSync(new URL('./manual/', import.meta.url))) {
  const m = read(`./manual/${file}`)
  let n = 0
  const missing: string[] = []
  const sections = m.sections.map((sec: { area: string; steps: { technique: string; paints: { name: string; brand?: string; parts?: number }[]; thinning?: string; note?: string }[] }) => ({
    id: `${m.id}/a${++n}`,
    area: sec.area,
    steps: sec.steps.map((st) => ({
      id: `${m.id}/s${++n}`,
      technique: st.technique,
      paints: st.paints.map((p) => {
        const paintId = matchPaint(p.name, p.brand, paints)
        if (!paintId) missing.push(p.name)
        return { paintId: paintId ?? `unknown/${slug(p.name)}`, ...(p.parts ? { parts: p.parts } : {}) }
      }),
      ...(st.thinning ? { thinning: st.thinning } : {}),
      note: st.note ?? '',
    })),
  }))
  if (missing.length) throw new Error(`${file}: unknown paints ${missing.join(', ')}`)
  schemes.push({
    id: m.id, name: m.name, factionName: m.factionName, origin: 'community', stage: 'final', tags: m.tags, tips: '', tutorials: [], source: m.source,
    description: `Community recipe${m.source.author ? ` by ${m.source.author}` : ''}. Steps and paints only; see the source for the full guide.`,
    sections, createdAt: new Date(m.date).toISOString(), updatedAt: '2026-11-02T00:00:00.000Z',
  })
  report.push(`MANUAL ${m.id}  "${m.name}"`)
}

schemes.sort((a, b) => (a.factionName ?? '').localeCompare(b.factionName ?? '') || a.name.localeCompare(b.name))
const usedLib = new Set(schemes.flatMap((s) => s.sections.flatMap((x) => x.steps.flatMap((st) => st.paints.map((p) => p.paintId)))))
writeFileSync(
  new URL('../../src/data/schemes/library.json', import.meta.url),
  JSON.stringify({ generatedBy: 'tools/schemes/scrape.mts', schemes, paints: [...libPaints.values()].filter((p) => usedLib.has(p.id)) }),
)
writeFileSync(new URL('./report.txt', import.meta.url), report.join('\n') + '\n')
console.log(report.join('\n'))
console.log(`\n${schemes.length} schemes written, ${libPaints.size} extra paints`)
