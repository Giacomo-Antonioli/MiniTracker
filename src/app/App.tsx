import { SHARE_HASH, shareToken } from '../domain/schemes/share'
import { SharedSchemeBanner } from '../features/schemes/SharedSchemeBanner'
import { useEffect, useState } from 'react'
import { ArmiesPage } from '../features/armies/ArmiesPage'
import { BuilderPage } from '../features/armies/BuilderPage'
import { BacklogPage } from '../features/backlog/BacklogPage'
import { UnitPage } from '../features/backlog/UnitPage'
import { CatalogueBrowser } from '../features/catalogue/CatalogueBrowser'
import { PaintsPage } from '../features/paints/PaintsPage'
import { RulesPage } from '../features/rules/RulesPage'
import { SchemesPage } from '../features/schemes/SchemesPage'
import { StatsPage } from '../features/stats/StatsPage'
import { SuppliesPage } from '../features/supplies/SuppliesPage'
import { GoalsPage } from '../features/goals/GoalsPage'
import { GuidesPage } from '../features/guides/GuidesPage'
import { isLow } from '../domain/supplies/supplies'
import { GamesPage } from '../features/games/GamesPage'
import { ShoppingPage } from '../features/shopping/ShoppingPage'
import { readRecipeHash, type RecipePayload } from '../features/schemes/recipeImport'
import { SettingsPage, type SettingsSection } from '../features/settings/SettingsPage'
import { readStartPage, useStore } from './store'
import { HomePage } from '../features/home/HomePage'

type Page = 'home' | 'backlog' | 'unit' | 'armies' | 'army' | 'browse' | 'rules' | 'paints' | 'schemes' | 'shopping' | 'supplies' | 'stats' | 'goals' | 'guides' | 'games' | 'settings'

const SOON: string[] = []

export default function App() {
  const { ready, load, theme } = useStore()
  const lowSupplies = useStore((s) => s.supplies.filter(isLow).length)
  const liveGame = useStore((s) => s.games.some((g) => g.status === 'live'))
  // A recipe sent by the bookmarklet arrives in the URL (#recipe=…): start on Schemes with it.
  const [recipe, setRecipe] = useState<RecipePayload | null>(() => readRecipeHash(location.hash))
  const [page, setPage] = useState<Page>(() => (readRecipeHash(location.hash) ? 'schemes' : readStartPage()))
  // A scheme shared by link arrives as #scheme=…: offer to import it.
  const [shared, setShared] = useState(() => shareToken(location.hash))
  const [section, setSection] = useState<SettingsSection | undefined>()
  const [unitId, setUnitId] = useState<string | null>(null)
  const [datasheetId, setDatasheetId] = useState<string | undefined>()
  const openUnit = (id: string) => {
    setUnitId(id)
    setPage('unit')
  }
  const [listId, setListId] = useState<string | null>(null)
  const openList = (id: string) => {
    setListId(id)
    setPage('army')
  }
  const [schemeId, setSchemeId] = useState<string | undefined>()
  const openScheme = (id: string) => {
    setSchemeId(id)
    setPage('schemes')
  }
  const openDatasheet = (id: string) => {
    setDatasheetId(id)
    setPage('browse')
  }

  useEffect(() => {
    // Remove the recipe from the address bar so a reload doesn't import it again.
    if (location.hash.startsWith('#recipe=') || location.hash.startsWith(SHARE_HASH)) history.replaceState(null, '', location.pathname + location.search)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const go = (p: Page, s?: SettingsSection) => {
    setPage(p)
    setSection(s)
    setDatasheetId(undefined)
    setSchemeId(undefined)
  }

  const nav = (id: Page, label: string) => (
    <button
      className={`w-full rounded px-3 py-1.5 text-left ${page === id || (id === 'armies' && page === 'army') ? 'bg-panel-2 text-accent' : 'hover:bg-panel-2'}`}
      aria-current={page === id || (id === 'backlog' && page === 'unit') || (id === 'armies' && page === 'army') ? 'page' : undefined}
      onClick={() => go(id)}
    >
      {label}
    </button>
  )

  return (
    <div className="flex h-screen">
      <nav className="panel m-2 mr-0 flex w-52 shrink-0 flex-col gap-1 p-3" aria-label="Main">
        <div className="mb-4 font-display text-lg tracking-wide text-accent">MiniTracker</div>
        {nav('home', 'Home')}
        {nav('backlog', 'Backlog')}
        {nav('armies', 'Armies')}
        {nav('browse', 'Catalogue')}
        {nav('rules', 'Rules')}
        {nav('paints', 'Paints')}
        {nav('supplies', lowSupplies ? `Supplies ⚠${lowSupplies}` : 'Supplies')}
        {nav('schemes', 'Schemes')}
        {nav('guides', 'Guides')}
        {nav('shopping', 'Shopping')}
        {nav('stats', 'Stats')}
        {nav('goals', 'Goals')}
        {nav('games', liveGame ? 'Games ●' : 'Games')}
        {SOON.map((s) => (
          <span key={s} className="px-3 py-1.5 text-muted/60" title="Coming in a later sprint">{s} ⌛</span>
        ))}
        <div className="mt-auto grid gap-1">
          {nav('settings', '⚙ Settings')}
          <a
            className="px-3 pt-2 text-xs text-muted hover:text-accent"
            href={`https://github.com/Giacomo-Antonioli/MiniTracker/releases/tag/v${__APP_VERSION__}`}
            target="_blank"
            rel="noreferrer"
          >
            v{__APP_VERSION__}
          </a>
        </div>
      </nav>
      <main className="min-w-0 flex-1 overflow-auto p-4">
        {ready && shared && <SharedSchemeBanner token={shared} onDone={(id) => { setShared(null); if (id) openScheme(id) }} />}
        {!ready ? (
          <p className="text-muted">Loading…</p>
        ) : page === 'home' ? (
          <HomePage onOpenUnit={openUnit} onGo={(p) => go(p)} onAddUnit={() => go('backlog')} />
        ) : page === 'backlog' ? (
          <BacklogPage onOpenUnit={openUnit} onOpenDatasheet={openDatasheet} onOpenScheme={openScheme} />
        ) : page === 'unit' && unitId ? (
          <UnitPage unitId={unitId} onBack={() => setPage('backlog')} onOpenDatasheet={openDatasheet} onOpenScheme={openScheme} />
        ) : page === 'armies' ? (
          <ArmiesPage onOpenList={openList} onOpenSettings={() => go('settings', 'catalogue')} />
        ) : page === 'army' && listId ? (
          <BuilderPage key={listId} listId={listId} onBack={() => setPage('armies')} onOpenSettings={() => go('settings', 'catalogue')} />
        ) : page === 'schemes' ? (
          <SchemesPage key={schemeId ?? 'all'} openId={schemeId} payload={recipe ?? undefined} onPayloadUsed={() => setRecipe(null)} onOpenUnit={openUnit} />
        ) : page === 'rules' ? (
          <RulesPage onOpenSettings={() => go('settings', 'catalogue')} onOpenDatasheet={openDatasheet} />
        ) : page === 'paints' ? (
          <PaintsPage />
        ) : page === 'shopping' ? (
          <ShoppingPage />
        ) : page === 'supplies' ? (
          <SuppliesPage />
        ) : page === 'games' ? (
          <GamesPage />
        ) : page === 'guides' ? (
          <GuidesPage />
        ) : page === 'goals' ? (
          <GoalsPage />
        ) : page === 'stats' ? (
          <StatsPage />
        ) : page === 'browse' ? (
          <CatalogueBrowser key={datasheetId ?? 'all'} openId={datasheetId} onOpenSettings={() => go('settings', 'catalogue')} />
        ) : (
          <SettingsPage section={section} />
        )}
      </main>
    </div>
  )
}
