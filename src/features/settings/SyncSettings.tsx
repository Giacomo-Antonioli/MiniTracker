import { useEffect, useState } from 'react'
import { appDb } from '../../app/store'
import { forgetDevice, getDevice, getKnownDevices, getSyncPrefs, saveSyncPrefs, setDeviceName, type KnownDevice } from '../../data/syncDevice'
import type { SyncPrefs } from '../../data/syncStamps'
import { useT } from '../../i18n'
import { formatDate } from '../../i18n/format'

/** Settings › Sync: this device's name, the remembered sync choices, deletion markers, TURN server, known devices. */
export function SyncSettings() {
  const t = useT()
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
      <section className="panel grid gap-2 p-4" aria-label={t('settingsPanels.sync.device')}>
        <h3 className="font-display text-lg">{t('settingsPanels.sync.device')}</h3>
        <form className="flex flex-wrap gap-2" onSubmit={async (e) => {
          e.preventDefault()
          try {
            await setDeviceName(appDb, name)
            setMsg(t('settingsPanels.sync.saved'))
          } catch (x) {
            setMsg((x as Error).message)
          }
        }}>
          <input className="input flex-1" aria-label={t('settingsPanels.sync.name')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('settingsPanels.sync.namePlaceholder')} />
          <button className="btn btn-primary">{t('settingsPanels.sync.saveName')}</button>
        </form>
        <p className="text-xs text-muted">{t('settingsPanels.sync.nameHelp')}</p>
        {msg && <p className="text-sm" role="status">{msg}</p>}
      </section>

      <section className="panel grid gap-2 p-4 text-sm" aria-label={t('settingsPanels.sync.choices')}>
        <h3 className="font-display text-lg">{t('settingsPanels.sync.defaults')}</h3>
        <label className="flex flex-wrap items-center gap-2">{t('settingsPanels.sync.direction')}
          <select className="input" aria-label={t('settingsPanels.sync.defaultDirection')} value={prefs.direction ?? 'both'} onChange={(e) => void save({ direction: e.target.value as SyncPrefs['direction'], ...(e.target.value === 'both' ? { mode: 'merge' } : {}) })}>
            <option value="both">{t('settingsPanels.sync.both')}</option><option value="send">{t('settingsPanels.sync.send')}</option><option value="receive">{t('settingsPanels.sync.receive')}</option>
          </select>
        </label>
        <label className="flex flex-wrap items-center gap-2">{t('settingsPanels.sync.data')}
          <select className="input" aria-label={t('settingsPanels.sync.defaultMode')} value={prefs.mode ?? 'merge'} disabled={(prefs.direction ?? 'both') === 'both'} onChange={(e) => void save({ mode: e.target.value as SyncPrefs['mode'] })}>
            <option value="merge">{t('settingsPanels.sync.merge')}</option><option value="overwrite">{t('settingsPanels.sync.overwrite')}</option>
          </select>
        </label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.applyDeletions ?? true} onChange={(e) => void save({ applyDeletions: e.target.checked })} /> {t('settingsPanels.sync.applyDeletions')}</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.photos ?? false} onChange={(e) => void save({ photos: e.target.checked })} /> {t('settingsPanels.sync.photos')}</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.tagDeletions ?? false} onChange={(e) => void save({ tagDeletions: e.target.checked })} /> {t('settingsPanels.sync.tagDeletions')}</label>
        <p className="text-xs text-muted">{t('settingsPanels.sync.markersHelp')}</p>
      </section>

      <section className="panel grid gap-2 p-4 text-sm" aria-label={t('settingsPanels.sync.turn')}>
        <h3 className="font-display text-lg">{t('settingsPanels.sync.turnTitle')}</h3>
        <p className="text-xs text-muted">{t('settingsPanels.sync.turnHelp')}</p>
        <form className="grid gap-2 sm:grid-cols-3" onSubmit={(e) => {
          e.preventDefault()
          const f = new FormData(e.currentTarget)
          const urls = String(f.get('urls') ?? '').trim()
          void save({ turn: urls ? { urls, username: String(f.get('username') ?? '') || undefined, credential: String(f.get('credential') ?? '') || undefined } : undefined })
        }}>
          <input className="input" name="urls" aria-label={t('settingsPanels.sync.turnAddress')} placeholder="turn:turn.example.com:3478" defaultValue={turn.urls} key={turn.urls} />
          <input className="input" name="username" aria-label={t('settingsPanels.sync.turnUser')} placeholder={t('settingsPanels.sync.username')} defaultValue={turn.username} />
          <input className="input" name="credential" type="password" aria-label={t('settingsPanels.sync.turnPassword')} placeholder={t('settingsPanels.sync.password')} defaultValue={turn.credential} />
          <button className="btn w-fit">{t('settingsPanels.sync.saveTurn')}</button>
        </form>
      </section>

      <section className="panel grid gap-2 p-4 text-sm" aria-label={t('settingsPanels.sync.known')}>
        <h3 className="font-display text-lg">{t('settingsPanels.sync.knownTitle')}</h3>
        {devices.length ? devices.map((d) => (
          <div key={d.id} className="flex items-center gap-2">
            <span className="flex-1">{d.name} <span className="text-xs text-muted">{t('settingsPanels.sync.lastSync', { date: formatDate(d.lastSync) })}</span></span>
            <button className="btn px-2 py-0.5" aria-label={t('settingsPanels.sync.forget', { name: d.name })} onClick={async () => { await forgetDevice(appDb, d.id); setDevices(await getKnownDevices(appDb)) }}>✕</button>
          </div>
        )) : <p className="text-muted">{t('settingsPanels.sync.none')}</p>}
      </section>
    </div>
  )
}
