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
