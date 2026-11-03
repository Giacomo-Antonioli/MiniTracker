// Builds src/data/paints/seed.json from MIT-licensed open paint catalogues listed in sources.json.
// Usage: npm run paints:seed   (add brands or bump commits in sources.json, no code change needed)
import { readFileSync, writeFileSync } from 'node:fs'
import { colourFamily } from '../../src/domain/paints/family.ts'

const cfg = JSON.parse(readFileSync(new URL('./sources.json', import.meta.url), 'utf8'))
const hex = ({ r, g, b }) => '#' + [r, g, b].map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('')
const slug = (s) => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const get = async (url, json) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return json ? res.json() : res.text()
}

const paints = []
const seen = new Set()

// minipainter: JSON catalogues with types and colour families.
const mp = cfg.minipainter
for (const [file, brand] of Object.entries(mp.files)) {
  const data = await get(`https://raw.githubusercontent.com/${mp.repo}/${mp.commit}/data/catalog/${file}.json`, true)
  for (const p of data.paints) {
    if (!p.id || !p.name || !p.rgb || seen.has(p.id)) continue
    seen.add(p.id)
    paints.push({ id: p.id, brand, name: p.name, ...(p.usage_roles?.[0] ? { type: p.usage_roles[0] } : {}), ...(p.color_families?.[0] ? { family: p.color_families[0] } : {}), hex: hex(p.rgb) })
  }
}

// miniature-paints: Markdown tables (Name | [Code] | Set | R | G | B | Hex); type from the range, family from the colour.
const md = cfg.miniaturePaints
for (const [file, b] of Object.entries(md.files)) {
  const text = await get(`https://raw.githubusercontent.com/${md.repo}/${md.commit}/paints/${file}.md`)
  const lines = text.split('\n').filter((l) => l.startsWith('|'))
  const head = lines[0].split('|').map((c) => c.trim())
  const col = (name) => head.indexOf(name)
  for (const line of lines.slice(2)) {
    const c = line.split('|').map((x) => x.trim())
    const name = c[col('Name')]
    const set = c[col('Set')]
    const rgb = { r: +c[col('R')], g: +c[col('G')], b: +c[col('B')] }
    if (!name || [rgb.r, rgb.g, rgb.b].some(Number.isNaN)) continue
    // Metal colours are sold inside normal ranges too ("Cokum Copper").
    const type = /\b(gold|silver|steel|bronze|brass|copper|metal|chrome|iron|aluminium|titanium|gunmetal|platinum)\b/i.test(name) ? 'metallic' : b.types[set]
    if (!type) throw new Error(`${file}: no type for range "${set}" (add it to sources.json)`)
    let id = `${b.id}/${slug(name)}`
    if (seen.has(id)) id = `${b.id}/${slug(name)}-${slug(set.replace(/range/i, ''))}`
    if (seen.has(id)) continue
    seen.add(id)
    const h = hex(rgb)
    paints.push({ id, brand: b.brand, name, type, family: colourFamily(h, type), hex: h, range: set.replace(/\s+/g, ' ') })
  }
}

paints.sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name))
const sources = [mp, md].map((s) => ({ repo: s.repo, commit: s.commit, license: s.license }))
writeFileSync(new URL('../../src/data/paints/seed.json', import.meta.url), JSON.stringify({ source: sources[0], sources, paints }))
console.log(`wrote ${paints.length} paints`)
