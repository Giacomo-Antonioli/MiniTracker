import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { listFromJson, listFromRoster, listFromText, listToJson, listToText } from '../../domain/lists/io'
import { parseBsData } from '../catalogue/bsdata'
import { parseRosterXml, readRoster } from './rosz'

const raw = import.meta.glob('../catalogue/fixtures/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const cat = parseBsData(Object.entries(raw).map(([p, text]) => ({ name: p.split('/').pop()!, text })), { repo: 'BSData/wh40k-11e', commit: 'c', fetchedAt: 'f' })
const ros = (import.meta.glob('./fixtures/walkers.ros', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['./fixtures/walkers.ros']
let n = 0
const ctx = { now: 't', newId: () => `id${++n}` }

describe('rosters (.ros / .rosz)', () => {
  it('reads a zipped roster the same as the XML', () => {
    const zipped = zipSync({ 'walkers.ros': strToU8(ros) })
    expect(readRoster(zipped)).toEqual(parseRosterXml(ros))
    expect(readRoster(strToU8(ros)).forces[0]).toMatchObject({ catalogueId: 'cat-testers', catalogueName: 'Test - Testers' })
  })

  it('matches units, models, battle size, detachment, enhancement and Warlord by BSData ids', () => {
    const { list, warnings } = listFromRoster(readRoster(strToU8(ros)), cat, '11e', ctx)
    expect(list).toMatchObject({ name: 'Walker Strike', edition: '11e', factionId: 'cat-testers', battleSize: 'bs-sf', pointsLimit: 2000, detachmentIds: ['det-line'] })
    expect(list.entries.map((e) => [e.datasheetId, e.models, e.enhancementId, e.warlord])).toEqual([
      ['u-walker', 1, 'enh-charm', true],
      ['u-troopers', 8, undefined, undefined],
    ])
    expect(warnings).toEqual(['Not in the catalogue: Mystery Unit'])
  })

  it('rejects files that are not rosters, and rosters without a force', () => {
    expect(() => readRoster(strToU8('<x/>'))).toThrow(/not a BattleScribe roster/)
    expect(() => readRoster(zipSync({}))).toThrow(/empty/)
    expect(() => listFromRoster({ name: 'x', forces: [] }, cat, '11e', ctx)).toThrow(/no army/)
  })

  it('warns about extra forces, unknown factions and a guessed battle size', () => {
    const r = parseRosterXml(ros.replace('catalogueId="cat-testers"', 'catalogueId="other"').replace('catalogueName="Test - Testers"', 'catalogueName="Other"').replace(/<selection id="s1"[\s\S]*?<\/selection>\s*<\/selections>\s*<\/selection>/, ''))
    const { list, warnings } = listFromRoster({ ...r, forces: [...r.forces, r.forces[0]] }, cat, '11e', ctx)
    expect(warnings).toEqual(['Only the first of 2 forces was imported', 'Faction not found: Other', 'Not in the catalogue: Mystery Unit', 'Battle size not found: chosen from the points'])
    expect(list.battleSize).toBe('bs-inc')
    expect(list.factionId).toBeUndefined()
  })
})

describe('text lists', () => {
  it('reads a GW-app style list by names', () => {
    const text = [
      'My Walkers (500 points)',
      '',
      'Testers',
      'Strike Force (2,000 Points)',
      'Line Doctrine',
      '',
      'CHARACTERS',
      'Big Walker (165 Points)',
      '  • Warlord',
      '  • Enhancements: Lucky Charm',
      '',
      'BATTLELINE',
      'Line Troopers (160 Points)',
      '  • 1x Sergeant',
      '  • 7x Trooper',
      '     ◦ 1x Flamer',
      '2x Big Walker (300 points)',
      'Unknown Thing (50 points)',
    ].join('\n')
    const { list, warnings } = listFromText(text, cat, '11e', ctx)
    expect(list).toMatchObject({ name: 'My Walkers', factionId: 'cat-testers', battleSize: 'bs-sf', detachmentIds: ['det-line'] })
    expect(list.entries.map((e) => [e.datasheetId, e.models, e.enhancementId ?? null, !!e.warlord])).toEqual([
      ['u-walker', 1, 'enh-charm', true],
      ['u-troopers', 8, null, false],
      ['u-walker', 1, null, false],
      ['u-walker', 1, null, false],
    ])
    expect(warnings).toEqual(['Not in the catalogue: Unknown Thing'])
  })

  it('infers the faction from the units, clamps odd model counts, and says when nothing matched', () => {
    const { list, warnings } = listFromText('Line Troopers (80 pts)\n- 30x Trooper\n', cat, '11e', ctx)
    expect(list.factionId).toBeDefined()
    expect(list.entries[0].models).toBe(10)
    expect(warnings).toEqual(['Line Troopers: 30 models read, set to 10', 'Battle size not found: chosen from the points'])
    expect(listFromText('hello\nworld', cat, '11e', ctx).warnings).toContain('No units recognised')
  })

  it('round-trips: export as text, read back the same list', () => {
    const { list } = listFromRoster(readRoster(strToU8(ros)), cat, '11e', ctx)
    const text = listToText(list, cat, '11th edition')
    expect(text).toContain('Walker Strike (')
    expect(text).toContain('Detachment: Line Doctrine')
    expect(text).toContain('  • Enhancement: Lucky Charm (+15)')
    const { list: back, warnings } = listFromText(text, cat, '11e', ctx)
    expect(warnings).toEqual([])
    // Text groups units by role, so compare without order.
    const shape = (l: typeof list) => ({ ...l, id: '', createdAt: '', updatedAt: '', entries: l.entries.map((e) => JSON.stringify({ ...e, id: '' })).sort() })
    expect(shape(back)).toEqual(shape(list))
  })
})

describe('MiniTracker JSON', () => {
  it('round-trips with a new id, and rejects other files', () => {
    const { list } = listFromRoster(readRoster(strToU8(ros)), cat, '11e', ctx)
    const back = listFromJson(listToJson(list), ctx).list
    expect({ ...back, id: list.id, createdAt: list.createdAt, updatedAt: list.updatedAt }).toEqual(list)
    expect(back.id).not.toBe(list.id)
    expect(() => listFromJson('nope', ctx)).toThrow(/not valid JSON/)
    expect(() => listFromJson('{"format":"x"}', ctx)).toThrow(/not a MiniTracker list/)
    expect(() => listFromJson(JSON.stringify({ format: 'minitracker-list', version: 9, list }), ctx)).toThrow(/newer version/)
  })
})

describe('import/export edge cases', () => {
  const bare = { ...cat, detachments: undefined, enhancements: undefined, muster: undefined }

  it('reads a roster with missing names and numbers against a catalogue without muster data', () => {
    const r = parseRosterXml('<roster><forces><force><selections><selection type="unit"/><selection entryId="u-walker" number="0" type="model"/></selections></force></forces></roster>')
    expect(r.name).toBe('')
    expect(r.forces[0].selections[0]).toEqual({ ids: [], name: '', type: 'unit', number: 1, children: [] })
    const { list, warnings } = listFromRoster(r, bare, '10e', ctx)
    expect(list).toMatchObject({ name: 'Imported list', battleSize: 'combat-patrol', pointsLimit: 500, detachmentIds: [] })
    expect(list.entries.map((e) => [e.datasheetId, e.models])).toEqual([['u-walker', 1]])
    expect(warnings).toEqual(['Faction not found: unknown', 'Not in the catalogue: ', 'Battle size not found: chosen from the points'])
    expect(() => parseRosterXml('<<<')).toThrow(/not a BattleScribe roster/)
  })

  it('picks the biggest battle size when the points are over every limit; reads several detachments', () => {
    const text = ['Huge', 'Detachments: Line Doctrine, Heavy Doctrine', '30x Big Walker (4500 points)'].join('\n')
    const { list } = listFromText(text, cat, '11e', ctx)
    expect(list).toMatchObject({ battleSize: 'bs-sf', detachmentIds: ['det-heavy', 'det-line'] })
    expect(list.entries).toHaveLength(30)
  })

  it('exports without a catalogue', () => {
    const l = { ...listFromText('Big Walker (150 points)', cat, '11e', ctx).list, factionId: undefined, detachmentIds: ['gone'], entries: [{ id: 'e', datasheetId: 'gone', models: 1, wargear: [], warlord: true, enhancementId: 'x' }] }
    expect(listToText(l, undefined, '11th edition')).toBe('Big Walker (0 points)\n11th edition · 1000 points\nDetachment: Unknown detachment\n\nOTHER\nUnknown unit (0 points)\n  • Warlord\n  • 1x model\n')
  })
})
