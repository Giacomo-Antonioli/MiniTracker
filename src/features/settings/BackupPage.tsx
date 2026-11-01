import { useEffect, useState } from 'react'
import { useStore } from '../../app/store'
import { estimateBackupBytes } from '../../data/backup'

const mb = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)

export function BackupPage() {
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
      setMessage({ ok: true, text: `Backup downloaded (${mb(blob.size)}).` })
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function restore(file: File) {
    if (!confirm(`Replace ALL current data (${units.length} units and their photos) with "${file.name}"?\n\nThis cannot be undone. Make a backup first if unsure.`)) return
    setBusy(true)
    setMessage(null)
    try {
      const r = await importBackup(file)
      setMessage({ ok: true, text: `Restored ${r.units} units and ${r.photos} photos (backup from ${new Date(r.exportedAt).toLocaleString()}).` })
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
      <h2 className="font-display text-xl text-accent">Backup</h2>
      <p className="text-muted">Your data lives only in this browser. Download a backup regularly, and use it to move your collection to another device.</p>
      <section className="panel grid gap-3 p-4">
        <h3 className="font-display text-lg">Export</h3>
        <div className="grid gap-2" role="radiogroup" aria-label="Backup type">
          {choice(false, 'Light', 'Units, history, paints, settings and the compressed copies of your photos. Small: recommended for regular backups.')}
          {choice(true, 'Full', 'Everything in Light plus the original photos. Much bigger: keep one now and then as an archive.')}
        </div>
        <button className="btn btn-primary w-fit" disabled={busy} onClick={() => void download()}>⬇ Download {full ? 'full' : 'light'} backup</button>
      </section>
      <section className="panel grid gap-2 p-4">
        <h3 className="font-display text-lg">Import</h3>
        <p className="text-sm text-muted">
          Replaces everything in this browser with the file's content (backup .zip, or an older .json). After a light backup, originals still on this device are kept.
        </p>
        <label className={`btn w-fit ${busy ? 'pointer-events-none opacity-50' : ''}`}>
          ⬆ Choose backup file…
          <input
            type="file"
            accept=".zip,application/zip,.json,application/json"
            aria-label="Backup file"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void restore(f)
            }}
          />
        </label>
      </section>
      {busy && <p className="text-muted" role="status">Working…</p>}
      {message && <p role="status" className={message.ok ? 'text-ok' : 'text-danger'}>{message.text}</p>}
    </div>
  )
}
