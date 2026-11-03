import { describe, expect, it } from 'vitest'
import library from '../../data/schemes/library.json'
import { TECHNIQUES } from '../schemes/scheme'
import { TECHNIQUES_GUIDE, techniqueFor, videoSearch } from './techniques'

describe('technique guides', () => {
  it('finds a guide by id, name or alias, ignoring case and dashes', () => {
    expect(techniqueFor('wash')?.id).toBe('shade')
    expect(techniqueFor('Wet-Blend')?.id).toBe('wetblend')
    expect(techniqueFor('Edge Highlighting')?.id).toBe('edge highlight')
    expect(techniqueFor('base')?.id).toBe('basecoat')
    expect(techniqueFor('')).toBeUndefined()
    expect(techniqueFor('juggling')).toBeUndefined()
  })

  it('has a guide for every suggested technique and every technique in the library', () => {
    const used = new Set((library as { schemes: { sections: { steps: { technique: string }[] }[] }[] }).schemes.flatMap((s) => s.sections.flatMap((a) => a.steps.map((st) => st.technique))))
    for (const t of [...TECHNIQUES, ...used].filter(Boolean)) expect(techniqueFor(t), t).toBeDefined()
  })

  it('has no alias that points to two guides', () => {
    const owner = new Map<string, string>()
    for (const t of TECHNIQUES_GUIDE)
      for (const a of [t.id, t.name, ...t.aliases].map((x) => x.toLowerCase())) {
        expect(owner.get(a) ?? t.id, a).toBe(t.id)
        owner.set(a, t.id)
      }
  })

  it('links a video search', () => {
    expect(videoSearch(TECHNIQUES_GUIDE[0])).toContain('youtube.com/results?search_query=Priming')
  })
})

describe('technique details', () => {
  it('every guide has a method, tips and three credited sources', () => {
    for (const t of TECHNIQUES_GUIDE) {
      expect(t.detail?.how.length, t.id).toBeGreaterThanOrEqual(3)
      expect(t.detail?.tips.length, t.id).toBeGreaterThanOrEqual(2)
      expect(t.detail?.sources.length, t.id).toBe(3)
      for (const s of t.detail!.sources) expect(s.url, t.id).toMatch(/^https:\/\//)
    }
  })
})
