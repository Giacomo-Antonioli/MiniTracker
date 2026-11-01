// Builds src/data/paints/seed.json from the MIT-licensed minipainter catalogue.
// Usage: node tools/paints/build-seed.mjs   (re-run to update; bump COMMIT to take a newer version)
import { writeFileSync } from 'node:fs'

const REPO = 'ArturSkowronski/minipainter'
const COMMIT = 'fe3fd9b34f93ffcc5cad147b397f9493e90db9d6'
const FILES = { citadel: 'Citadel', army_painter: 'Army Painter', vallejo: 'Vallejo', ak_interactive: 'AK Interactive' }

const hex = ({ r, g, b }) => '#' + [r, g, b].map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('')

const paints = []
const seen = new Set()
for (const [file, brand] of Object.entries(FILES)) {
  const res = await fetch(`https://raw.githubusercontent.com/${REPO}/${COMMIT}/data/catalog/${file}.json`)
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`)
  const data = await res.json()
  for (const p of data.paints) {
    if (!p.id || !p.name || !p.rgb || seen.has(p.id)) continue
    seen.add(p.id)
    paints.push({
      id: p.id,
      brand,
      name: p.name,
      ...(p.usage_roles?.[0] ? { type: p.usage_roles[0] } : {}),
      ...(p.color_families?.[0] ? { family: p.color_families[0] } : {}),
      hex: hex(p.rgb),
    })
  }
}
paints.sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name))
const out = { source: { repo: REPO, commit: COMMIT, license: 'MIT' }, paints }
writeFileSync(new URL('../../src/data/paints/seed.json', import.meta.url), JSON.stringify(out))
console.log(`wrote ${paints.length} paints`)
