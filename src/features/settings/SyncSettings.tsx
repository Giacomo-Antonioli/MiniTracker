import { useEffect, useState } from 'react'
import { appDb } from '../../app/store'
import { forgetDevice, getDevice, getKnownDevices, getSyncPrefs, saveSyncPrefs, setDeviceName, type KnownDevice } from '../../data/syncDevice'
import type { SyncPrefs } from '../../data/syncStamps'

/** Settings › Sync: this device's name, the remembered sync choices, deletion markers, TURN server, known devices. */
export function SyncSettings() {
  const [name, setName] = useState('')
  const [prefs, setPrefs] = useState<SyncPrefs>({})
  const [devices, setDevices] = useState<KnownDevice[]>([])
  const [msg, setMsg] = useState('')
  useEffect(() => {
    void (async () => {
      setName((await getDevice(appDb)).deviceName)
      setPrefs(await getSyncPrefs(appDb))
      setDevices(await getKnownDevices(appDb))
    })()
  }, [])
  const save = async (p: Partial<SyncPrefs>) => setPrefs(await saveSyncPrefs(appDb, p))
  const turn = prefs.turn ?? { urls: '' }

  return (
    <div className="grid gap-3">
      <section className="panel grid gap-2 p-4" aria-label="This device">
        <h3 className="font-display text-lg">This device</h3>
        <form className="flex flex-wrap gap-2" onSubmit={async (e) => {
          e.preventDefault()
          try {
            await setDeviceName(appDb, name)
            setMsg('Name saved.')
          } catch (x) {
            setMsg((x as Error).message)
          }
        }}>
          <input className="input flex-1" aria-label="Device name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Studio PC" />
          <button className="btn btn-primary">Save name</button>
        </form>
        <p className="text-xs text-muted">Shown on the other device during a sync.</p>
        {msg && <p className="text-sm" role="status">{msg}</p>}
      </section>

      <section className="panel grid gap-2 p-4 text-sm" aria-label="Sync choices">
        <h3 className="font-display text-lg">Default choices</h3>
        <label className="flex flex-wrap items-center gap-2">Direction
          <select className="input" aria-label="Default direction" value={prefs.direction ?? 'both'} onChange={(e) => void save({ direction: e.target.value as SyncPrefs['direction'], ...(e.target.value === 'both' ? { mode: 'merge' } : {}) })}>
            <option value="both">Both ways</option><option value="send">Send from this device</option><option value="receive">Receive on this device</option>
          </select>
        </label>
        <label className="flex flex-wrap items-center gap-2">Data
          <select className="input" aria-label="Default mode" value={prefs.mode ?? 'merge'} disabled={(prefs.direction ?? 'both') === 'both'} onChange={(e) => void save({ mode: e.target.value as SyncPrefs['mode'] })}>
            <option value="merge">Merge, newest wins</option><option value="overwrite">Overwrite the receiver</option>
          </select>
        </label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.applyDeletions ?? true} onChange={(e) => void save({ applyDeletions: e.target.checked })} /> Apply deletions from the other device when merging</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.photos ?? false} onChange={(e) => void save({ photos: e.target.checked })} /> Include photos</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.tagDeletions ?? false} onChange={(e) => void save({ tagDeletions: e.target.checked })} /> Mark deletions on this device so other devices can apply them</label>
        <p className="text-xs text-muted">Deletion markers are kept for 90 days. Without them, a merge brings back items you deleted here if another device still has them.</p>
      </section>

      <section className="panel grid gap-2 p-4 text-sm" aria-label="TURN server">
        <h3 className="font-display text-lg">TURN server (optional)</h3>
        <p className="text-xs text-muted">Only needed when two devices can't connect directly (some work, school or mobile networks). The data stays end-to-end encrypted. Use a free account with a TURN provider or your own coturn.</p>
        <form className="grid gap-2 sm:grid-cols-3" onSubmit={(e) => {
          e.preventDefault()
          const f = new FormData(e.currentTarget)
          const urls = String(f.get('urls') ?? '').trim()
          void save({ turn: urls ? { urls, username: String(f.get('username') ?? '') || undefined, credential: String(f.get('credential') ?? '') || undefined } : undefined })
        }}>
          <input className="input" name="urls" aria-label="TURN address" placeholder="turn:turn.example.com:3478" defaultValue={turn.urls} key={turn.urls} />
          <input className="input" name="username" aria-label="TURN username" placeholder="Username" defaultValue={turn.username} />
          <input className="input" name="credential" type="password" aria-label="TURN password" placeholder="Password" defaultValue={turn.credential} />
          <button className="btn w-fit">Save TURN server</button>
        </form>
      </section>

      <section className="panel grid gap-2 p-4 text-sm" aria-label="Known devices">
        <h3 className="font-display text-lg">Devices synced with</h3>
        {devices.length ? devices.map((d) => (
          <div key={d.id} className="flex items-center gap-2">
            <span className="flex-1">{d.name} <span className="text-xs text-muted">· last sync {d.lastSync.slice(0, 10)}</span></span>
            <button className="btn px-2 py-0.5" aria-label={`Forget ${d.name}`} onClick={async () => { await forgetDevice(appDb, d.id); setDevices(await getKnownDevices(appDb)) }}>✕</button>
          </div>
        )) : <p className="text-muted">None yet.</p>}
      </section>
    </div>
  )
}
