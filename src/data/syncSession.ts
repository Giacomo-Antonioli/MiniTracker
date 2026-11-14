/**
 * One sync between two devices over a Channel (#161).
 * The device that starts proposes a plan; the other accepts or declines. Each receiving side
 * merges (or overwrites), previews the changes, fetches missing photo files, then applies.
 */
import type { MergeSummary } from '../domain/sync/merge'
import { clockSkewSeconds, PROTOCOL_VERSION, Reassembler, toPieces, type Hello, type Piece } from '../domain/sync/protocol'
import { syncSnapshots, type Snapshot, type SyncMode } from '../domain/sync/snapshot'
import type { PhotoFiles } from '../domain/photos/types'
import type { MiniTrackerDb } from './db'
import { PIECE_SIZE, type Channel } from './syncChannel'
import { catalogueFromWire, catalogueInfos, catalogueToWire, wantedCatalogues, type CatalogueInfo } from './syncCatalogues'
import { applySnapshot, readSnapshot } from './syncSnapshot'
import { SYNCED_TABLES } from './syncTracking'

export type Direction = 'send' | 'receive' | 'both'

const HELLO_RETRY_MS = 2000
const HELLO_GIVE_UP_MS = 30_000

export interface SyncPlan {
  mode: SyncMode
  /** Seen from the device that starts. */
  direction: Direction
  applyDeletions: boolean
  photos: boolean
  /** Also copy game catalogues; only used when both devices support it. */
  catalogues?: boolean
}

type Msg =
  | (Hello & { seen?: boolean })
  | { type: 'plan'; plan: SyncPlan }
  | { type: 'accept' }
  | { type: 'decline'; reason: string }
  | { type: 'piece'; piece: Piece }
  | { type: 'want'; ids: string[] }
  | { type: 'cats'; list: CatalogueInfo[] }
  | { type: 'wantCats'; ids: string[] }
  | { type: 'done' }

export interface SessionHooks {
  /** The other device said hello; skew = seconds its clock is ahead of ours. */
  onHello?(other: Hello, skew: number): void
  /** Responder only: accept the other device's plan? */
  confirmPlan?(plan: SyncPlan, other: Hello): Promise<boolean>
  /** Receiving side: apply these changes? */
  confirmChanges(summary: Record<string, MergeSummary>): Promise<boolean>
  onProgress?(text: string, have: number, total: number): void
}

export interface SessionResult {
  applied: boolean
  summary?: Record<string, MergeSummary>
  other?: Hello
}

/** Flip a plan's direction to the responder's point of view. */
const flip = (d: Direction): Direction => (d === 'send' ? 'receive' : d === 'receive' ? 'send' : 'both')

export async function runSync(
  db: MiniTrackerDb,
  channel: Channel,
  me: { deviceId: string; deviceName: string },
  role: { starts: true; plan: SyncPlan } | { starts: false },
  hooks: SessionHooks,
  now: () => string = () => new Date().toISOString(),
): Promise<SessionResult> {
  const inbox: Msg[] = []
  const waiters: (() => void)[] = []
  let closed = false
  let gotTheirs: Hello | undefined
  let theyHaveMine = false
  let gotIt!: (h: Hello) => void
  let noHello!: (e: Error) => void
  let gotConfirm!: () => void
  let finish!: () => void
  const theirHello = new Promise<Hello>((r, j) => ((gotIt = r), (noHello = j)))
  const confirmed = new Promise<void>((r) => (gotConfirm = r))
  const finished = new Promise<void>((r) => (finish = r))
  const sendHello = () => {
    try {
      send({ type: 'hello', protocol: PROTOCOL_VERSION, ...me, clock: now(), features: ['catalogues'], seen: !!gotTheirs })
    } catch {
      // the connection is gone; the close handler ends the sync
    }
  }
  channel.onMessage((t) => {
    const m = JSON.parse(t) as Msg
    if (m.type === 'hello') {
      if (!gotTheirs) (gotTheirs = m), gotIt(m)
      if (m.seen) (theyHaveMine = true), gotConfirm()
      else sendHello() // they don't have ours yet (or lost it): answer
      return
    }
    inbox.push(m)
    waiters.splice(0).forEach((w) => w())
  })
  channel.onClose(() => {
    closed = true
    finish()
    if (!gotTheirs) noHello(new Error('The other device disconnected'))
    waiters.splice(0).forEach((w) => w())
  })
  const send = (m: Msg) => channel.send(JSON.stringify(m))
  async function next<T extends Msg['type']>(...types: T[]): Promise<Extract<Msg, { type: T }>> {
    for (;;) {
      const i = inbox.findIndex((m) => (types as string[]).includes(m.type) || m.type === 'decline')
      if (i >= 0) {
        const m = inbox.splice(i, 1)[0]
        if (m.type === 'decline' && !(types as string[]).includes('decline')) throw new Error(m.reason)
        return m as Extract<Msg, { type: T }>
      }
      if (closed) throw new Error('The other device disconnected')
      await new Promise<void>((r) => waiters.push(r))
    }
  }
  /** Send a long text as pieces; the receiver reassembles by id. */
  const sendLong = (id: string, text: string) => toPieces(id, text, PIECE_SIZE).forEach((piece) => send({ type: 'piece', piece }))
  async function receiveLong(id: string, label: string): Promise<string> {
    const r = new Reassembler()
    for (;;) {
      const m = await next('piece')
      if (m.piece.id !== id) {
        inbox.push(m) // someone else's piece: leave it for later
        await new Promise<void>((res) => setTimeout(res, 0))
        continue
      }
      const out = r.add(m.piece)
      hooks.onProgress?.(label, r.progress.have, r.progress.total)
      if (out !== undefined) return out
    }
  }

  // 1. Hello both ways, handled as they arrive (see onMessage). Each hello says whether we have
  // theirs; we repeat ours until they confirm, in case one is lost while the connection settles.
  const again = setInterval(() => !theyHaveMine && sendHello(), HELLO_RETRY_MS)
  sendHello()
  let other: Hello
  try {
    other = await theirHello
  } finally {
    // keep repeating in the background only until they confirm
    const stop = () => clearInterval(again)
    if (theyHaveMine) stop()
    else void confirmed.then(stop)
    void finished.then(stop)
    setTimeout(stop, HELLO_GIVE_UP_MS) // never repeat forever, even if the sync fails later
  }

  if (other.protocol !== PROTOCOL_VERSION) {
    send({ type: 'decline', reason: 'The two devices run different MiniTracker versions; update both' })
    throw new Error('The two devices run different MiniTracker versions; update both')
  }
  hooks.onHello?.(other, clockSkewSeconds(other, now()))

  // 2. Agree on a plan.
  let plan: SyncPlan
  if (role.starts) {
    plan = role.plan
    send({ type: 'plan', plan })
    await next('accept')
  } else {
    const p = (await next('plan')).plan
    plan = { ...p, direction: flip(p.direction) }
    if (!(await (hooks.confirmPlan?.(plan, other) ?? Promise.resolve(true)))) {
      send({ type: 'decline', reason: `${me.deviceName} declined the sync` })
      finish()
      return { applied: false, other }
    }
    send({ type: 'accept' })
  }
  if (plan.direction === 'both' && plan.mode !== 'merge') throw new Error('Syncing both ways needs merge')

  // 3. Exchange data.
  // The catalogue step only happens when both devices know it (an older one never says so in its hello).
  const cats = !!plan.catalogues && !!other.features?.includes('catalogues')
  const sends = plan.direction !== 'receive'
  const receives = plan.direction !== 'send'
  const mine = await readSnapshot(db)
  if (sends) sendLong('snapshot', JSON.stringify(mine))
  if (sends && cats) send({ type: 'cats', list: catalogueInfos(await db.catalogues.toArray()) })
  const theirs = receives ? (JSON.parse(await receiveLong('snapshot', 'Receiving data')) as Snapshot) : undefined

  // 4. Answer photo requests from the other side while we work.
  const serving = sends && plan.photos ? servePhotos(db, next, sendLong) : Promise.resolve()
  const servingCats = sends && cats ? serveCatalogues(db, next, sendLong) : Promise.resolve()

  let result: SessionResult = { applied: false, other }
  if (theirs) {
    const out = syncSnapshots(mine, theirs, SYNCED_TABLES, { mode: plan.mode, applyDeletions: plan.applyDeletions, now: now() })
    const ok = await hooks.confirmChanges(out.summary)
    const ids = ok && plan.photos ? out.needPhotos : []
    if (plan.photos) send({ type: 'want', ids })
    const files: PhotoFiles[] = []
    for (const [i, id] of ids.entries()) {
      hooks.onProgress?.('Receiving photos', i, ids.length)
      files.push(await fromWire(JSON.parse(await receiveLong(`photo:${id}`, 'Receiving photos')) as WirePhoto))
    }
    // Without photos, keep only photo records whose files are already here.
    const snapshot = ok && !plan.photos ? withoutMissingPhotos(out.snapshot, mine) : out.snapshot
    if (ok) await applySnapshot(db, snapshot, files)
    if (cats) {
      const offered = (await next('cats')).list
      const want = ok ? wantedCatalogues(offered, catalogueInfos(await db.catalogues.toArray())) : []
      send({ type: 'wantCats', ids: want })
      for (const [i, id] of want.entries()) {
        hooks.onProgress?.('Receiving catalogues', i, want.length)
        for (const c of await catalogueFromWire(await receiveLong(`catalogue:${id}`, 'Receiving catalogues'))) await db.catalogues.put(c)
      }
    }
    result = { applied: ok, summary: out.summary, other }
  }
  await serving
  await servingCats
  send({ type: 'done' })
  await next('done')
  finish()
  channel.close()
  return result
}

export function withoutMissingPhotos(s: Snapshot, mine: Snapshot): Snapshot {
  const have = new Set((mine.tables.photos ?? []).map((p) => (p as { id: string }).id))
  return { ...s, tables: { ...s.tables, photos: (s.tables.photos ?? []).filter((p) => have.has((p as { id: string }).id)) } }
}

async function servePhotos(db: MiniTrackerDb, next: (t: 'want') => Promise<{ type: 'want'; ids: string[] }>, sendLong: (id: string, text: string) => void) {
  const { ids } = await next('want')
  for (const id of ids) {
    const f = await db.photoFiles.get(id)
    if (f) sendLong(`photo:${id}`, JSON.stringify(await toWire(f)))
  }
}

async function serveCatalogues(db: MiniTrackerDb, next: (t: 'wantCats') => Promise<{ type: 'wantCats'; ids: string[] }>, sendLong: (id: string, text: string) => void) {
  const { ids } = await next('wantCats')
  for (const id of ids) {
    const wire = await catalogueToWire(db, id)
    if (wire) sendLong(`catalogue:${id}`, wire)
  }
}

export interface WirePhoto {
  id: string
  display: string
  displayType: string
  original?: string
  originalType?: string
}

async function toBase64(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer())
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
const fromBase64 = (s: string, type: string) => new Blob([Uint8Array.from(atob(s), (c) => c.charCodeAt(0))], { type })

export async function toWire(f: PhotoFiles): Promise<WirePhoto> {
  return {
    id: f.id,
    display: await toBase64(f.display),
    displayType: f.display.type,
    ...(f.original ? { original: await toBase64(f.original), originalType: f.original.type } : {}),
  }
}
export const fromWire = (w: WirePhoto): PhotoFiles => ({
  id: w.id,
  display: fromBase64(w.display, w.displayType),
  ...(w.original ? { original: fromBase64(w.original, w.originalType ?? '') } : {}),
})
