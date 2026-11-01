import { useEffect } from 'react'
import { THEMES, useStore, type Theme } from '../../app/store'
import { DEFAULT_PIPELINES } from '../../domain/pipelines'
import { BackupPage } from './BackupPage'
import { CataloguePage } from './CataloguePage'
import { PipelineEditor } from './PipelineEditor'

export type SettingsSection = 'appearance' | 'pipelines' | 'catalogue' | 'backup'

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'pipelines', label: 'Pipelines' },
  { id: 'catalogue', label: 'Catalogue data' },
  { id: 'backup', label: 'Backup' },
]

export function SettingsPage({ section }: { section?: SettingsSection }) {
  const { theme, setTheme, pipelines, savePipelineFor, units } = useStore()

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
        <div className="panel p-4">
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
          usedBy={() => 0}
          usedLabel="paints"
          onSave={(p) => savePipelineFor('paint', p)}
        />
        <PipelineEditor
          title="Scheme pipeline"
          description="Status of your paint schemes and recipes."
          pipeline={pipelines.scheme}
          defaults={DEFAULT_PIPELINES.scheme}
          usedBy={() => 0}
          usedLabel="schemes"
          onSave={(p) => savePipelineFor('scheme', p)}
        />
      </section>

      <section id="settings-catalogue" className="scroll-mt-4">
        <CataloguePage />
      </section>

      <section id="settings-backup" className="scroll-mt-4">
        <BackupPage />
      </section>
    </div>
  )
}
