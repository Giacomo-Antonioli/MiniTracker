import { describe, expect, it } from 'vitest'
import { parseBsData } from './bsdata'

// Small hand-made JSON catalogue for the parser's edge cases (missing limits, unreadable conditions, broken links).
const gst = {
  gameSystem: {
    id: 'g', name: 'Edge Game',
    costTypes: [{ id: 'pts', name: 'pts' }],
    forceEntries: [{ id: 'army', name: 'Main Force', constraints: [{ id: 'c1', type: 'max', field: 'pts', value: 0 }] }],
  },
}
const det = (id: string, extra: object = {}) => ({ type: 'upgrade', id, name: `Det ${id}`, ...extra })
const cat = {
  catalogue: {
    id: 'f', name: 'Edge Faction', library: false,
    sharedSelectionEntries: [
      {
        type: 'upgrade', id: 'root-det', name: 'Detachment',
        selectionEntryGroups: [
          {
            id: 'g-det', name: 'Detachment',
            selectionEntries: [
              det('a'),
              det('hidden', { hidden: true }),
              det('odd', { modifiers: [{ type: 'set', field: 'hidden', value: true, conditions: [{ type: 'weird', childId: 'x', value: 1 }] }] }),
              det('always-hidden', { modifiers: [{ type: 'set', field: 'hidden', value: true }] }),
            ],
            entryLinks: [{ id: 'l1', name: 'Missing', type: 'selectionEntry', targetId: 'nowhere' }],
          },
        ],
      },
    ],
    sharedSelectionEntryGroups: [
      { id: 'e1', name: 'Loose Enhancements', selectionEntries: [{ type: 'upgrade', id: 'orphan', name: 'Orphan' }] },
      {
        id: 'e2', name: 'A Enhancements',
        modifiers: [{ type: 'set', field: 'hidden', value: true, conditions: [{ type: 'lessThan', childId: 'a', value: 1 }] }],
        selectionEntries: [{ type: 'upgrade', id: 'gift', name: 'Gift' }, { type: 'upgrade', id: 'gone', name: 'Gone', hidden: true }, { type: 'model', id: 'm', name: 'Not an upgrade' }],
      },
    ],
  },
}

const c = parseBsData([{ name: 'g.json', text: JSON.stringify(gst) }, { name: 'f.json', text: JSON.stringify(cat) }], { repo: 'r', commit: 'c', fetchedAt: 'f' })

describe('parseBsData edge cases', () => {
  it('reads a main force without detachment or enhancement limits', () => {
    expect(c.muster).toEqual({ battleSizes: [], keywordMinimums: [], forceId: 'army' })
  })

  it('keeps detachments with unreadable hide conditions, skips hidden ones, ignores broken links', () => {
    expect(c.detachments!.map((d) => d.id)).toEqual(['a', 'odd'])
    expect(c.detachments![0]).toMatchObject({ detachmentPoints: 0, keywords: [] })
    expect(c.detachmentCounts).toEqual({ f: { min: 0, max: { max: -1, modifiers: [] } } })
  })

  it('takes enhancements only from groups linked to a detachment, without hidden or non-upgrade entries', () => {
    expect(c.enhancements).toEqual([{ id: 'gift', name: 'Gift', points: 0, detachmentId: 'a' }])
  })
})

describe('unit sizes from real-data layouts', () => {
  const sel = (o: object) => ({ type: 'selections', field: 'selections', scope: 'parent', ...o })
  const lim = (min?: number, max?: number) => [...(min !== undefined ? [sel({ id: `n${min}`, type: 'min', value: min })] : []), ...(max !== undefined ? [sel({ id: `x${max}`, type: 'max', value: max })] : [])]
  const model = (id: string, constraints: object[] = []) => ({ type: 'model', id, name: id, constraints })
  const units = [
    // Leader plus a "4-9" group whose model has no limit of its own.
    { type: 'unit', id: 'hg', name: 'Hearthguard', selectionEntries: [model('hesyr', lim(1, 1))], selectionEntryGroups: [{ id: 'g', name: '4-9', constraints: lim(4, 9), selectionEntries: [model('hg-m')] }] },
    // Size options: pick one bundle.
    {
      type: 'unit', id: 'krieg', name: 'Krieg',
      selectionEntryGroups: [{ id: 'comp', name: 'Unit Composition', constraints: lim(1, 1), selectionEntries: [
        { type: 'upgrade', id: 'o10', name: '10', selectionEntries: [model('t1', lim(10, 10))] },
        { type: 'upgrade', id: 'o20', name: '20', selectionEntries: [model('t2', lim(20, 20))] },
      ] }],
    },
    // Models through links that carry the count.
    { type: 'unit', id: 'jak', name: 'Jakhals', selectionEntries: [model('lead', lim(1, 1))], entryLinks: [{ id: 'l', name: 'Jakhal', type: 'selectionEntry', targetId: 'jakhal', constraints: lim(9, 9) }] },
  ]
  const g = { gameSystem: { id: 'g', name: 'G', costTypes: [{ id: 'pts', name: 'pts' }] } }
  const c2 = { catalogue: { id: 'f2', name: 'Sizes', library: false, entryLinks: units.map((u) => ({ id: `r-${u.id}`, name: u.name, type: 'selectionEntry', targetId: u.id })), sharedSelectionEntries: [...units, model('jakhal')] } }
  const parsed = parseBsData([{ name: 'g.json', text: JSON.stringify(g) }, { name: 'c.json', text: JSON.stringify(c2) }], { repo: 'r', commit: 'c', fetchedAt: 'f' })
  const size = (n: string) => { const d = parsed.datasheets.find((x) => x.name === n)!; return [d.minModels, d.maxModels] }

  it('reads them', () => {
    expect(size('Hearthguard')).toEqual([5, 10])
    expect(size('Krieg')).toEqual([10, 20])
    expect(size('Jakhals')).toEqual([10, 10])
  })
})
