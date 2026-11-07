import { useEffect, useState } from 'react'
import { KindsEditor } from '../storage/Storage'
import { readStartPage, saveStartPage, THEMES, useStore, type RuleDisplay, type StartPage, type Theme } from '../../app/store'
import { DEFAULT_PIPELINES } from '../../domain/pipelines'
import { BackupPage } from './BackupPage'
import { CataloguePage } from './CataloguePage'
import { PipelineEditor } from './PipelineEditor'
import { WorkshopSettings } from './WorkshopSettings'
import { SyncSettings } from './SyncSettings'
import { isDesktopApp } from '../../app/platform'
import { AUTO, UI_SCALES, effectiveScale, scaleLabel } from '../../domain/settings/uiScale'

export type SettingsSection = 'catalogue' | 'appearance' | 'pipelines' | 'workshop' | 'sync' | 'storage' | 'backup'

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: 'catalogue', label: 'Catalogue data' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'pipelines', label: 'Pipelines' },
  { id: 'workshop', label: 'Workshop' },
  { id: 'sync', label: 'Sync' },
  { id: 'storage', label: 'Storage' },
  { id: 'backup', label: 'Backup' },
]

/** Tab shown when Settings opens again without a section. */
let lastTab: SettingsSection = 'catalogue'

export function SettingsPage({ section }: { section?: SettingsSection }) {
  const [start, setStart] = useState<StartPage>(readStartPage)
  const { currency, setCurrency, theme, setTheme, uiScale, setUiScale, ruleDisplay, setRuleDisplay, pipelines, savePipelineFor, units, paintStock, schemes, storage, supplies } = useStore()
  const shownScale = effectiveScale(uiScale, typeof window === 'undefined' ? 1280 : window.innerWidth)
  const [tab, setTabState] = useState<SettingsSection>(section ?? lastTab)
  const setTab = (t: SettingsSection) => {
    lastTab = t
    setTabState(t)
  }
  useEffect(() => {
    if (section) setTab(section)
  }, [section])

  const modelsInStage = (id: string) =>
    units.reduce((n, u) => n + u.groups.filter((g) => g.status === id).reduce((a, g) => a + g.count, 0), 0)

  return (
    <div className="grid max-w-3xl gap-6">
      <header className="grid gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="font-display text-2xl text-accent">Settings</h1>
          <a className="text-sm text-accent underline" href="https://github.com/Giacomo-Antonioli/MiniTracker/blob/main/docs/USER_GUIDE.md" target="_blank" rel="noreferrer">📖 User guide</a>
        </div>
        <div className="flex flex-wrap gap-1 border-b border-line" role="tablist" aria-label="Settings sections">
          {SECTIONS.map((s) => (
            <button key={s.id} role="tab" id={`tab-${s.id}`} aria-selected={tab === s.id} aria-controls={`settings-${s.id}`}
              className={`-mb-px rounded-t border border-b-0 px-3 py-1.5 text-sm ${tab === s.id ? 'border-line bg-panel text-accent' : 'border-transparent text-muted hover:text-fg'}`}
              onClick={() => setTab(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      </header>

      {tab === 'appearance' && <section role="tabpanel" aria-labelledby="tab-appearance" id="settings-appearance" className="grid gap-3">
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
            Currency
            <input className="input w-20" aria-label="Currency" defaultValue={currency} key={currency} maxLength={4} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== currency && void setCurrency(e.target.value.trim())} />
          </label>
          <label className="flex items-center gap-3">
            Theme
            <select className="input" value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
              {Object.entries(THEMES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-3">
            Text and interface size
            <input className="w-40 accent-[var(--accent)]" type="range" min={0} max={UI_SCALES.length - 1} step={1} aria-label="Text and interface size" value={UI_SCALES.indexOf(shownScale as (typeof UI_SCALES)[number])} onChange={(e) => setUiScale(UI_SCALES[Number(e.target.value)])} />
            <span className="w-24 tabular-nums">{scaleLabel(shownScale)}{uiScale === AUTO && ' (auto)'}</span>
            {uiScale !== AUTO && <button type="button" className="btn px-2 py-0.5 text-sm" onClick={() => setUiScale(AUTO)}>Auto</button>}
          </label>
          <p className="text-sm text-muted">Auto follows the window: a bigger or maximised window gets bigger text. Move the slider to fix a size.{isDesktopApp() && ' Shortcut: Ctrl + / Ctrl − to change, Ctrl 0 for Auto.'}</p>
        </div>
      </section>}

      {tab === 'pipelines' && <section role="tabpanel" aria-labelledby="tab-pipelines" id="settings-pipelines" className="grid gap-3">
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
        <PipelineEditor
          title="Storage pipeline"
          description="Where a unit is in its storage life. Checking out to a desk sets the stage with id 'desk', checking out anywhere else sets 'packed', and putting back sets 'stored'."
          pipeline={pipelines.storage}
          defaults={DEFAULT_PIPELINES.storage}
          usedBy={(id) => Object.values(storage.flow).filter((x) => x === id).length}
          usedLabel="units"
          onSave={(p) => savePipelineFor('storage', p)}
        />
        <PipelineEditor
          title="Liquid level"
          description="How full a liquid supply is (primer, glue, varnish…). The stage with id 'low' and the ones after it count as running low and go on the shopping list."
          pipeline={pipelines.level}
          defaults={DEFAULT_PIPELINES.level}
          usedBy={(id) => supplies.filter((s) => (s.level ?? pipelines.level.stages[0]?.id) === id).length}
          usedLabel="supplies"
          onSave={(p) => savePipelineFor('level', p)}
        />
        <KindsEditor />
      </section>}

      {tab === 'workshop' && <section role="tabpanel" aria-labelledby="tab-workshop" id="settings-workshop" className="grid gap-3">
        <h2 className="font-display text-xl text-accent">Workshop</h2>
        <WorkshopSettings />
      </section>}

      {tab === 'sync' && <section role="tabpanel" aria-labelledby="tab-sync" id="settings-sync" className="grid gap-3">
        <h2 className="font-display text-xl text-accent">Sync</h2>
        <SyncSettings />
      </section>}

      {tab === 'catalogue' && <section role="tabpanel" aria-labelledby="tab-catalogue" id="settings-catalogue">
        <CataloguePage />
      </section>}

      {tab === 'storage' && <section role="tabpanel" aria-labelledby="tab-storage" id="settings-storage" className="grid gap-3">
        <h2 className="font-display text-xl text-accent">Storage</h2>
        <StorageInfo />
      </section>}

      {tab === 'backup' && <section role="tabpanel" aria-labelledby="tab-backup" id="settings-backup">
        <BackupPage />
      </section>}
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
