import { describe, expect, it } from 'vitest'
import { DEPLOYMENTS, DISPOSITIONS, draw, isDisposition, PRIMARIES, primaries } from './missions'

describe('mission cards', () => {
  it('gives each player their Primary Mission from the two dispositions', () => {
    expect(primaries('Take and Hold', 'Disruption')).toEqual({ me: 'Determined Acquisition', them: 'Death Trap' })
    expect(primaries('Purge the Foe', 'Purge the Foe')).toEqual({ me: 'Meatgrinder', them: 'Meatgrinder' })
  })
  it('has 25 distinct primaries, and draws a card', () => {
    expect(new Set(PRIMARIES).size).toBe(25)
    expect(DISPOSITIONS).toHaveLength(5)
    expect(draw(DEPLOYMENTS, () => 0)).toBe('Tipping Point')
    expect(draw(DEPLOYMENTS, () => 0.999)).toBe('Crucible of Battle')
    expect([isDisposition('Disruption'), isDisposition('x'), isDisposition()]).toEqual([true, false, false])
  })
})
