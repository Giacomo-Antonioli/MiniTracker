import { describe, expect, it } from 'vitest'
import { photoFileName, slug, unitTag } from './naming'

describe('slug', () => {
  it('lower-cases, strips accents and unsafe characters', () => {
    expect(slug("Emperor's Children")).toBe('emperors-children')
    expect(slug('  Ça va / Été: «Test»  ')).toBe('ca-va-ete-test')
    expect(slug('')).toBe('')
  })
})

describe('unitTag', () => {
  it('is mt- plus the first 8 hex-ish characters of the id', () => {
    expect(unitTag('3f9a2c1b-77aa-4e1b-9c3d-0123456789ab')).toBe('mt-3f9a2c1b')
    expect(unitTag('ABCD')).toBe('mt-abcd')
  })
})

describe('photoFileName', () => {
  const base = { faction: 'Ultramarines', unitName: 'Intercessor Squad', unitId: '3f9a2c1b-77aa', stage: 'painted', date: '2026-11-02T18:30:00.000Z', ext: 'jpg' }

  it('follows <faction>_<unit>_<tag>_<stage>_<date>_<nn>.<ext>', () => {
    expect(photoFileName({ ...base, seq: 1 })).toBe('ultramarines_intercessor-squad_mt-3f9a2c1b_painted_20261102_01.jpg')
    expect(photoFileName({ ...base, seq: 12, ext: 'HEIC' })).toBe('ultramarines_intercessor-squad_mt-3f9a2c1b_painted_20261102_12.heic')
  })

  it('fills gaps when faction or stage are missing', () => {
    expect(photoFileName({ ...base, faction: undefined, stage: undefined, seq: 1 })).toBe('no-faction_intercessor-squad_mt-3f9a2c1b_photo_20261102_01.jpg')
  })

  it('names scheme photos differently', () => {
    expect(photoFileName({ scheme: 'Ultramarines Studio', schemeId: 'abcdef1234', date: '2026-11-02', seq: 3, ext: 'webp' })).toBe(
      'scheme_ultramarines-studio_sc-abcdef12_20261102_03.webp',
    )
  })
})
