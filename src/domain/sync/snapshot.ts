/** Whole-database merge for sync (#161): tables record by record, settings item by item. Pure. */
import { diffRecords, mergeRecords, pruneTombstones, type MergeSummary, type Tombstone } from './merge'
import { mergeSetting, SYNC_KEYS, type Stamps } from './settingsMerge'

export interface SettingRow {
  key: string
  value: unknown
}

/** One device's data: the synced tables, keyed by table name, plus its settings rows. */
export interface Snapshot {
  tables: Record<string, object[]>
  settings: SettingRow[]
}

/** Key field per synced table. */
export type TableKeys = Record<string, string>

export type SyncMode = 'merge' | 'overwrite'

export interface SyncResult {
  snapshot: Snapshot
  /** Changes to this device, per table and for settings. */
  summary: Record<string, MergeSummary>
  /** Photos this device must receive files for. */
  needPhotos: string[]
}

// Device-only settings: never copied from the other device.
const LOCAL_ONLY = new Set(['deviceId', 'deviceName', 'syncDevices', 'syncPrefs', 'lanCertificate'])

const valueOf = (rows: SettingRow[], key: string) => rows.find((r) => r.key === key)?.value
const stampAt = (x: object) => (x as { syncAt?: string }).syncAt

/**
 * What this device looks like after syncing with `remote`.
 * merge: newest wins per record/item; overwrite: becomes the remote data (device-only settings stay).
 */
export function syncSnapshots(local: Snapshot, remote: Snapshot, keys: TableKeys, opts: { mode: SyncMode; applyDeletions: boolean; now: string }): SyncResult {
  const tombstones = pruneTombstones([...((valueOf(local.settings, 'syncTombstones') as Tombstone[]) ?? []), ...((valueOf(remote.settings, 'syncTombstones') as Tombstone[]) ?? [])], opts.now)
  const summary: Record<string, MergeSummary> = {}
  const tables: Record<string, object[]> = {}

  for (const [name, field] of Object.entries(keys)) {
    const key = (x: object) => String((x as Record<string, unknown>)[field])
    const l = local.tables[name] ?? []
    const r = remote.tables[name] ?? []
    if (opts.mode === 'overwrite') {
      tables[name] = r
      summary[name] = diffRecords(l, r, key)
    } else {
      const out = mergeRecords(l, r, { key, stamp: stampAt, tombstones: tombstones.filter((t) => t.table === name), applyDeletions: opts.applyDeletions })
      tables[name] = out.records
      summary[name] = out.summary
    }
  }

  const settings = opts.mode === 'overwrite' ? overwriteSettings(local.settings, remote.settings) : mergeSettings(local.settings, remote.settings, tombstones, opts.applyDeletions)
  summary.settings = settings.summary
  if (opts.mode === 'merge') settings.rows.push({ key: 'syncTombstones', value: tombstones })

  const localPhotos = new Set((local.tables.photos ?? []).map((p) => (p as { id: string }).id))
  const needPhotos = (tables.photos ?? []).map((p) => (p as { id: string }).id).filter((id) => !localPhotos.has(id))
  return { snapshot: { tables, settings: settings.rows.sort((a, b) => a.key.localeCompare(b.key)) }, summary, needPhotos }
}

function overwriteSettings(local: SettingRow[], remote: SettingRow[]) {
  const rows = [...remote.filter((r) => !LOCAL_ONLY.has(r.key)), ...local.filter((r) => LOCAL_ONLY.has(r.key))]
  const shared = (list: SettingRow[]) => list.filter((r) => !SYNC_KEYS.has(r.key))
  return { rows, summary: diffRecords(shared(local), shared(remote), (r) => r.key) }
}

function mergeSettings(local: SettingRow[], remote: SettingRow[], tombstones: Tombstone[], applyDeletions: boolean) {
  const stamps = { local: (valueOf(local, 'syncStamps') as Stamps) ?? {}, remote: (valueOf(remote, 'syncStamps') as Stamps) ?? {} }
  const summary: MergeSummary = { added: 0, updated: 0, deleted: 0, kept: 0 }
  const rows: SettingRow[] = local.filter((r) => LOCAL_ONLY.has(r.key))
  const keys = new Set([...local, ...remote].map((r) => r.key).filter((k) => !SYNC_KEYS.has(k)))
  for (const key of keys) {
    const out = mergeSetting(key, valueOf(local, key), valueOf(remote, key), stamps, { tombstones, applyDeletions })
    for (const k of Object.keys(summary) as (keyof MergeSummary)[]) summary[k] += out.summary[k]
    if (out.value !== undefined) rows.push({ key, value: out.value })
  }
  // Keep the newest edit time of every item, so later merges still compare correctly.
  const merged: Stamps = { ...stamps.local }
  for (const [p, t] of Object.entries(stamps.remote)) if ((merged[p] ?? '') < t) merged[p] = t
  rows.push({ key: 'syncStamps', value: merged })
  return { rows, summary }
}
