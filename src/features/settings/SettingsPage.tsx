import { useEffect, useState } from 'react'
import { readStartPage, saveStartPage, THEMES, useStore, type RuleDisplay, type StartPage, type Theme } from '../../app/store'
import { DEFAULT_PIPELINES } from '../../domain/pipelines'
import { BackupPage } from './BackupPage'
import { CataloguePage } from './CataloguePage'
import { PipelineEditor } from './PipelineEditor'

export type SettingsSection = 'appearance' | 'pipelines' | 'catalogue' | 'storage' | 'backup'

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'pipelines', label: 'Pipelines' },
  { id: 'catalogue', label: 'Catalogue data' },
  { id: 'storage', label: 'Storage' },
  { id: 'backup', label: 'Backup' },
]

export function SettingsPage({ section }: { section?: SettingsSection }) {
  const [start, setStart] = useState<StartPage>(readStartPage)
  const { theme, setTheme, ruleDisplay, setRuleDisplay, pipelines, savePipelineFor, units, paintStock, schemes } = useStore()

  useEffect(() => {
    if (section) document.getElementById(`settings-${section}`)?.scrollIntoView?.({ block: 'start' })
  }, [section])

  const modelsInStage = (id: string) =>
    units.reduce((n, u) => n + u.groups.filter((g) => g.status === id).reduce((a, g) => a + g.count, 0), 0)

  return (
    <div className="grid max-w-3xl gap-6">
      <header className="grid gap-2">
        <h1 className="font-display text-2xl text-accent">Settings</h1>
        <nav className="flex flex-wrap gap-2" aria-label="Settings sections">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#settings-${s.id}`} className="btn text-sm" onClick={(e) => {
              e.preventDefault()
              document.getElementById(`settings-${s.id}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
            }}>
              {s.label}
            </a>
          ))}
        </nav>
      </header>

      <section id="settings-appearance" className="grid scroll-mt-4 gap-3">
        <h2 className="font-display text-xl text-accent">Appearance</h2>
        <div className="panel grid gap-3 p-4">
          <label className="flex items-center gap-3">
            Rule explanations
            <select className="input" value={ruleDisplay} onChange={(e) => setRuleDisplay(e.target.value as RuleDisplay)}>
              <option value="collapsed">Collapsed (open with the ▸ arrow)</option>
              <option value="expanded">Always expanded</option>
              <option value="hover">Show on hover</option>
            </select>
          </label>
          <label className="flex items-center gap-3">
            Start page
            <select className="input" value={start} onChange={(e) => { setStart(e.target.value as StartPage); saveStartPage(e.target.value as StartPage) }}>
              <option value="home">Home</option>
              <option value="backlog">Backlog</option>
            </select>
          </label>
          <label className="flex items-center gap-3">
            Theme
            <select className="input" value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
              {Object.entries(THEMES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section id="settings-pipelines" className="grid scroll-mt-4 gap-3">
        <h2 className="font-display text-xl text-accent">Pipelines</h2>
        <PipelineEditor
          title="Painting pipeline"
          description="Stages your models go through. One list for all armies. Stages with models in them can't be deleted."
          pipeline={pipelines.painting}
          defaults={DEFAULT_PIPELINES.painting}
          usedBy={modelsInStage}
          usedLabel="models"
          onSave={(p) => savePipelineFor('painting', p)}
        />
        <PipelineEditor
          title="Paint pipeline"
          description="Life of a paint pot, from wishlist to empty. Used by the paint inventory."
          pipeline={pipelines.paint}
          defaults={DEFAULT_PIPELINES.paint}
          usedBy={(id) => [...paintStock.values()].filter((s) => s.stage === id).length}
          usedLabel="paints"
          onSave={(p) => savePipelineFor('paint', p)}
        />
        <PipelineEditor
          title="Scheme pipeline"
          description="Status of your paint schemes and recipes."
          pipeline={pipelines.scheme}
          defaults={DEFAULT_PIPELINES.scheme}
          usedBy={(id) => schemes.filter((s) => s.stage === id).length}
          usedLabel="schemes"
          onSave={(p) => savePipelineFor('scheme', p)}
        />
      </section>

      <section id="settings-catalogue" className="scroll-mt-4">
        <CataloguePage />
      </section>

      <section id="settings-storage" className="grid scroll-mt-4 gap-3">
        <h2 className="font-display text-xl text-accent">Storage</h2>
        <StorageInfo />
      </section>

      <section id="settings-backup" className="scroll-mt-4">
        <BackupPage />
      </section>
    </div>
  )
}

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`

function StorageInfo() {
  const photoUsage = useStore((s) => s.photoUsage)
  const dropOriginals = useStore((s) => s.dropOriginals)
  const [freed, setFreed] = useState<number | null>(null)
  const [usage, setUsage] = useState<{ photos: number; displayBytes: number; originalBytes: number } | null>(null)
  const [quota, setQuota] = useState<{ usage?: number; quota?: number } | null>(null)
  useEffect(() => {
    void photoUsage().then(setUsage)
    void navigator.storage?.estimate?.().then(setQuota)
  }, [photoUsage])
  return (
    <div className="panel grid gap-1 p-4 text-sm" aria-label="Storage usage">
      <p>
        Photos: <b>{usage?.photos ?? '…'}</b>
        {usage && <> · shown copies {mb(usage.displayBytes)} · originals {mb(usage.originalBytes)}</>}
      </p>
      {quota?.quota !== undefined && (
        <p className="text-muted">
          This browser uses {mb(quota.usage ?? 0)} of about {mb(quota.quota)} available to MiniTracker.
        </p>
      )}
      <p className="text-muted">Everything stays on this device. The app shows the compressed copies; originals are only needed to download them at full quality.</p>
      {usage && usage.originalBytes > 0 && (
        <button
          className="btn btn-danger mt-2 w-fit"
          onClick={async () => {
            if (!confirm(`Delete all photo originals and keep only the compressed copies? This frees about ${mb(usage.originalBytes)}. Make a full backup first if you want to keep them.`)) return
            setFreed(await dropOriginals())
            setUsage(await photoUsage())
          }}
        >
          Remove originals (free {mb(usage.originalBytes)})
        </button>
      )}
      {freed !== null && <p className="text-ok" role="status">Freed {mb(freed)}.</p>}
    </div>
  )
}
