import QRCode from 'qrcode'
import { useEffect, useRef, useState } from 'react'
import { appDb, useStore } from '../../app/store'
import type { MergeSummary } from '../../domain/sync/merge'
import { CLOCK_WARN_SECONDS, deviceCodeFor, formatPairCode, newPairCode, pairLink, parsePairCode, type Hello } from '../../domain/sync/protocol'
import { hostByCode, joinByCode, NO_DIRECT, privateAnswer, privateOffer, type Channel } from '../../data/syncChannel'
import { getDevice, getKnownDevices, getSyncPrefs, isStale, getLanCert, markLanPaired, recordSync, saveLanCert, saveSyncPrefs, type Device, type KnownDevice } from '../../data/syncDevice'
import { applySyncFile, makeSyncFile, parseSyncFile, previewSyncFile, syncFileName, type SyncFile } from '../../data/syncFile'
import { runSync, type Direction, type SyncPlan } from '../../data/syncSession'
import type { SyncPrefs } from '../../data/syncStamps'
import { Dialog } from '../../ui/Dialog'
import { ScanDialog } from '../storage/Labels'
import { QrReceiver, QrSender } from './QrCarousel'
import { appUrl, isDesktopApp } from '../../app/platform'
import { txr, useTx } from '../../i18n'
import { NearbyDevices } from './NearbyDevices'
import { BluetoothSync } from './BluetoothSync'

const TABLE_NAMES: Record<string, () => string> = {
  units: () => txr('Units'), statusEvents: () => txr('Painting history'), paintStock: () => txr('Paint stock'), customPaints: () => txr('Custom paints'), photos: () => txr('Photos'),
  schemes: () => txr('Schemes'), lists: () => txr('Army lists'), shopItems: () => txr('Shopping items'), shopLists: () => txr('Shopping lists'), settings: () => txr('Settings items'),
}

type Step =
  | { kind: 'idle' }
  | { kind: 'hosting'; code: string; qr: string; cancel: () => void }
  | { kind: 'connecting'; text: string }
  | { kind: 'offer'; text: string; qr?: string; accept: (answer: string) => Promise<Channel>; cancel: () => void }
  | { kind: 'answer'; text: string; qr?: string }
  | { kind: 'running'; label: string; have: number; total: number }
  | { kind: 'done'; text: string }
  | { kind: 'error'; text: string }

type Ask =
  | { kind: 'plan'; plan: SyncPlan; other: Hello; resolve: (ok: boolean) => void }
  | { kind: 'changes'; summary: Record<string, MergeSummary>; resolve: (ok: boolean) => void }

const qrOf = (t: string) => QRCode.toString(t, { type: 'svg', margin: 1, errorCorrectionLevel: 'L' }).catch(() => undefined)
const appBase = appUrl

/** The changes a sync will make here, per kind of data. */
export function ChangesTable({ summary }: { summary: Record<string, MergeSummary> }) {
  const tx = useTx()
  const rows = Object.entries(summary).filter(([, s]) => s.added || s.updated || s.deleted)
  if (!rows.length) return <p className="text-sm text-muted">{tx('Nothing changes on this device: it already has everything.')}</p>
  return (
    <table className="w-full text-sm" aria-label={tx('Changes')}>
      <thead className="text-left text-xs text-muted"><tr><th>{tx('Data')}</th><th>{tx('New')}</th><th>{tx('Changed')}</th><th>{tx('Deleted')}</th></tr></thead>
      <tbody>
        {rows.map(([k, s]) => (
          <tr key={k} className="border-t border-line"><td className="py-1">{TABLE_NAMES[k]?.() ?? k}</td><td>{s.added}</td><td>{s.updated}</td><td className={s.deleted ? 'text-danger' : ''}>{s.deleted}</td></tr>
        ))}
      </tbody>
    </table>
  )
}

function PlanForm({ plan, setPlan, remember, setRemember }: { plan: SyncPlan; setPlan: (p: SyncPlan) => void; remember: boolean; setRemember: (b: boolean) => void }) {
  const tx = useTx()
  const set = (p: Partial<SyncPlan>) => {
    const next = { ...plan, ...p }
    if (next.direction === 'both') next.mode = 'merge'
    setPlan(next)
  }
  return (
    <fieldset className="grid gap-2 text-sm" aria-label={tx('What to sync')}>
      <label className="flex flex-wrap items-center gap-2">{tx('Direction')}
        <select className="input" aria-label={tx('Direction')} value={plan.direction} onChange={(e) => set({ direction: e.target.value as Direction })}>
          <option value="both">{tx('Both ways')}</option>
          <option value="send">{tx('Send from this device')}</option>
          <option value="receive">{tx('Receive on this device')}</option>
        </select>
      </label>
      <label className="flex flex-wrap items-center gap-2">{tx('What happens to the data')}
        <select className="input" aria-label={tx('Mode')} value={plan.mode} disabled={plan.direction === 'both'} onChange={(e) => set({ mode: e.target.value as SyncPlan['mode'] })}>
          <option value="merge">{tx('Merge, newest wins')}</option>
          <option value="overwrite">{tx('Overwrite the receiver')}</option>
        </select>
        {plan.direction === 'both' && <span className="text-xs text-muted">{tx('Both ways always merges.')}</span>}
      </label>
      {plan.mode === 'merge' && <label className="flex items-center gap-2"><input type="checkbox" checked={plan.applyDeletions} onChange={(e) => set({ applyDeletions: e.target.checked })} /> {tx('Also apply deletions from the other device')}</label>}
      <label className="flex items-center gap-2"><input type="checkbox" checked={plan.photos} onChange={(e) => set({ photos: e.target.checked })} /> {tx('Include photos (slower; photos already there are skipped)')}</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={!!plan.catalogues} onChange={(e) => set({ catalogues: e.target.checked })} /> {tx('Include game catalogues (large; catalogues already there are skipped)')}</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> {tx('Remember my choice (change it in Settings › Sync)')}</label>
    </fieldset>
  )
}

const planFrom = (p: SyncPrefs): SyncPlan => ({ direction: p.direction ?? 'both', mode: p.direction === 'both' || !p.direction ? 'merge' : p.mode ?? 'merge', applyDeletions: p.applyDeletions ?? true, photos: p.photos ?? false, catalogues: p.catalogues ?? false })

/** Sync with another device: pair by code, QR, link or (no relay) connection text; or use a sync file. */
export function SyncPage({ code: linkCode, onOpenSettings }: { code?: string; onOpenSettings?: () => void }) {
  const tx = useTx()
  const load = useStore((s) => s.load)
  const [me, setMe] = useState<Device>()
  const [prefs, setPrefs] = useState<SyncPrefs>({})
  const [devices, setDevices] = useState<KnownDevice[]>([])
  const [plan, setPlan] = useState<SyncPlan>(planFrom({}))
  const [remember, setRemember] = useState(false)
  const [step, setStep] = useState<Step>({ kind: 'idle' })
  const [ask, setAsk] = useState<Ask>()
  const [warn, setWarn] = useState('')
  const [typed, setTyped] = useState(linkCode ? formatPairCode(linkCode) : '')
  const [scan, setScan] = useState<'code' | 'offer' | 'answer'>()
  const [pasted, setPasted] = useState('')
  const channel = useRef<Channel | undefined>(undefined)
  const [carousel, setCarousel] = useState<'send' | 'read'>()
  const [qrFile, setQrFile] = useState<SyncFile>()

  const refresh = async () => {
    setMe(await getDevice(appDb))
    const p = await getSyncPrefs(appDb)
    setPrefs(p)
    setPlan(planFrom(p))
    setDevices(await getKnownDevices(appDb))
  }
  useEffect(() => {
    void refresh()
  }, [])
  const turn = prefs.turn?.urls ? { turn: prefs.turn } : {}
  const fail = (e: unknown) => setStep({ kind: 'error', text: (e as Error).message || tx('Sync failed') })

  /** Run the sync conversation on an open channel. */
  async function talk(ch: Channel, starts: boolean) {
    channel.current = ch
    if (starts && remember) setPrefs(await saveSyncPrefs(appDb, plan))
    setStep({ kind: 'running', label: tx('Connected'), have: 0, total: 0 })
    try {
      const res = await runSync(appDb, ch, me!, starts ? { starts: true, plan } : { starts: false }, {
        onHello: (other, skew) => setWarn(Math.abs(skew) > CLOCK_WARN_SECONDS ? tx('The clocks of this device and {{name}} differ by {{n}} seconds. Merging picks the newest edit by time, so set both clocks right first.', { name: other.deviceName, n: Math.abs(skew) }) : ''),
        confirmPlan: (p, other) => new Promise((resolve) => setAsk({ kind: 'plan', plan: p, other, resolve })),
        confirmChanges: (summary) => new Promise((resolve) => setAsk({ kind: 'changes', summary, resolve })),
        onProgress: (label, have, total) => setStep({ kind: 'running', label, have, total }),
      })
      if (res.other) await recordSync(appDb, res.other, new Date().toISOString())
      if (res.applied) await load()
      setStep({ kind: 'done', text: res.applied ? tx('Synced with {{name}}.', { name: res.other?.deviceName ?? '' }) : res.summary ? tx('Nothing was changed on this device.') : tx('Sent to {{name}}.', { name: res.other?.deviceName ?? '' }) })
      setDevices(await getKnownDevices(appDb))
    } catch (e) {
      fail(e)
    } finally {
      channel.current = undefined
      setAsk(undefined)
    }
  }

  const host = async () => {
    try {
      const code = newPairCode()
      setStep({ kind: 'connecting', text: tx('Getting a pairing code…') })
      const h = await hostByCode(code, turn)
      setStep({ kind: 'hosting', code, qr: (await qrOf(pairLink(appBase(), code))) ?? '', cancel: h.cancel })
      void talk(await h.channel, false)
    } catch (e) {
      fail(e)
    }
  }
  const join = async (raw: string, device?: KnownDevice) => {
    const code = parsePairCode(raw)
    if (!code) return setStep({ kind: 'error', text: tx('That is not a pairing code; it looks like K7P-42QX.') })
    try {
      setStep({ kind: 'connecting', text: device ? tx('Connecting to {{name}}…', { name: device.name }) : tx('Connecting to {{name}}…', { name: formatPairCode(code) }) })
      void talk(await joinByCode(code, turn), true)
    } catch (e) {
      if (device && /No device is waiting/.test((e as Error).message)) setStep({ kind: 'error', text: tx("{{name}} isn't reachable right now. Open ⇄ Sync on it (both apps open), then try again.", { name: device.name }) })
      else fail(e)
    }
  }
  const startPrivate = async () => {
    try {
      setStep({ kind: 'connecting', text: tx('Making the connection text…') })
      const o = await privateOffer(turn)
      setStep({ kind: 'offer', text: o.offer, qr: await qrOf(o.offer), accept: o.accept, cancel: o.cancel })
    } catch (e) {
      fail(e)
    }
  }
  const answerPrivate = async (offer: string) => {
    try {
      const a = await privateAnswer(offer, turn)
      setStep({ kind: 'answer', text: a.answer, qr: await qrOf(a.answer) })
      void talk(await a.channel, false)
    } catch (e) {
      fail(e)
    }
  }
  const finishPrivate = async (answer: string) => {
    if (step.kind !== 'offer') return
    try {
      setStep({ kind: 'connecting', text: tx('Connecting…') })
      void talk(await step.accept(answer), true)
    } catch (e) {
      fail(e)
    }
  }
  const cancel = () => {
    if (step.kind === 'hosting' || step.kind === 'offer') step.cancel()
    channel.current?.close()
    ask?.resolve(false)
    setAsk(undefined)
    setStep({ kind: 'idle' })
  }

  // a pairing link opened on this device: connect straight away
  const joined = useRef(false)
  useEffect(() => {
    if (linkCode && me && !joined.current) {
      joined.current = true
      void join(linkCode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkCode, me])

  const busy = step.kind !== 'idle' && step.kind !== 'done' && step.kind !== 'error'
  const busyRef = useRef(busy)
  busyRef.current = busy
  const talkRef = useRef(talk)
  talkRef.current = talk

  // While this page is open, devices that synced before can reach this one under its own code.
  const [listening, setListening] = useState(false)
  useEffect(() => {
    if (!me) return
    let dead = false
    let cancel: (() => void) | undefined
    let retry: ReturnType<typeof setTimeout> | undefined
    const listen = async () => {
      try {
        const h = await hostByCode(deviceCodeFor(me.deviceId), prefs.turn?.urls ? { turn: prefs.turn } : {})
        if (dead) return h.cancel()
        cancel = h.cancel
        setListening(true)
        const ch = await h.channel
        setListening(false)
        if (dead || busyRef.current) ch.close()
        else await talkRef.current(ch, false)
      } catch {
        // no relay, or this device is already listening in another tab: try again later
      }
      setListening(false)
      if (!dead) retry = setTimeout(() => void listen(), 5000)
    }
    void listen()
    return () => {
      dead = true
      cancel?.()
      clearTimeout(retry)
    }
  }, [me, prefs.turn])
  const now = new Date().toISOString()

  return (
    <div className="grid max-w-3xl gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl text-accent" data-tour="sync-title">{tx('Sync')}</h1>
        {me && <span className="text-sm text-muted">{tx('This device:')} <b className="text-fg">{me.deviceName}</b>{onOpenSettings && <> · <button className="underline" onClick={onOpenSettings}>{tx('Sync settings')}</button></>}</span>}
      </header>
      {listening && <p className="text-xs text-ok" role="note">{tx('📡 Devices you synced with before can sync with this one while this page is open.')}</p>}
      <p className="text-sm text-muted">{tx('Sync with another device running MiniTracker: phone, tablet or PC. The data goes directly between the two devices, encrypted; only the short pairing messages pass through a relay. Both apps must be open.')}</p>

      {me && isDesktopApp() && (
        <NearbyDevices me={me} busy={busy} known={devices} turn={prefs.turn?.urls ? prefs.turn : undefined}
          onStatus={(text) => setStep({ kind: 'connecting', text })}
          onError={(text) => setStep({ kind: 'error', text })}
          cert={{ load: () => getLanCert(appDb), save: (c) => saveLanCert(appDb, c) }}
          onChannel={(ch, starts, other, print) => void (async () => {
            await markLanPaired(appDb, other, new Date().toISOString(), print)
            setDevices(await getKnownDevices(appDb))
            await talk(ch, starts)
          })()} />
      )}
      {me && isDesktopApp() && (
        <BluetoothSync me={me} busy={busy}
          onStatus={(text) => setStep({ kind: 'connecting', text })}
          onError={(text) => setStep({ kind: 'error', text })}
          onChannel={(ch, starts) => void talk(ch, starts)} />
      )}
      {!busy && (
        <section className="panel grid gap-3 p-4" aria-label={tx('Start a sync')}>
          <PlanForm plan={plan} setPlan={setPlan} remember={remember} setRemember={setRemember} />
          <p className="text-xs text-muted">{tx('These choices apply on the device that enters the code; the other device is asked to accept them.')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid content-start gap-2 rounded border border-line p-3">
              <h2 className="font-semibold">{tx('Show a code here')}</h2>
              <button className="btn btn-primary w-fit" onClick={() => void host()}>{tx('📱 Show a pairing code')}</button>
              <p className="text-xs text-muted">{tx('Shows a code, QR and link; enter or scan it on the other device.')}</p>
            </div>
            <form className="grid content-start gap-2 rounded border border-line p-3" onSubmit={(e) => { e.preventDefault(); void join(typed) }}>
              <h2 className="font-semibold">{tx('Enter a code')}</h2>
              <div className="flex gap-2">
                <input className="input w-32 font-mono uppercase" aria-label={tx('Pairing code')} placeholder="K7P-42QX" value={typed} onChange={(e) => setTyped(e.target.value)} />
                <button className="btn btn-primary">{tx('Connect')}</button>
                <button type="button" className="btn" onClick={() => setScan('code')}>📷</button>
              </div>
              <p className="text-xs text-muted">{tx("Or scan the other device's QR with the phone camera.")}</p>
            </form>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer">{tx('Private mode (no relay)')}</summary>
            <div className="mt-2 grid gap-2">
              <p className="text-xs text-muted">{tx('Nothing goes through a relay: copy (or scan) a connection text from one device to the other, then the reply back.')}</p>
              <button className="btn w-fit" onClick={() => void startPrivate()}>{tx('Start here')}</button>
              <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void answerPrivate(pasted) }}>
                <textarea className="input flex-1 font-mono text-xs" rows={2} aria-label={tx('Connection text from the other device')} placeholder={tx("…or paste the other device's connection text")} value={pasted} onChange={(e) => setPasted(e.target.value)} />
                <button className="btn" disabled={!pasted.trim()}>{tx('Reply')}</button>
                <button type="button" className="btn" onClick={() => setScan('offer')}>📷</button>
              </form>
            </div>
          </details>
        </section>
      )}

      {step.kind === 'connecting' && <p className="panel p-3 text-sm" role="status">{step.text}</p>}
      {step.kind === 'hosting' && (
        <section className="panel grid justify-items-center gap-2 p-4 text-center" aria-label={tx('Pairing code')}>
          <p className="text-sm">{tx('On the other device, open Sync and enter')}</p>
          <p className="font-mono text-4xl font-bold tracking-widest">{formatPairCode(step.code)}</p>
          {step.qr && <div className="w-48 rounded bg-white p-2" dangerouslySetInnerHTML={{ __html: step.qr }} />}
          <p className="text-xs text-muted">{tx('or scan the QR with its camera, or open')} <span className="select-all break-all">{pairLink(appBase(), step.code)}</span></p>
          <p className="text-sm text-muted">{tx('Waiting for the other device…')}</p>
        </section>
      )}
      {(step.kind === 'offer' || step.kind === 'answer') && (
        <section className="panel grid gap-2 p-4" aria-label={tx('Connection text')}>
          <p className="text-sm">{step.kind === 'offer' ? tx('1. On the other device open Sync › Private mode and paste (or scan) this:') : tx('Now paste (or scan) this reply on the first device:')}</p>
          {step.qr && <div className="w-56 rounded bg-white p-2" dangerouslySetInnerHTML={{ __html: step.qr }} />}
          <textarea className="input font-mono text-xs" rows={3} readOnly aria-label={tx("This device's connection text")} value={step.text} onFocus={(e) => e.target.select()} />
          <button className="btn w-fit" onClick={() => void navigator.clipboard?.writeText(step.text)}>{tx('📋 Copy')}</button>
          {step.kind === 'offer' && (
            <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void finishPrivate(pasted) }}>
              <textarea className="input flex-1 font-mono text-xs" rows={2} aria-label={tx('Reply from the other device')} placeholder={tx('2. Paste the reply here')} value={pasted} onChange={(e) => setPasted(e.target.value)} />
              <button className="btn btn-primary" disabled={!pasted.trim()}>{tx('Connect')}</button>
              <button type="button" className="btn" onClick={() => setScan('answer')}>📷</button>
            </form>
          )}
        </section>
      )}
      {step.kind === 'running' && (
        <section className="panel grid gap-2 p-4" aria-label={tx('Sync progress')}>
          <p className="text-sm" role="status">{step.label}{step.total ? ` ${step.have}/${step.total}` : '…'}</p>
          <progress className="w-full" max={step.total || 1} value={step.total ? step.have : undefined} aria-label={tx('Progress')} />
        </section>
      )}
      {warn && busy && <p className="panel p-3 text-sm text-danger" role="alert">⚠ {warn}</p>}
      {busy && <button className="btn w-fit" onClick={cancel}>{tx('✕ Cancel')}</button>}
      {step.kind === 'done' && <p className="panel p-3 text-sm text-ok" role="status">✓ {step.text}</p>}
      {step.kind === 'error' && (
        <div className="panel grid gap-1 p-3 text-sm" role="alert">
          <p className="text-danger">✕ {step.text}</p>
          {step.text === NO_DIRECT ? (
            <div className="flex flex-wrap gap-2">
              {onOpenSettings && <button className="btn" onClick={onOpenSettings}>{tx('TURN server settings')}</button>}
              <button className="btn" onClick={() => { setStep({ kind: 'idle' }); document.querySelector('[data-sync="qr"]')?.scrollIntoView?.({ behavior: 'smooth' }) }}>{tx('Use the QR carousel')}</button>
              <button className="btn" onClick={() => { setStep({ kind: 'idle' }); document.querySelector('[data-sync="file"]')?.scrollIntoView?.({ behavior: 'smooth' }) }}>{tx('Use a sync file')}</button>
            </div>
          ) : <p className="text-xs text-muted">{tx("If the devices can't reach each other (different networks), add a TURN server in Settings › Sync, or use the QR carousel or a sync file below.")}</p>}
        </div>
      )}

      {ask?.kind === 'plan' && (
        <Dialog title={tx('Accept this sync?')} onClose={() => { ask.resolve(false); setAsk(undefined) }}>
          <div className="grid gap-2 text-sm">
            <p><b>{ask.other.deviceName}</b> {tx('wants to sync:')}</p>
            <ul className="list-disc pl-5">
              <li>{ask.plan.direction === 'both' ? tx('Both ways') : ask.plan.direction === 'receive' ? tx('This device receives') : tx('This device sends')}</li>
              <li>{ask.plan.mode === 'merge' ? (ask.plan.applyDeletions ? tx('Merge, newest wins, deletions applied') : tx('Merge, newest wins')) : tx('Overwrite the receiver')}</li>
              <li>{ask.plan.photos ? tx('With photos') : tx('Without photos')}</li>
              {ask.plan.catalogues && <li>{tx('With game catalogues')}</li>}
            </ul>
            <p className="text-xs text-muted">{tx("You'll see what changes here before anything is saved.")}</p>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={() => { ask.resolve(true); setAsk(undefined) }}>{tx('Accept')}</button>
              <button className="btn" onClick={() => { ask.resolve(false); setAsk(undefined) }}>{tx('Decline')}</button>
            </div>
          </div>
        </Dialog>
      )}
      {ask?.kind === 'changes' && (
        <Dialog title={tx('Apply these changes?')} onClose={() => { ask.resolve(false); setAsk(undefined) }}>
          <div className="grid gap-3 text-sm">
            <ChangesTable summary={ask.summary} />
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={() => { ask.resolve(true); setAsk(undefined) }}>{tx('Apply')}</button>
              <button className="btn" onClick={() => { ask.resolve(false); setAsk(undefined) }}>{tx("Don't change anything")}</button>
            </div>
          </div>
        </Dialog>
      )}

      {scan && <ScanDialog title={scan === 'code' ? tx('Scan the pairing QR') : tx('Scan the connection text')} onClose={() => setScan(undefined)} onText={(t) => {
        const which = scan
        setScan(undefined)
        if (which === 'code') void join(t)
        else if (which === 'offer') void answerPrivate(t)
        else void finishPrivate(t)
      }} />}

      {me && (
        <section className="panel grid gap-2 p-4" data-sync="qr" aria-label={tx('QR carousel')}>
          <h2 className="font-display text-lg">{tx('QR carousel (no network)')}</h2>
          <p className="text-sm text-muted">{tx('No Wi-Fi, no relay: one screen shows a loop of QR codes and the other device reads them with its camera. Data only, no photos. For both ways, do it once in each direction.')}</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn" disabled={busy} onClick={() => setCarousel('send')}>{tx('▶ Show QR carousel')}</button>
            <button className="btn" disabled={busy} onClick={() => setCarousel('read')}>{tx('📷 Read QR carousel')}</button>
          </div>
          {carousel === 'send' && <QrSender me={me} onClose={() => setCarousel(undefined)} />}
          {carousel === 'read' && <QrReceiver onClose={() => setCarousel(undefined)} onFile={(f) => { setCarousel(undefined); setQrFile(f) }} />}
          {qrFile && <ApplyFileDialog file={qrFile} mode={plan.direction === 'send' ? 'merge' : plan.mode} applyDeletions={plan.applyDeletions} onClose={() => setQrFile(undefined)} onApplied={async () => { setQrFile(undefined); setStep({ kind: 'done', text: tx('Applied the data from {{name}}.', { name: qrFile.device.deviceName }) }); await load(); setDevices(await getKnownDevices(appDb)) }} />}
        </section>
      )}

      {me && <SyncFileSection me={me} plan={plan} disabled={busy} onApplied={async () => { await load(); setDevices(await getKnownDevices(appDb)) }} />}

      <section className="panel grid gap-2 p-4" aria-label={tx('Devices')}>
        <h2 className="font-display text-lg">{tx('Devices synced with')}</h2>
        {devices.length ? (
          <ul className="grid gap-1 text-sm">
            {devices.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2">
                <span>{d.name}</span>
                <span className="text-xs text-muted">{tx('last sync {{date}}', { date: d.lastSync.slice(0, 10) })}</span>
                <button className="btn px-2 py-0.5 text-xs" disabled={busy} aria-label={tx('Sync now with {{name}}', { name: d.name })} onClick={() => void join(deviceCodeFor(d.id), d)}>{tx('⇄ Sync now')}</button>
                {isStale(d, now) && <span className="text-xs text-danger">{tx('⚠ Not synced for over 90 days: deletions made since then may come back from it')}</span>}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">{tx('None yet.')}</p>}
      </section>
    </div>
  )
}

/** Export a sync file, or open one from another device. */
function SyncFileSection({ me, plan, disabled, onApplied }: { me: Device; plan: SyncPlan; disabled: boolean; onApplied: () => Promise<void> }) {
  const tx = useTx()
  const [photos, setPhotos] = useState(false)
  const [msg, setMsg] = useState('')
  const [file, setFile] = useState<SyncFile>()
  const mode = plan.direction === 'send' ? 'merge' : plan.mode

  const exportFile = async () => {
    const f = await makeSyncFile(appDb, me, { photos })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(f)], { type: 'application/json' }))
    a.download = syncFileName(f)
    a.click()
    setMsg(tx('Saved {{file}}. Open it on the other device in Sync › Sync file.', { file: a.download }))
  }
  const open = async (f: File) => {
    try {
      setFile(parseSyncFile(await f.text()))
      setMsg('')
    } catch (e) {
      setMsg((e as Error).message)
    }
  }
  return (
    <section className="panel grid gap-2 p-4" data-sync="file" aria-label={tx('Sync file')}>
      <h2 className="font-display text-lg">{tx('Sync file')}</h2>
      <p className="text-sm text-muted">{tx("For devices that aren't on at the same time: save a sync file to a shared folder (OneDrive, Google Drive), a USB stick or a chat, and open it on the other device.")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={photos} onChange={(e) => setPhotos(e.target.checked)} /> {tx('With photos')}</label>
        <button className="btn" disabled={disabled} onClick={() => void exportFile()}>{tx('⬇ Save sync file')}</button>
        <label className="btn cursor-pointer">{tx('⬆ Open sync file')}<input type="file" accept=".json,application/json" className="hidden" aria-label={tx('Open sync file')} disabled={disabled} onChange={(e) => e.target.files?.[0] && void open(e.target.files[0])} /></label>
      </div>
      {msg && <p className="text-sm" role="status">{msg}</p>}
      {file && <ApplyFileDialog file={file} mode={mode} applyDeletions={plan.applyDeletions} onClose={() => setFile(undefined)} onApplied={async () => { setFile(undefined); setMsg(tx('Applied the sync file from {{name}}.', { name: file.device.deviceName })); await onApplied() }} />}
    </section>
  )
}

/** Preview what a sync file (or QR carousel) changes here, then apply it. */
export function ApplyFileDialog({ file, mode, applyDeletions, onClose, onApplied }: { file: SyncFile; mode: SyncPlan['mode']; applyDeletions: boolean; onClose: () => void; onApplied: () => Promise<void> }) {
  const tx = useTx()
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewSyncFile>>>()
  const [err, setErr] = useState('')
  useEffect(() => {
    previewSyncFile(appDb, file, { mode, applyDeletions }).then(setPreview, (e: Error) => setErr(e.message))
  }, [file, mode, applyDeletions])
  return (
    <Dialog title={tx('Apply the sync file?')} onClose={onClose}>
      <div className="grid gap-3 text-sm">
        <p>{tx('From')} <b>{file.device.deviceName}</b>, {tx('saved {{date}}', { date: file.createdAt.slice(0, 16).replace('T', ' ') })} · {mode === 'merge' ? tx('merge, newest wins') : tx('overwrite this device')}{file.photos ? ` · ${tx('with photos')}` : ''}</p>
        {preview ? <ChangesTable summary={preview.result.summary} /> : !err && <p className="text-muted">{tx('Working out the changes…')}</p>}
        {err && <p className="text-danger" role="alert">{err}</p>}
        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={!preview} onClick={async () => {
            await applySyncFile(appDb, file, preview!)
            await recordSync(appDb, file.device, new Date().toISOString())
            await onApplied()
          }}>{tx('Apply')}</button>
          <button className="btn" onClick={onClose}>{tx('Cancel')}</button>
        </div>
      </div>
    </Dialog>
  )
}
