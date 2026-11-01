import { describe, expect, it } from 'vitest'
import { evalCondition, evalLimit } from './conditions'

const count = (has: Record<string, number>) => ({ id, keyword }: { id?: string; keyword?: string }) => has[id ?? keyword ?? ''] ?? 0

describe('evalCondition', () => {
  it.each([
    ['atLeast', 2, 2, true],
    ['atLeast', 2, 1, false],
    ['atMost', 1, 1, true],
    ['atMost', 1, 2, false],
    ['equalTo', 0, 0, true],
    ['notEqualTo', 0, 1, true],
    ['lessThan', 1, 0, true],
    ['greaterThan', 1, 1, false],
    ['instanceOf', 1, 1, true],
    ['notInstanceOf', 1, 1, false],
  ] as const)('%s %i with %i → %s', (op, value, n, result) => {
    expect(evalCondition({ op, value, id: 'x' }, count({ x: n }))).toBe(result)
  })

  it('combines with all / any and counts keywords', () => {
    const c = { any: [{ op: 'equalTo' as const, value: 1, id: 'sf' }, { all: [{ op: 'equalTo' as const, value: 1, id: 'inc' }, { op: 'atLeast' as const, value: 1, keyword: '3DP' }] }] }
    expect(evalCondition(c, count({ sf: 1 }))).toBe(true)
    expect(evalCondition(c, count({ inc: 1 }))).toBe(false)
    expect(evalCondition(c, count({ inc: 1, '3DP': 1 }))).toBe(true)
  })
})

describe('evalLimit', () => {
  it('applies set, increment and decrement in order when their condition holds', () => {
    const l = {
      max: 2,
      modifiers: [
        { type: 'set' as const, value: 3, when: { op: 'atLeast' as const, value: 1, id: 'sf' } },
        { type: 'increment' as const, value: 2 },
        { type: 'decrement' as const, value: 1, when: { op: 'atLeast' as const, value: 1, id: 'x' } },
      ],
    }
    expect(evalLimit(l, count({}))).toBe(4)
    expect(evalLimit(l, count({ sf: 1 }))).toBe(5)
    expect(evalLimit(l, count({ sf: 1, x: 1 }))).toBe(4)
  })
})
