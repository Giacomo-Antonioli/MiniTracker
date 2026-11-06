import { describe, expect, it } from 'vitest'
import { carried, clampTarget, isSuccess, rerollIndices, rollD6, saveTarget, sortedDesc, successes, unsaved, woundTarget } from './dice'

describe('dice', () => {
  it('counts successes; a 1 always fails, targets stay 2+..6+', () => {
    expect(successes([1, 2, 3, 4, 5, 6], 3)).toBe(4)
    expect(isSuccess(1, 1)).toBe(false)
    expect(isSuccess(6, 9)).toBe(true)
    expect([clampTarget(1), clampTarget(7)]).toEqual([2, 6])
  })
  it('picks the dice to re-roll', () => {
    expect(rerollIndices([1, 2, 3, 1, 6], 3, 'ones')).toEqual([0, 3])
    expect(rerollIndices([1, 2, 3, 1, 6], 3, 'fails')).toEqual([0, 1, 3])
  })
  it('reads the wound table', () => {
    expect([woundTarget(8, 4), woundTarget(5, 4), woundTarget(4, 4), woundTarget(4, 5), woundTarget(4, 8)]).toEqual([2, 3, 4, 5, 6])
  })
  it('works out the save with AP and invulnerable saves', () => {
    expect(saveTarget(3, -1)).toBe(4)
    expect(saveTarget(3, -2, 4)).toBe(4)
    expect(saveTarget(2, 0, 4)).toBe(2)
    expect(saveTarget(4, -3)).toBeUndefined()
    expect(saveTarget(4, -3, 5)).toBe(5)
  })
  it('carries results along the sequence', () => {
    expect(carried({ step: 'hit', dice: 4, target: 3, values: [1, 3, 4, 6] })).toBe(3)
    expect(unsaved({ step: 'save', dice: 3, target: 4, values: [2, 4, 1] })).toBe(2)
    expect(sortedDesc([2, 6, 4])).toEqual([6, 4, 2])
  })
  it('rolls D6s', () => {
    expect(rollD6(3, () => 0.99)).toEqual([6, 6, 6])
    expect(rollD6(2, () => 0)).toEqual([1, 1])
    expect(rollD6(-1)).toEqual([])
  })
})
