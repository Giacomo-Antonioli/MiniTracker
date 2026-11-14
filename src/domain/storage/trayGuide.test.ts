import { describe, expect, it } from 'vitest'
import { trayPlan } from './trayGuide'

describe('trayPlan', () => {
  it('makes the hole a little wider than the base', () => {
    expect(trayPlan(32, 300, 200)?.hole).toBe(33.5)
    expect(trayPlan(28.5, 300, 200)?.hole).toBe(30)
  })
  it('counts how many cells fit, edges included', () => {
    // 32 mm base: hole 33.5, pitch 41.5; (300-8)/41.5 = 7, (200-8)/41.5 = 4
    expect(trayPlan(32, 300, 200)).toEqual({ hole: 33.5, pitch: 41.5, cols: 7, rows: 4, cells: 28 })
  })
  it('returns nothing when no hole fits or the input is bad', () => {
    expect(trayPlan(50, 40, 40)).toBeUndefined()
    expect(trayPlan(0, 300, 200)).toBeUndefined()
    expect(trayPlan(32, NaN, 200)).toBeUndefined()
  })
})
