import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TEXT } from './text'

/** Every non-test source file. */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(p) && !p.includes('.test.') ? [p] : []
  })
}

/** The English strings passed to tx()/txr(): 'single', "double" or `template without ${}`. */
function englishStrings(code: string): string[] {
  const out: string[] = []
  for (const m of code.matchAll(/\btxr?\(\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\])*)`)/g)) {
    const raw = m[1] ?? m[2] ?? m[3]
    out.push(raw.replace(/\\n/g, '\n').replace(/\\(.)/g, '$1'))
  }
  return out
}

const src = join(__dirname, '..')
const used = new Map<string, string>()
for (const f of files(src)) for (const s of englishStrings(readFileSync(f, 'utf8'))) used.set(s, f.slice(src.length + 1))
const dict = Object.assign({}, ...Object.values(TEXT)) as Record<string, string[]>
const vars = (s: string) => [...s.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort()

describe('page text (tx)', () => {
  it('never builds the English text at run time', () => {
    for (const f of files(src)) expect(readFileSync(f, 'utf8'), f).not.toMatch(/\btxr?\(\s*`[^`]*\$\{/)
  })
  it.each([...used])('"%s" has all five translations with the same placeholders', (english, file) => {
    const tr = dict[english]
    expect(tr, `missing in src/i18n/text (used in ${file})`).toBeDefined()
    expect(tr.filter((x) => x && x.trim()).length).toBe(5)
    for (const x of tr) expect(vars(x)).toEqual(vars(english))
  })
})
