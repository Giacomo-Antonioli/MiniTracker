import { describe, expect, it } from 'vitest'
import { scaleLabel, snapScale, stepScale } from './uiScale'

describe('text and interface size', () => {
  it('snaps stored values to the allowed sizes and falls back to 100%', () => {
    expect(snapScale('1.25')).toBe(1.25)
    expect(snapScale(1.3)).toBe(1.25)
    expect(snapScale(3)).toBe(1.5)
    expect(snapScale('nope')).toBe(1)
    expect(snapScale(undefined)).toBe(1)
  })

  it('steps up and down within the range', () => {
    expect(stepScale(1, 1)).toBe(1.1)
    expect(stepScale(1, -1)).toBe(0.9)
    expect(stepScale(1.5, 1)).toBe(1.5)
    expect(stepScale(0.8, -1)).toBe(0.8)
    expect(scaleLabel(1.25)).toBe('125%')
  })
})
