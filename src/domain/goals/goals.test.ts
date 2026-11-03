import { describe, expect, it } from 'vitest'
import { DEFAULT_PIPELINE } from '../collection/pipeline'
import type { OwnedUnit, StatusEvent } from '../collection/types'
import { goalHistory, goalProgress, goalTitle, parseGoals, periodLabel, periodRange, validateGoal, type Goal } from './goals'

const p = DEFAULT_PIPELINE
const NOW = '2026-11-18T12:00:00Z'
const ev = (date: string, count: number, to = 'painted'): StatusEvent => ({ id: date + count, unitId: 'u', groupId: 'g', from: 'built', to, count, date, direction: 'forward', note: '' })
const unit = (id: string, groups: [number, string][], createdAt = '2026-01-01'): OwnedUnit =>
  ({ id, customName: id, lifecycle: 'active', createdAt, groups: groups.map(([count, status], i) => ({ id: `${id}${i}`, count, status, loadout: [], magnetised: [] })) }) as unknown as OwnedUnit
const base = { id: 'g', title: '', createdAt: '2026-01-01' }

it('periodRange', () => {
  expect(periodRange('month', NOW)).toEqual(['2026-11-01', '2026-12-01'])
  expect(periodRange('year', NOW)).toEqual(['2026-01-01', '2027-01-01'])
  expect(periodRange('week', NOW)).toEqual(['2026-11-16', '2026-11-23'])
  expect(periodRange('month', '2026-12-31')).toEqual(['2026-12-01', '2027-01-01'])
  expect(periodLabel('year', '2026-01-01')).toBe('2026')
  expect(periodLabel('week', '2026-11-16')).toBe('week of 2026-11-16')
  expect(periodLabel('month', '2026-11-01')).toMatch(/2026/)
})

describe('goalProgress', () => {
  const events = [ev('2026-11-02', 4), ev('2026-11-17', 3), ev('2026-10-10', 12), ev('2026-11-05', 2, 'primed')]
  it('models per period', () => {
    const g: Goal = { ...base, kind: 'models', count: 10, period: 'month' }
    expect(goalProgress(g, [], events, p, NOW)).toMatchObject({ current: 7, target: 10, done: false, text: '7 / 10 models' })
    expect(goalProgress({ ...g, period: 'week' }, [], events, p, NOW)).toMatchObject({ current: 3 })
    expect(goalHistory(g, [], events, p, NOW, 3).map((x) => [x.current, x.done])).toEqual([[12, true], [0, false], [0, false]])
  })
  it('history stops at the goal start and is empty for other kinds', () => {
    const g: Goal = { ...base, createdAt: '2026-10-15', kind: 'models', count: 1, period: 'month' }
    expect(goalHistory(g, [], events, p, NOW)).toHaveLength(1)
    expect(goalHistory({ ...base, kind: 'streak', weeks: 2 }, [], events, p, NOW)).toEqual([])
  })
  it('pile shrink', () => {
    const units = [unit('new', [[5, 'sprue']], '2026-11-03'), unit('old', [[9, 'built']])]
    const g: Goal = { ...base, kind: 'pile', period: 'month' }
    expect(goalProgress(g, units, events, p, NOW)).toMatchObject({ done: true, text: '7 painted, 5 added (+2 net)' })
    expect(goalProgress(g, [...units, unit('n2', [[3, 'sprue']], '2026-11-04')], events, p, NOW)).toMatchObject({ done: false, current: 0, text: '7 painted, 8 added (-1 net)' })
  })
  it('streak', () => {
    const r = goalProgress({ ...base, kind: 'streak', weeks: 4 }, [], [ev('2026-11-17', 1), ev('2026-11-10', 1)], p, NOW)
    expect(r).toMatchObject({ current: 2, target: 4, done: false, when: 'best 2 wk' })
  })
  it('finish chosen units, with due date', () => {
    const units = [unit('a', [[3, 'painted'], [2, 'built']]), unit('b', [[5, 'varnished']]), unit('c', [[1, 'wishlisted']])]
    const g: Goal = { ...base, kind: 'units', unitIds: ['a', 'b', 'c'], due: '2026-11-01' }
    expect(goalProgress(g, units, [], p, NOW)).toMatchObject({ current: 8, target: 10, done: false, overdue: true, when: 'by 2026-11-01' })
    expect(goalProgress({ ...g, unitIds: ['b'], due: undefined }, units, [], p, NOW)).toMatchObject({ done: true, overdue: false })
    expect(goalProgress({ ...g, unitIds: ['c'] }, units, [], p, NOW).done).toBe(false)
  })
})

it('validate, title, parse', () => {
  expect(() => validateGoal({ ...base, kind: 'models', count: 0, period: 'month' })).toThrow(/models/)
  expect(() => validateGoal({ ...base, kind: 'streak', weeks: 0 })).toThrow(/weeks/)
  expect(() => validateGoal({ ...base, kind: 'units', unitIds: [] })).toThrow(/unit/)
  expect(() => validateGoal({ ...base, kind: 'pile', period: 'year' })).not.toThrow()
  expect(goalTitle({ ...base, title: ' Mine ', kind: 'pile', period: 'year' })).toBe('Mine')
  expect(goalTitle({ ...base, kind: 'models', count: 10, period: 'month' })).toBe('Paint 10 models a month')
  expect(goalTitle({ ...base, kind: 'pile', period: 'month' })).toBe('Shrink the pile every month')
  expect(goalTitle({ ...base, kind: 'streak', weeks: 8 })).toBe('Paint every week for 8 weeks')
  expect(goalTitle({ ...base, kind: 'units', unitIds: ['a'], due: '2026-12-01' })).toBe('Finish 1 unit by 2026-12-01')
  expect(goalTitle({ ...base, kind: 'units', unitIds: ['a', 'b'] })).toBe('Finish 2 units')
  expect(parseGoals(null)).toEqual([])
  expect(parseGoals([{ ...base, kind: 'pile', period: 'month' }, { id: 'x', kind: 'nope' }])).toHaveLength(1)
})
