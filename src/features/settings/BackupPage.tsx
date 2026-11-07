import { useEffect, useState } from 'react'
import { useStore } from '../../app/store'
import { estimateBackupBytes } from '../../data/backup'
import { useT } from '../../i18n'
import { formatDate } from '../../i18n/format'

const mb = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)

export function BackupPage() {
  const t = useT()
  const { units, exportBackup, importBackup, photoUsage } = useStore()
  const [full, setFull] = useState(false)
  const [usage, setUsage] = useState<{ photos: number; displayBytes: number; originalBytes: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    void photoUsage().then(setUsage)
  }, [photoUsage])

  async function download() {
    setBusy(true)
    setMessage(null)
    try {
      const blob = await exportBackup(full)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `minitracker-backup-${new Date().toISOString().slice(0, 10)}${full ? '-full' : ''}.zip`
      a.click()
      URL.revokeObjectURL(url)
      setMessage({ ok: true, text: t('settingsPanels.backup.downloaded', { size: mb(blob.size) }) })
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function restore(file: File) {
    if (!confirm(t('settingsPanels.backup.confirm', { units: units.length, file: file.name }))) return
    setBusy(true)
    setMessage(null)
    try {
      const r = await importBackup(file)
      setMessage({ ok: true, text: t('settingsPanels.backup.restored', { units: r.units, photos: r.photos, date: formatDate(r.exportedAt, { dateStyle: 'medium', timeStyle: 'short' }) }) })
      void photoUsage().then(setUsage)
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const choice = (value: boolean, title: string, text: string) => (
    <label className={`panel flex cursor-pointer gap-3 p-3 ${full === value ? 'border-accent' : ''}`}>
      <input type="radio" name="backup-kind" checked={full === value} onChange={() => setFull(value)} />
      <span>
        <b>{title}</b> {usage && <span className="text-muted">≈ {mb(estimateBackupBytes(usage, value))}</span>}
        <span className="block text-sm text-muted">{text}</span>
      </span>
    </label>
  )

  return (
    <div className="grid gap-4">
      <h2 className="font-display text-xl text-accent">{t('settingsPanels.backup.title')}</h2>
      <p className="text-muted">{t('settingsPanels.backup.intro')}</p>
      <section className="panel grid gap-3 p-4">
        <h3 className="font-display text-lg">{t('settingsPanels.backup.export')}</h3>
        <div className="grid gap-2" role="radiogroup" aria-label={t('settingsPanels.backup.type')}>
          {choice(false, t('settingsPanels.backup.light'), t('settingsPanels.backup.lightHelp'))}
          {choice(true, t('settingsPanels.backup.full'), t('settingsPanels.backup.fullHelp'))}
        </div>
        <button className="btn btn-primary w-fit" disabled={busy} onClick={() => void download()}>{full ? t('settingsPanels.backup.downloadFull') : t('settingsPanels.backup.downloadLight')}</button>
      </section>
      <section className="panel grid gap-2 p-4">
        <h3 className="font-display text-lg">{t('settingsPanels.backup.import')}</h3>
        <p className="text-sm text-muted">
          {t('settingsPanels.backup.importHelp')}
        </p>
        <label className={`btn w-fit ${busy ? 'pointer-events-none opacity-50' : ''}`}>
          {t('settingsPanels.backup.choose')}
          <input
            type="file"
            accept=".zip,application/zip,.json,application/json"
            aria-label={t('settingsPanels.backup.file')}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void restore(f)
            }}
          />
        </label>
      </section>
      {busy && <p className="text-muted" role="status">{t('settingsPanels.backup.working')}</p>}
      {message && <p role="status" className={message.ok ? 'text-ok' : 'text-danger'}>{message.text}</p>}
    </div>
  )
}
