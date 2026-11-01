import { useState } from 'react'
import { useStore } from '../../app/store'
import { parseBackup } from '../../data/backup'

export function BackupPage() {
  const { units, exportBackup, importBackup } = useStore()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function download() {
    const text = await exportBackup()
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `minitracker-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage({ ok: true, text: 'Backup downloaded.' })
  }

  async function restore(file: File) {
    try {
      const text = await file.text()
      const b = parseBackup(text)
      const ok = confirm(
        `Replace ALL current data (${units.length} units) with this backup from ${new Date(b.exportedAt).toLocaleString()} ` +
          `(${b.data.units.length} units)?\n\nThis cannot be undone. Export a backup first if unsure.`,
      )
      if (!ok) return
      await importBackup(text)
      setMessage({ ok: true, text: `Restored ${b.data.units.length} units.` })
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message })
    }
  }

  return (
    <div className="grid max-w-2xl gap-4">
      <h1 className="font-display text-2xl text-accent">Backup</h1>
      <p className="text-muted">
        Your data lives only in this browser. Download a backup regularly, and use it to move your collection to another device.
      </p>
      <section className="panel grid gap-2 p-4">
        <h2 className="font-display text-lg">Export</h2>
        <p className="text-sm text-muted">Saves units, history and settings to one JSON file.</p>
        <button className="btn btn-primary w-fit" onClick={() => void download()}>⬇ Download backup</button>
      </section>
      <section className="panel grid gap-2 p-4">
        <h2 className="font-display text-lg">Import</h2>
        <p className="text-sm text-muted">Replaces everything in this browser with the file's content. You'll be asked to confirm.</p>
        <label className="btn w-fit">
          ⬆ Choose backup file…
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void restore(f)
            }}
          />
        </label>
      </section>
      {message && <p role="status" className={message.ok ? 'text-ok' : 'text-danger'}>{message.text}</p>}
    </div>
  )
}
