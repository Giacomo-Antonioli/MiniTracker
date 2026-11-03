/** Record merge for phone ↔ PC sync (#161). Pure: no database access. */

/** Marks a record deleted on one device, so a merge can delete it on the other. */
export interface Tombstone {
  table: string
  id: string
  deletedAt: string
}

export interface MergeSummary {
  added: number
  updated: number
  deleted: number
  kept: number
}

export interface MergeOptions<T> {
  /** Deletion markers of this table, from both devices. */
  tombstones: Tombstone[]
  /** False: deletions from the other device are ignored. */
  applyDeletions: boolean
  key?: (x: T) => string
  /** Field holding the edit time (default updatedAt). */
  stamp?: (x: T) => string | undefined
}

type Stamped = object
const KEEP_DAYS = 90

const idOf = (x: unknown) => (x as { id: string }).id
const defaultStamp = (x: object) => (x as { updatedAt?: string }).updatedAt

/** Newest edit wins per record; on a tie the local copy stays. Summary counts changes to local. */
export function mergeRecords<T extends Stamped>(local: T[], remote: T[], opts: MergeOptions<T>): { records: T[]; summary: MergeSummary } {
  const key = opts.key ?? idOf
  const stamp = (x: T) => (opts.stamp ?? defaultStamp)(x) ?? ''
  const deletedAt = new Map<string, string>()
  if (opts.applyDeletions) {
    for (const t of opts.tombstones) if ((deletedAt.get(t.id) ?? '') < t.deletedAt) deletedAt.set(t.id, t.deletedAt)
  }
  const remoteById = new Map(remote.map((x) => [key(x), x]))
  const summary: MergeSummary = { added: 0, updated: 0, deleted: 0, kept: 0 }
  const records: T[] = []
  const alive = (x: T) => {
    const d = deletedAt.get(key(x))
    return !d || stamp(x) > d
  }

  for (const l of local) {
    const r = remoteById.get(key(l))
    remoteById.delete(key(l))
    const winner = r && stamp(r) > stamp(l) ? r : l
    if (!alive(winner)) {
      summary.deleted++
      continue
    }
    records.push(winner)
    if (winner === l) summary.kept++
    else summary.updated++
  }
  for (const r of remoteById.values()) {
    if (!alive(r)) continue
    records.push(r)
    summary.added++
  }
  return { records, summary }
}

/** What replacing local with remote would change, for the overwrite preview. */
export function diffRecords<T>(local: T[], remote: T[], key: (x: T) => string = idOf): MergeSummary {
  const localById = new Map(local.map((x) => [key(x), x]))
  const summary: MergeSummary = { added: 0, updated: 0, deleted: 0, kept: 0 }
  for (const r of remote) {
    const l = localById.get(key(r))
    localById.delete(key(r))
    if (!l) summary.added++
    else if (JSON.stringify(l) === JSON.stringify(r)) summary.kept++
    else summary.updated++
  }
  summary.deleted = localById.size
  return summary
}

/** Drop markers older than 90 days; keep only the newest marker per record. */
export function pruneTombstones(tombstones: Tombstone[], now: string): Tombstone[] {
  const cutoff = new Date(Date.parse(now) - KEEP_DAYS * 86_400_000).toISOString()
  const newest = new Map<string, Tombstone>()
  for (const t of tombstones) {
    if (t.deletedAt < cutoff) continue
    const k = `${t.table}/${t.id}`
    const prev = newest.get(k)
    if (!prev || prev.deletedAt < t.deletedAt) newest.set(k, t)
  }
  return [...newest.values()]
}
