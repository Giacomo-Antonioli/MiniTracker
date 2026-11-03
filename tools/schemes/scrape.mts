// Builds src/data/schemes/library.json from public recipe pages.
// Usage: npm run schemes:scrape          (pages are cached in tools/schemes/.cache)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { buildDraft, matchPaint } from '../../src/domain/schemes/extract.ts'
import type { PaintDef } from '../../src/domain/paints/types.ts'
import type { PaintScheme } from '../../src/domain/schemes/types.ts'
import { dedupeSchemes } from '../../src/domain/schemes/dedupe.ts'
import { blogPost, eavyArchive, paintPad, paintPadListing, type Scraped } from './adapters.mts'
import { detectTechnique } from '../../src/domain/schemes/extract.ts'
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

    const septs = (f.septs ?? []).filter((t: string) => norm(s.title).includes(norm(t)))
    const appliesTo = (f.unitTypes ?? []).filter((t: string) => norm(s.title).includes(norm(t)))
    const tags = [...septs, ...appliesTo]
    let n = 0
    const scheme: PaintScheme = {
      id,
      name: s.title,
      description: `Community recipe from ${s.site}${s.author ? ` by ${s.author}` : ''}. Steps and paints only; see the source for the full guide.`,
      origin: 'community',
      factionName: f.faction,
      stage: 'final',
      tags,
      ...(appliesTo.length ? { appliesTo } : {}),
      tips: '',
      tutorials: [],
      source: { title: `${s.title} (${s.site})`, url: job.url, ...(s.author ? { author: s.author } : {}) },
      sections: d.sections.map((sec) => ({ id: `${id}/a${++n}`, area: sec.area.replace(/\s*:\s*$/, ''), steps: sec.steps.map((st) => ({ ...st, id: `${id}/s${++n}` })) })),
      createdAt: s.date ? new Date(s.date).toISOString() : '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-11-02T00:00:00.000Z',
      ...(curation.overrides[id] ?? {}),
    }
    schemes.push(scheme)
    for (const p of d.newPaints) libPaints.set(p.id, p)
  }
}

// Short names ("Fenrisian") → the one Citadel paint that starts with them.
const citadelPrefix = (name: string) => {
  const c = paints.filter((p) => p.brand === 'Citadel' && p.name.toLowerCase().startsWith(name.toLowerCase() + ' '))
  return c.length === 1 ? c[0].id : undefined
}

// 'Eavy Archive: one page per faction, many small schemes per page, Citadel paints only.
const knownFactions = new Set(sources.factions.map((f: { faction: string }) => f.faction))
for (const pg of sources.eavyArchive.pages) {
  const found = eavyArchive(await getPage(pg.url))
  console.log(`'Eavy Archive ${pg.faction}: ${found.length} schemes`)
  for (const e of found) {
    const id = `lib/eavy-${slug(pg.faction)}-${e.slug}`
    const factionName = knownFactions.has(e.title) ? e.title : pg.faction
    let n = 0, total = 0, hit = 0
    const sections = e.areas.map((a) => ({
      id: `${id}/a${++n}`,
      area: a.area,
      steps: a.steps.map((st) => {
        const found = st.paints.map((p) => ({ p, paintId: matchPaint(p.name.replace(/^XV88$/i, 'XV-88'), 'Citadel', paints) ?? citadelPrefix(p.name) }))
        const looksLikePaints = st.stage !== '' && st.paints.every((p) => p.name.split(' ').length <= 4)
        total += st.paints.length
        hit += found.filter((f) => f.paintId).length
        // Only known paints are linked; anything else stays readable in the note.
        const stepPaints = looksLikePaints ? found.filter((f) => f.paintId).map(({ p, paintId }) => ({ paintId: paintId!, ...(p.parts ? { parts: p.parts } : {}) })) : []
        const clean = looksLikePaints && stepPaints.length === st.paints.length
        const technique = detectTechnique(st.stage || st.text)
        return { id: `${id}/s${++n}`, technique, paints: stepPaints, note: clean ? [technique ? '' : st.stage, st.note].filter(Boolean).join(' · ') : st.text }
      }),
    }))
    const ratio = total ? hit / total : 0
    if (ratio < MIN_MATCH) { report.push(`DROP  ${id}  "${e.title}"  matched=${Math.round(ratio * 100)}%`); continue }
    report.push(`OK    ${id}  "${e.title}"  areas=${sections.length} matched=${Math.round(ratio * 100)}%`)
    const cfg = sources.factions.find((f: { faction: string }) => f.faction === factionName) ?? {}
    const appliesTo = (cfg.unitTypes ?? []).filter((t: string) => norm(e.title).includes(norm(t)))
    const tags = [...new Set(e.areas.flatMap((a) => a.tags))].filter((t) => !['imperium', 'astartes', 'marines', 'chaos', 'xenos'].includes(t))
    schemes.push({
      id, name: e.title, factionName, origin: 'community', stage: 'final', tags: factionName === e.title || e.title === pg.faction ? tags : [e.title, ...tags], ...(appliesTo.length ? { appliesTo } : {}), tips: '', tutorials: [],
      description: "Recipe from 'Eavy Archive. Steps and paints only; see the source for reference photos.",
      source: { title: `${e.title} ('Eavy Archive)`, url: `${pg.url}?modal=${e.slug}` },
      sections, createdAt: '2026-11-03T00:00:00.000Z', updatedAt: '2026-11-03T00:00:00.000Z',
    })
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
    id: m.id, name: m.name, factionName: m.factionName, origin: m.origin ?? 'community', stage: 'final', tags: m.tags, tips: m.tips ?? '', tutorials: [], source: m.source,
    description:
      m.origin === 'official'
        ? 'Official studio colours with a simple recipe written by MiniTracker; see the official video for the full method.'
        : `Community recipe${m.source.author ? ` by ${m.source.author}` : ''}. Steps and paints only; see the source for the full guide.`,
    sections, createdAt: new Date(m.date).toISOString(), updatedAt: '2026-11-02T00:00:00.000Z',
  })
  report.push(`MANUAL ${m.id}  "${m.name}"`)
}

// The same recipe can be listed under several factions, or posted twice by its author.
const { kept, dropped } = dedupeSchemes(schemes)
for (const d of dropped) report.push(`DUP   ${d.id}  "${d.name}"  (same as ${d.duplicateOf})`)
schemes.length = 0
schemes.push(...kept)

schemes.sort((a, b) => (a.factionName ?? '').localeCompare(b.factionName ?? '') || a.name.localeCompare(b.name))
const usedLib = new Set(schemes.flatMap((s) => s.sections.flatMap((x) => x.steps.flatMap((st) => st.paints.map((p) => p.paintId)))))
writeFileSync(
  new URL('../../src/data/schemes/library.json', import.meta.url),
  JSON.stringify({ generatedBy: 'tools/schemes/scrape.mts', schemes, paints: [...libPaints.values()].filter((p) => usedLib.has(p.id)) }),
)
writeFileSync(new URL('./report.txt', import.meta.url), report.join('\n') + '\n')
console.log(report.join('\n'))
console.log(`\n${schemes.length} schemes written, ${libPaints.size} extra paints`)
