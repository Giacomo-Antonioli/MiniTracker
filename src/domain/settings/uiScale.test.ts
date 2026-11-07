import { describe, expect, it } from 'vitest'
import { autoScale, effectiveScale, readSetting, scaleLabel, snapScale, stepScale } from './uiScale'

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

  it('Auto follows the window width: 100% up to 1280 px, bigger windows grow, capped at 150%', () => {
    expect(autoScale(800)).toBe(1)
    expect(autoScale(1280)).toBe(1)
    expect(autoScale(1450)).toBe(1.1)
    expect(autoScale(1920)).toBe(1.5)
    expect(autoScale(3840)).toBe(1.5)
    expect(readSetting(null)).toBe('auto')
    expect(readSetting('auto')).toBe('auto')
    expect(readSetting('1.25')).toBe(1.25)
    expect(effectiveScale('auto', 1600)).toBe(1.25)
    expect(effectiveScale(0.9, 1600)).toBe(0.9)
  })
})
