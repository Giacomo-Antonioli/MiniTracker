import { describe, expect, it } from 'vitest'
import { addCard, CARDS, DEFAULT_LAYOUT, hiddenCards, moveCard, parseLayout, removeCard, setOption, setSize } from './layout'

describe('home layout', () => {
  it('starts with the default cards, and offers the rest to add', () => {
    expect(DEFAULT_LAYOUT[0]).toEqual({ id: 'tiles', size: 'L' })
    expect(hiddenCards(DEFAULT_LAYOUT).map((c) => c.id)).toEqual(CARDS.filter((c) => !DEFAULT_LAYOUT.some((d) => d.id === c.id)).map((c) => c.id))
  })

  it('moves, resizes, removes and adds cards, at a given place', () => {
    const l = [{ id: 'tiles', size: 'L' }, { id: 'recent', size: 'M' }, { id: 'oldest', size: 'S' }] as const
    expect(moveCard([...l], 'oldest', 0).map((c) => c.id)).toEqual(['oldest', 'tiles', 'recent'])
    expect(moveCard([...l], 'tiles', 9).map((c) => c.id)).toEqual(['recent', 'oldest', 'tiles'])
    expect(setSize([...l], 'recent', 'S')[1]).toEqual({ id: 'recent', size: 'S' })
    const r = removeCard([...l], 'recent')
    expect(r.map((c) => c.id)).toEqual(['tiles', 'oldest'])
    expect(addCard(r, 'spending', 1).map((c) => c.id)).toEqual(['tiles', 'spending', 'oldest'])
    expect(addCard(r, 'spending')[2]).toEqual({ id: 'spending', size: 'M' })
    expect(addCard(r, 'tiles')).toBe(r)
    expect(setOption([...l], 'recent', 'count', 10)[1]).toEqual({ id: 'recent', size: 'M', options: { count: 10 } })
  })

  it('reads a saved layout, dropping unknown cards, duplicates and bad sizes', () => {
    expect(parseLayout(JSON.stringify([{ id: 'oldest', size: 'L' }, { id: 'gone', size: 'S' }, { id: 'oldest', size: 'S' }, { id: 'recent', size: 'XL' }]))).toEqual([{ id: 'oldest', size: 'L' }, { id: 'recent', size: 'M' }])
    expect(parseLayout(null)).toEqual(DEFAULT_LAYOUT)
    expect(parseLayout('nope')).toEqual(DEFAULT_LAYOUT)
    expect(parseLayout('{}')).toEqual(DEFAULT_LAYOUT)
  })
})
