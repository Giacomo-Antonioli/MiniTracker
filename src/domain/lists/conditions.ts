import type { Condition, DataLimit } from '../catalogue/types'

/** How many of something the list has: by BSData id (battle size, detachment, unit, enhancement, force) or by keyword. */
export type Counter = (leaf: { id?: string; keyword?: string }) => number

export function evalCondition(c: Condition, count: Counter): boolean {
  if ('all' in c) return c.all.every((x) => evalCondition(x, count))
  if ('any' in c) return c.any.some((x) => evalCondition(x, count))
  const n = count(c)
  switch (c.op) {
    case 'atLeast':
      return n >= c.value
    case 'atMost':
      return n <= c.value
    case 'equalTo':
      return n === c.value
    case 'notEqualTo':
      return n !== c.value
    case 'lessThan':
      return n < c.value
    case 'greaterThan':
      return n > c.value
    case 'instanceOf':
      return n > 0
    case 'notInstanceOf':
      return n === 0
  }
}

/** The limit for this list after its modifiers; -1 means no limit. */
export function evalLimit(l: DataLimit, count: Counter): number {
  let max = l.max
  for (const m of l.modifiers) {
    if (m.when && !evalCondition(m.when, count)) continue
    max = m.type === 'set' ? m.value : m.type === 'increment' ? max + m.value : max - m.value
  }
  return max
}
