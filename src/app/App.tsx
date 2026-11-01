import { useEffect, useState } from 'react'
import { BacklogPage } from '../features/backlog/BacklogPage'
import { CatalogueBrowser } from '../features/catalogue/CatalogueBrowser'
import { BackupPage } from '../features/settings/BackupPage'
import { CataloguePage } from '../features/settings/CataloguePage'
import { PipelinePage } from '../features/settings/PipelinePage'
import { useStore } from './store'

type Page = 'backlog' | 'browse' | 'pipeline' | 'catalogue' | 'backup'
const THEMES = { grimdark: 'Grimdark', forum2005: 'Forum 2005' } as const
type Theme = keyof typeof THEMES

function readTheme(): Theme {
  try {
    const t = localStorage.getItem('theme')
    return t && t in THEMES ? (t as Theme) : 'grimdark'
  } catch {
    return 'grimdark'
  }
}

const SOON = ['Paints', 'Army lists', 'Games', 'Shopping']

export default function App() {
  const { ready, load } = useStore()
  const [page, setPage] = useState<Page>('backlog')
  const [theme, setTheme] = useState<Theme>(readTheme)

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* storage unavailable: theme just isn't remembered */
    }
  }, [theme])

  const nav = (id: Page, label: string) => (
    <button
      className={`w-full rounded px-3 py-1.5 text-left ${page === id ? 'bg-panel-2 text-accent' : 'hover:bg-panel-2'}`}
      aria-current={page === id ? 'page' : undefined}
      onClick={() => setPage(id)}
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
        {SOON.map((s) => (
          <span key={s} className="px-3 py-1.5 text-muted/60" title="Coming in a later sprint">{s} ⌛</span>
        ))}
        <div className="mt-4 mb-1 px-3 text-xs uppercase tracking-wider text-muted">Settings</div>
        {nav('pipeline', 'Pipeline')}
        {nav('catalogue', 'Catalogue data')}
        {nav('backup', 'Backup')}
        <label className="mt-auto grid gap-1 px-3 text-xs text-muted">
          Theme
          <select className="input" value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
            {Object.entries(THEMES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <a
          className="px-3 pt-2 text-xs text-muted hover:text-accent"
          href={`https://github.com/Giacomo-Antonioli/MiniTracker/releases/tag/v${__APP_VERSION__}`}
          target="_blank"
          rel="noreferrer"
        >
          v{__APP_VERSION__}
        </a>
      </nav>
      <main className="min-w-0 flex-1 overflow-auto p-4">
        {!ready ? (
          <p className="text-muted">Loading…</p>
        ) : page === 'backlog' ? (
          <BacklogPage />
        ) : page === 'browse' ? (
          <CatalogueBrowser onOpenSettings={() => setPage('catalogue')} />
        ) : page === 'pipeline' ? (
          <PipelinePage />
        ) : page === 'catalogue' ? (
          <CataloguePage />
        ) : (
          <BackupPage />
        )}
      </main>
    </div>
  )
}
