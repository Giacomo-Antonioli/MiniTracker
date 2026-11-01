// Converts the hand-written XML test fixtures into BSData's JSON style (used by wh40k-11e) for parser tests.
// Usage: node tools/fixtures-to-json.mjs
import { XMLParser } from 'fast-xml-parser'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'

const dir = new URL('../src/data/catalogue/fixtures/', import.meta.url)
const out = new URL('../src/data/catalogue/fixtures-json/', import.meta.url)
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', isArray: (_n, _p, _l, isAttr) => !isAttr })
const value = (v) => (v === 'true' ? true : v === 'false' ? false : /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v)

function toJson(node) {
  const o = {}
  for (const [k, v] of Object.entries(node)) {
    if (k === '#text') o.$text = v
    else if (Array.isArray(v)) {
      if (k === 'description' || k === 'readme') o[k] = String(v[0])
      else if (k === 'alias') o[k] = v.map(String)
      else if (v.length === 1 && typeof v[0] === 'object' && Object.values(v[0]).every(Array.isArray) && Object.keys(v[0]).length === 1)
        o[k] = Object.values(v[0])[0].map(toJson) // container: { selectionEntries: [{ selectionEntry: [...] }] } → [...]
      else o[k] = toJson(v[0])
    } else o[k] = value(v)
  }
  return o
}

for (const f of readdirSync(dir)) {
  const x = parser.parse(readFileSync(new URL(f, dir), 'utf8'))
  const root = 'gameSystem' in x ? 'gameSystem' : 'catalogue'
  writeFileSync(new URL(f.replace(/\.(gst|cat)$/, '.json'), out), JSON.stringify({ [root]: toJson(x[root][0]) }, null, 1))
}
console.log('done')
