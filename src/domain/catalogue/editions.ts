/**
 * Game systems and editions MiniTracker can load from BSData (#99). The daily CI check (bsdata-check.yml) verifies
 * the 40k ones still work. `files` keeps only one edition from a repository that holds several. `paths` names the exact
 * files of a non-BSData source; `format` says which converter reads it (BattleScribe data unless set).
 */
export type GameId = '40k' | 'aos' | 'kt' | 'mesbg'

export const GAMES: Record<GameId, string> = { '40k': 'Warhammer 40,000', aos: 'Age of Sigmar', kt: 'Kill Team', mesbg: 'Middle-earth Strategy Battle Game' }

export const EDITIONS = [
  { key: '11e', label: '11th edition', game: '40k', repo: 'BSData/wh40k-11e' },
  { key: '10e', label: '10th edition', game: '40k', repo: 'BSData/wh40k-10e' },
  { key: 'aos4', label: 'Age of Sigmar 4th edition', game: 'aos', repo: 'BSData/age-of-sigmar-4th' },
  { key: 'kt24', label: 'Kill Team (2024)', game: 'kt', repo: 'BSData/wh40k-killteam', files: /^2024 - / },
  // BSData's middle-earth repo stopped before the 2024 edition; the community MESBG list builder keeps current data.
  {
    key: 'mesbg24',
    label: 'Middle-earth (2024 edition)',
    game: 'mesbg',
    repo: 'mhollink/mesbg-list-builder-v2024',
    format: 'mesbg',
    paths: ['src/assets/data/mesbg_data.json', 'src/assets/data/profile_data.json', 'src/assets/data/army_list_data.json'],
  },
] as const satisfies readonly { key: string; label: string; game: GameId; repo: string; files?: RegExp; format?: 'mesbg'; paths?: readonly string[] }[]

export type Edition = (typeof EDITIONS)[number]
export type EditionKey = Edition['key']

export const editionOfRepo = (repo: string): Edition | undefined => EDITIONS.find((e) => e.repo === repo)

/** The game of a catalogue (by its BSData repo); 40k for local files and older installs. */
export const gameOfRepo = (repo: string): GameId => editionOfRepo(repo)?.game ?? '40k'

/** Points a new list starts with when the data has no battle sizes. Kill Team has no points. */
export const DEFAULT_POINTS: Record<GameId, number> = { '40k': 2000, aos: 2000, kt: 0, mesbg: 700 }
