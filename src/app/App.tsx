import { useEffect, useState } from 'react'
import { BacklogPage } from '../features/backlog/BacklogPage'
import { CatalogueBrowser } from '../features/catalogue/CatalogueBrowser'
import { PaintsPage } from '../features/paints/PaintsPage'
import { SettingsPage, type SettingsSection } from '../features/settings/SettingsPage'
import { useStore } from './store'

type Page = 'backlog' | 'browse' | 'paints' | 'settings'

const SOON = ['Schemes', 'Army lists', 'Games', 'Shopping']

export default function App() {
  const { ready, load, theme } = useStore()
  const [page, setPage] = useState<Page>('backlog')
  const [section, setSection] = useState<SettingsSection | undefined>()

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const go = (p: Page, s?: SettingsSection) => {
    setPage(p)
    setSection(s)
  }

  const nav = (id: Page, label: string) => (
    <button
      className={`w-full rounded px-3 py-1.5 text-left ${page === id ? 'bg-panel-2 text-accent' : 'hover:bg-panel-2'}`}
      aria-current={page === id ? 'page' : undefined}
      onClick={() => go(id)}
    >
      {label}
    </button>
  )

  return (
    <div className="flex h-screen">
      <nav className="panel m-2 mr-0 flex w-52 shrink-0 flex-col gap-1 p-3" aria-label="Main">
        <div className="mb-4 font-display text-lg tracking-wide text-accent">MiniTracker</div>
        {nav('backlog', 'Backlog')}
        {nav('browse', 'Catalogue')}
        {nav('paints', 'Paints')}
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
        {!ready ? (
          <p className="text-muted">Loading…</p>
        ) : page === 'backlog' ? (
          <BacklogPage />
        ) : page === 'paints' ? (
          <PaintsPage />
        ) : page === 'browse' ? (
          <CatalogueBrowser onOpenSettings={() => go('settings', 'catalogue')} />
        ) : (
          <SettingsPage section={section} />
        )}
      </main>
    </div>
  )
}
