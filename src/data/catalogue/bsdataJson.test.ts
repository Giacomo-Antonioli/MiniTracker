import { describe, expect, it } from 'vitest'
import { parseBsData } from './bsdata'
import { parseBsDataJson, tagFor } from './bsdataJson'

describe('tagFor', () => {
  it.each([
    ['sharedSelectionEntries', 'selectionEntry'],
    ['selectionEntryGroups', 'selectionEntryGroup'],
    ['costs', 'cost'],
    ['conditionGroups', 'conditionGroup'],
    ['sharedRules', 'rule'],
    ['categoryEntries', 'categoryEntry'],
    ['characteristics', 'characteristic'],
  ])('%s → %s', (c, t) => expect(tagFor(c)).toBe(t))
})

describe('parseBsDataJson', () => {
  it('turns JSON into the XML parser shape', () => {
    const x = parseBsDataJson(JSON.stringify({ catalogue: { id: 'c', library: false, revision: 3, sharedRules: [{ id: 'r', name: 'R', description: 'text', alias: ['A'] }] } }))
    expect(x).toEqual({ catalogue: [{ id: 'c', library: 'false', revision: '3', sharedRules: [{ rule: [{ id: 'r', name: 'R', description: ['text'], alias: ['A'] }] }] }] })
  })
  it('rejects other JSON', () => {
    expect(() => parseBsDataJson('{"x":1}')).toThrow(/BattleScribe/)
  })
})

// The same sample data, encoded as JSON like BSData's newer repositories, must give the same catalogue as the XML.
const xml = import.meta.glob('./fixtures/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const json = import.meta.glob('./fixtures-json/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const files = (m: Record<string, string>) => Object.entries(m).map(([p, text]) => ({ name: p.split('/').pop()!, text }))
const source = { repo: 't', commit: 'c', fetchedAt: 'f' }

describe('parseBsData with JSON files', () => {
  it('gives the same catalogue as the XML version', () => {
    expect(Object.keys(json).length).toBe(Object.keys(xml).length)
    expect(parseBsData(files(json), source)).toEqual(parseBsData(files(xml), source))
  })
})
