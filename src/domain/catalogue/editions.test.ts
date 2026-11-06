import { describe, expect, it } from 'vitest'
import { battleSizes, COMBAT_PATROL } from '../lists/rules'
import { editionOfRepo, gameOfRepo } from './editions'
import type { Catalogue } from './types'

const cat = (repo: string, sizes: { id: string; name: string; pointsLimit: number }[] = []) => ({ source: { repo }, muster: { battleSizes: sizes, keywordMinimums: [] } }) as unknown as Catalogue

describe('game systems (#99)', () => {
  it('knows the game of a repository; local files count as 40k', () => {
    expect([gameOfRepo('BSData/wh40k-11e'), gameOfRepo('BSData/age-of-sigmar-4th'), gameOfRepo('BSData/wh40k-killteam'), gameOfRepo('local files')]).toEqual(['40k', 'aos', 'kt', '40k'])
    expect((editionOfRepo('BSData/wh40k-killteam') as { files?: RegExp }).files?.test('2024 - Kasrkin.cat')).toBe(true)
    expect((editionOfRepo('BSData/wh40k-killteam') as { files?: RegExp }).files?.test('2021 - Kasrkin.cat')).toBe(false)
  })
  it('gives Combat Patrol only to 40k, and one open size to games without battle sizes', () => {
    expect(battleSizes(cat('BSData/wh40k-11e'))[0]).toBe(COMBAT_PATROL)
    expect(battleSizes(cat('BSData/age-of-sigmar-4th'))).toEqual([{ id: 'open', name: 'Open', pointsLimit: 2000 }])
    expect(battleSizes(cat('BSData/wh40k-killteam'))).toEqual([{ id: 'open', name: 'Kill team', pointsLimit: 0 }])
    const sized = [{ id: 's', name: 'Battlehost', pointsLimit: 2000 }]
    expect(battleSizes(cat('BSData/age-of-sigmar-4th', sized))).toBe(sized)
  })
})
