import { describe, expect, it } from 'vitest'
import type { OwnedUnit } from '../collection/types'
import {
  elapsedMs, formatClock, formatMinutes, minutesByFaction, minutesByStage, minutesByUnit, minutesPer, minutesThisWeek, newTimer,
  parseSessions, parseTimers, pauseTimer, pruneTimers, resumeTimer, splitMinutes, stopTimer, totalMinutes, validateSession, type PaintSession,
} from './paintTime'

let n = 0
const c = (now: string) => ({ now, newId: () => `id${++n}` })
const T0 = '2026-11-03T10:00:00.000Z'
const at = (min: number, day = '2026-11-03') => new Date(new Date(day + 'T10:00:00Z').getTime() + min * 60000).toISOString()

describe('timer', () => {
  it('runs, pauses across days, resumes and stops into split sessions', () => {
    let t = newTimer([{ unitId: 'a', groupId: 'g1', count: 10 }, { unitId: 'b', groupId: 'g2', count: 5 }], c(T0), 'primed', 'batch')
    expect(elapsedMs(t, at(30))).toBe(30 * 60000)
    t = pauseTimer(t, at(30))
    expect(pauseTimer(t, at(50))).toBe(t)
    expect(elapsedMs(t, at(0, '2026-11-04'))).toBe(30 * 60000)
    t = resumeTimer(t, at(0, '2026-11-04'))
    expect(resumeTimer(t, at(5, '2026-11-04'))).toBe(t)
    const s = stopTimer(t, c(at(30, '2026-11-04')))
    expect(s.map((x) => [x.unitId, x.minutes, x.date, x.stage, x.note])).toEqual([['a', 40, '2026-11-04', 'primed', 'batch'], ['b', 20, '2026-11-04', 'primed', 'batch']])
  })
  it('needs a target and skips groups that get 0 minutes', () => {
    expect(() => newTimer([], c(T0))).toThrow(/group/)
    const t = newTimer([{ unitId: 'a', groupId: 'g', count: 1 }, { unitId: 'b', groupId: 'h', count: 0 }], c(T0))
    expect(stopTimer(t, c(at(3)))).toHaveLength(1)
  })
})

it('splitMinutes keeps the total', () => {
  expect(splitMinutes(10, [1, 1, 1])).toEqual([4, 3, 3])
  expect(splitMinutes(7, [0, 0])).toEqual([4, 3])
  expect(splitMinutes(0, [2])).toEqual([0])
})

it('formats', () => {
  expect(formatMinutes(45)).toBe('45 min')
  expect(formatMinutes(65)).toBe('1 h 05 min')
  expect(formatClock(3723000)).toBe('1:02:03')
})

const s = (unitId: string, minutes: number, date: string, stage?: string): PaintSession => ({ id: unitId + date + minutes, unitId, groupId: 'g', minutes, date, stage, note: '' })

it('totals', () => {
  const list = [s('a', 30, '2026-11-02', 'primed'), s('b', 60, '2026-11-03'), s('a', 15, '2026-10-30', 'primed'), s('x', 5, '2026-11-01')]
  const units = [{ id: 'a', factionName: 'Tau' }, { id: 'b' }] as OwnedUnit[]
  expect(totalMinutes(list)).toBe(110)
  expect(minutesByUnit(list)).toEqual([{ key: 'b', minutes: 60 }, { key: 'a', minutes: 45 }, { key: 'x', minutes: 5 }])
  expect(minutesByStage(list)).toEqual([{ key: 'primed', minutes: 45 }, { key: '', minutes: 65 }].sort((p, q) => q.minutes - p.minutes))
  expect(minutesByFaction(list, units)).toEqual([{ key: 'No faction', minutes: 65 }, { key: 'Tau', minutes: 45 }])
  expect(minutesPer(list, ['2026-10', '2026-11'])).toEqual([15, 95])
  expect(minutesThisWeek(list, '2026-11-03T12:00:00Z')).toBe(90)
})

it('validate, parse, prune', () => {
  const ok = s('a', 10, '2026-11-03')
  expect(() => validateSession(ok)).not.toThrow()
  expect(() => validateSession({ ...ok, minutes: 0 })).toThrow(/Minutes/)
  expect(() => validateSession({ ...ok, groupId: '' })).toThrow(/group/)
  expect(() => validateSession({ ...ok, date: '' })).toThrow(/date/)
  expect(parseSessions(null)).toEqual([])
  expect(parseSessions([{ ...ok, note: undefined }, { id: 1 }])).toEqual([ok])
  expect(parseTimers('x')).toEqual([])
  const t = { ...newTimer([{ unitId: 'a', groupId: 'g', count: 1 }], c(T0)), note: undefined }
  expect(parseTimers([t, {}])).toHaveLength(1)
  const units = [{ id: 'a', groups: [{ id: 'g' }] }] as OwnedUnit[]
  const t2 = newTimer([{ unitId: 'a', groupId: 'g', count: 1 }, { unitId: 'a', groupId: 'gone', count: 1 }], c(T0))
  const t3 = newTimer([{ unitId: 'z', groupId: 'g', count: 1 }], c(T0))
  expect(pruneTimers([t2, t3], units).map((x) => x.targets.length)).toEqual([1])
})
