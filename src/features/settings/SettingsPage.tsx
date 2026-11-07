import { useEffect, useState } from 'react'
import { KindsEditor } from '../storage/Storage'
import { readStartPage, saveStartPage, THEMES, useStore, type RuleDisplay, type StartPage, type Theme } from '../../app/store'
import { DEFAULT_PIPELINES } from '../../domain/pipelines'
import { BackupPage } from './BackupPage'
import { CataloguePage } from './CataloguePage'
import { PipelineEditor } from './PipelineEditor'
import { WorkshopSettings } from './WorkshopSettings'
import { SyncSettings } from './SyncSettings'
import { canAutoUpdate, isAndroidApp, isDesktopApp } from '../../app/platform'
import { AUTO, UI_SCALES, effectiveScale, scaleLabel } from '../../domain/settings/uiScale'
import { useUpdates } from '../menu/updates'
import { useWelcome } from '../welcome/welcome'
import { useT } from '../../i18n'
import { LanguagePicker } from '../../i18n/LanguagePicker'

export type SettingsSection = 'catalogue' | 'appearance' | 'pipelines' | 'workshop' | 'sync' | 'storage' | 'backup'

const SECTIONS: SettingsSection[] = ['catalogue', 'appearance', 'pipelines', 'workshop', 'sync', 'storage', 'backup']

/** Tab shown when Settings opens again without a section. */
let lastTab: SettingsSection = 'catalogue'

export function SettingsPage({ section }: { section?: SettingsSection }) {
  const t = useT()
  const [start, setStart] = useState<StartPage>(readStartPage)
  const { currency, setCurrency, theme, setTheme, uiScale, setUiScale, ruleDisplay, setRuleDisplay, pipelines, savePipelineFor, units, paintStock, schemes, storage, supplies } = useStore()
  const reopenWelcome = useWelcome((w) => w.reopen)
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
          <h1 className="font-display text-2xl text-accent">{t('settings.title')}</h1>
          <a className="text-sm text-accent underline" href="https://github.com/Giacomo-Antonioli/MiniTracker/blob/main/docs/USER_GUIDE.md" target="_blank" rel="noreferrer">{t('settings.userGuide')}</a>
        </div>
        <div className="flex flex-wrap gap-1 border-b border-line" role="tablist" aria-label={t('settings.sections')}>
          {SECTIONS.map((id) => (
            <button key={id} role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`settings-${id}`}
              className={`-mb-px rounded-t border border-b-0 px-3 py-1.5 text-sm ${tab === id ? 'border-line bg-panel text-accent' : 'border-transparent text-muted hover:text-fg'}`}
              onClick={() => setTab(id)}>
              {t(`settings.tabs.${id}`)}
            </button>
          ))}
        </div>
      </header>

      {tab === 'appearance' && <section role="tabpanel" aria-labelledby="tab-appearance" id="settings-appearance" className="grid gap-3">
        <h2 className="font-display text-xl text-accent">{t('settings.tabs.appearance')}</h2>
        <div className="panel grid gap-3 p-4">
          <LanguagePicker />
          <label className="flex items-center gap-3">
            {t('settings.ruleDisplay')}
            <select className="input" value={ruleDisplay} onChange={(e) => setRuleDisplay(e.target.value as RuleDisplay)}>
              <option value="collapsed">{t('settings.ruleCollapsed')}</option>
              <option value="expanded">{t('settings.ruleExpanded')}</option>
              <option value="hover">{t('settings.ruleHover')}</option>
            </select>
          </label>
          <label className="flex items-center gap-3">
            {t('settings.startPage')}
            <select className="input" value={start} onChange={(e) => { setStart(e.target.value as StartPage); saveStartPage(e.target.value as StartPage) }}>
              <option value="home">{t('menu.home')}</option>
              <option value="backlog">{t('menu.backlog')}</option>
            </select>
          </label>
          <label className="flex items-center gap-3">
            {t('settings.currency')}
            <input className="input w-20" aria-label={t('settings.currency')} defaultValue={currency} key={currency} maxLength={4} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== currency && void setCurrency(e.target.value.trim())} />
          </label>
          {canAutoUpdate() && <AppVersion />}
          <div className="flex flex-wrap items-center gap-3">
            {t('settings.welcome')}
            <button type="button" className="btn px-2 py-0.5 text-sm" onClick={reopenWelcome}>{t('settings.showAgain')}</button>
          </div>
          <label className="flex items-center gap-3">
            {t('settings.theme')}
            <select className="input" value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
              {Object.entries(THEMES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-3">
            {t('settings.size')}
            <input className="w-40 accent-[var(--accent)]" type="range" min={0} max={UI_SCALES.length - 1} step={1} aria-label={t('settings.size')} value={UI_SCALES.indexOf(shownScale as (typeof UI_SCALES)[number])} onChange={(e) => setUiScale(UI_SCALES[Number(e.target.value)])} />
            <span className="w-24 tabular-nums">{scaleLabel(shownScale)}{uiScale === AUTO && t('settings.autoSuffix')}</span>
            {uiScale !== AUTO && <button type="button" className="btn px-2 py-0.5 text-sm" onClick={() => setUiScale(AUTO)}>{t('settings.auto')}</button>}
          </label>
          <p className="text-sm text-muted">{t('settings.sizeHelp')}{isDesktopApp() && !isAndroidApp() && t('settings.sizeShortcut')}</p>
        </div>
      </section>}

      {tab === 'pipelines' && <section role="tabpanel" aria-labelledby="tab-pipelines" id="settings-pipelines" className="grid gap-3">
        <h2 className="font-display text-xl text-accent">{t('settings.tabs.pipelines')}</h2>
        <PipelineEditor
          title={t('settings.pipelines.painting')}
          description={t('settings.pipelines.paintingHelp')}
          pipeline={pipelines.painting}
          defaults={DEFAULT_PIPELINES.painting}
          usedBy={modelsInStage}
          usedLabel={t('settings.pipelines.models')}
          onSave={(p) => savePipelineFor('painting', p)}
        />
        <PipelineEditor
          title={t('settings.pipelines.paint')}
          description={t('settings.pipelines.paintHelp')}
          pipeline={pipelines.paint}
          defaults={DEFAULT_PIPELINES.paint}
          usedBy={(id) => [...paintStock.values()].filter((s) => s.stage === id).length}
          usedLabel={t('settings.pipelines.paints')}
          onSave={(p) => savePipelineFor('paint', p)}
        />
        <PipelineEditor
          title={t('settings.pipelines.scheme')}
          description={t('settings.pipelines.schemeHelp')}
          pipeline={pipelines.scheme}
          defaults={DEFAULT_PIPELINES.scheme}
          usedBy={(id) => schemes.filter((s) => s.stage === id).length}
          usedLabel={t('settings.pipelines.schemes')}
          onSave={(p) => savePipelineFor('scheme', p)}
        />
        <PipelineEditor
          title={t('settings.pipelines.storage')}
          description={t('settings.pipelines.storageHelp')}
          pipeline={pipelines.storage}
          defaults={DEFAULT_PIPELINES.storage}
          usedBy={(id) => Object.values(storage.flow).filter((x) => x === id).length}
          usedLabel={t('settings.pipelines.units')}
          onSave={(p) => savePipelineFor('storage', p)}
        />
        <PipelineEditor
          title={t('settings.pipelines.level')}
          description={t('settings.pipelines.levelHelp')}
          pipeline={pipelines.level}
          defaults={DEFAULT_PIPELINES.level}
          usedBy={(id) => supplies.filter((s) => (s.level ?? pipelines.level.stages[0]?.id) === id).length}
          usedLabel={t('settings.pipelines.supplies')}
          onSave={(p) => savePipelineFor('level', p)}
        />
        <KindsEditor />
      </section>}

      {tab === 'workshop' && <section role="tabpanel" aria-labelledby="tab-workshop" id="settings-workshop" className="grid gap-3">
        <h2 className="font-display text-xl text-accent">{t('settings.tabs.workshop')}</h2>
        <WorkshopSettings />
      </section>}

      {tab === 'sync' && <section role="tabpanel" aria-labelledby="tab-sync" id="settings-sync" className="grid gap-3">
        <h2 className="font-display text-xl text-accent">{t('settings.tabs.sync')}</h2>
        <SyncSettings />
      </section>}

      {tab === 'catalogue' && <section role="tabpanel" aria-labelledby="tab-catalogue" id="settings-catalogue">
        <CataloguePage />
      </section>}

      {tab === 'storage' && <section role="tabpanel" aria-labelledby="tab-storage" id="settings-storage" className="grid gap-3">
        <h2 className="font-display text-xl text-accent">{t('settings.tabs.storage')}</h2>
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
  const t = useT()
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
    <div className="panel grid gap-1 p-4 text-sm" aria-label={t('settings.storage.usage')}>
      <p>
        {t('settings.storage.photos')} <b>{usage?.photos ?? '…'}</b>
        {usage && t('settings.storage.copies', { shown: mb(usage.displayBytes), originals: mb(usage.originalBytes) })}
      </p>
      {quota?.quota !== undefined && (
        <p className="text-muted">
          {t('settings.storage.quota', { used: mb(quota.usage ?? 0), total: mb(quota.quota) })}
        </p>
      )}
      <p className="text-muted">{t('settings.storage.local')}</p>
      {usage && usage.originalBytes > 0 && (
        <button
          className="btn btn-danger mt-2 w-fit"
          onClick={async () => {
            if (!confirm(t('settings.storage.confirm', { size: mb(usage.originalBytes) }))) return
            setFreed(await dropOriginals())
            setUsage(await photoUsage())
          }}
        >
          {t('settings.storage.remove', { size: mb(usage.originalBytes) })}
        </button>
      )}
      {freed !== null && <p className="text-ok" role="status">{t('settings.storage.freed', { size: mb(freed) })}</p>}
    </div>
  )
}

/** Desktop app: the installed version and a manual update check (#168). */
function AppVersion() {
  const t = useT()
  const { status, update, error, check } = useUpdates()
  const text = { idle: '', checking: t('settings.version.checking'), found: t('settings.version.found', { version: update?.version }), none: t('settings.version.none'), failed: t('settings.version.failed', { error }) }[status]
  return (
    <div className="flex flex-wrap items-center gap-3" aria-label={t('settings.version.label')}>
      {t('settings.version.version', { version: __APP_VERSION__ })}
      <button type="button" className="btn px-2 py-0.5 text-sm" disabled={status === 'checking'} onClick={() => void check()}>{t('settings.version.check')}</button>
      {text && <span className="text-sm text-muted" role="status">{text}</span>}
    </div>
  )
}

