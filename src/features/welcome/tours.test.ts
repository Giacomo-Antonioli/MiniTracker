import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TOURS } from './tours'
import type { TourAction, TourTarget } from './tourTarget'

/** All .tsx sources, to check every tour id is put on some element. */
function sources(dir: string): string {
  return readdirSync(dir)
    .map((f) => join(dir, f))
    .map((p) => (statSync(p).isDirectory() ? sources(p) : p.endsWith('.tsx') && !p.includes('.test.') ? readFileSync(p, 'utf8') : ''))
    .join('\n')
}

const ids = (t?: TourTarget) => (t && 'css' in t ? [...t.css.matchAll(/data-tour~="([^"]+)"/g)].map((m) => m[1]) : [])
const actionTargets = (a: TourAction) => ('click' in a ? [a.click] : 'fill' in a ? [a.fill] : 'pick' in a ? [a.pick] : [])

describe('tour targets', () => {
  const code = sources(join(__dirname, '../..'))
  const used = Object.values(TOURS).flatMap((t) => t.steps.flatMap((s) => [s.target, ...(s.before ?? []).flatMap(actionTargets)].flatMap(ids)))
  it.each([...new Set(used)])('data-tour="%s" is on an element', (id) => {
    // Literal ids, or ids built from a template like data-tour={`view-${v}`} / {`${k}-total`}.
    const literal = code.includes(`data-tour="${id}"`)
    const templated = [...code.matchAll(/data-tour=\{`([^`]+)`\}/g)].some((m) => new RegExp(`^${m[1].replace(/\$\{[^}]+\}/g, '[\\w-]+')}$`).test(id))
    const prop = code.includes(`tour="${id}"`)
    expect(literal || templated || prop).toBe(true)
  })
})
