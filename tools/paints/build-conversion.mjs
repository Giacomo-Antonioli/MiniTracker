// Builds src/data/paints/conversion.json from tools/paints/conversion-source.json
// (the Citadel conversion chart published by Warhammer Guild, https://warhammerguild.com/guides/paint-conversion-chart/).
// Each row becomes a group of paint ids that are close substitutes for each other.
// Usage: npm run paints:conversion
import { readFileSync, writeFileSync } from 'node:fs'

const rows = JSON.parse(readFileSync(new URL('./conversion-source.json', import.meta.url), 'utf8'))
const seed = JSON.parse(readFileSync(new URL('../../src/data/paints/seed.json', import.meta.url), 'utf8')).paints
const norm = (s) => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const byName = (brand) => new Map(seed.filter((p) => p.brand === brand).map((p) => [norm(p.name), p.id]))
const citadel = byName('Citadel')
const army = byName('Army Painter')
const vallejoPaints = seed.filter((p) => p.brand === 'Vallejo')
// Some entries in the paint list have a name but no range or code. When the chart uses such a name for a Game Color
// paint in one row and a different Model Color paint in another, the entry can't be both, so neither row gets it.
const chartName = (cell) => norm(cell?.replace(/\s*\(\d\d\.\d{3}\)$/, '') ?? '')
const only = (col, other) => new Set(rows.filter((r) => r[col] && chartName(r[col]) !== chartName(r[other])).map((r) => chartName(r[col])))
const gameOnly = only('vallejo_game', 'vallejo_model')
const ambiguous = new Set([...only('vallejo_model', 'vallejo_game')].filter((n) => gameOnly.has(n)))
// By range and code when the list has them, else by name when that is unambiguous.
const vallejo = (range, name, code) => {
  const byCode = code && vallejoPaints.find((p) => p.range === range && norm(p.name) === norm(name) && p.id.endsWith('-' + code.replace('.', '-')))
  if (byCode) return byCode.id
  const byName = vallejoPaints.filter((p) => norm(p.name) === norm(name) && (!p.range || p.range === range))
  const [hit] = byName
  if (byName.length !== 1 || (!hit.range && ambiguous.has(norm(name)))) return undefined
  return hit.id
}

const groups = []
const missing = []
for (const r of rows) {
  const ids = []
  const add = (label, id) => (id ? ids.push(id) : label && missing.push(label))
  add(r.citadel, citadel.get(norm(r.citadel)))
  for (const [col, range] of [['vallejo_game', 'Game Color'], ['vallejo_model', 'Model Color']]) {
    const m = r[col]?.match(/^(.*?)\s*(?:\((\d\d\.\d{3})\))?$/)
    if (r[col] && m) add(`${r[col]} (${range})`, vallejo(range, m[1], m[2]))
  }
  if (r.army_painter) add(`${r.army_painter} (Army Painter)`, army.get(norm(r.army_painter)))
  const unique = [...new Set(ids)]
  if (unique.length > 1 && citadel.has(norm(r.citadel))) groups.push(unique)
}
writeFileSync(new URL('../../src/data/paints/conversion.json', import.meta.url), JSON.stringify(groups) + '\n')
console.log(`${groups.length} groups from ${rows.length} rows`)
if (missing.length) console.log('Not in the paint list:', missing.join('; '))
