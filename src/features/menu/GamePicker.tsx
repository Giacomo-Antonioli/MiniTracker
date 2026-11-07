import { useStore } from '../../app/store'
import { useT } from '../../i18n'
import { GAMES } from '../../domain/catalogue/editions'
import { installedGames, type GameFilter } from '../../domain/catalogue/unitGame'

/** Menu picker (#99): one game or all of them. Shown once two or more games are installed. */
export function GamePicker({ className = '' }: { className?: string }) {
  const t = useT()
  const catalogues = useStore((s) => s.catalogues)
  const game = useStore((s) => s.gameFilter)
  const setGame = useStore((s) => s.setGameFilter)
  const games = installedGames(catalogues)
  if (games.length < 2) return null
  return (
    <select className={`input py-1 text-sm ${className}`} aria-label={t('menu.game')} value={games.includes(game as never) ? game : 'all'} onChange={(e) => void setGame(e.target.value as GameFilter)}>
      <option value="all">{t('menu.allGames')}</option>
      {games.map((g) => <option key={g} value={g}>{GAMES[g]}</option>)}
    </select>
  )
}
