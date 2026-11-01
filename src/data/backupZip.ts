import { Unzip, UnzipInflate, Zip, ZipDeflate, ZipPassThrough, strFromU8, strToU8 } from 'fflate'
import type { Photo } from '../domain/photos/types'

/**
 * Backup zip layout:
 *   backup.json                      all data + photo list (deflated)
 *   photos/shown/<name>.webp|jpg     compressed copies (always)
 *   photos/original/<fileName>       originals (full backups only)
 * Images are stored as-is (already compressed), so writing is fast and nothing is wasted.
 */

export interface PhotoEntry {
  photo: Photo
  display: Blob
  original?: Blob
}

/** Where each photo's files are inside the zip (saved in backup.json). */
export interface PhotoFileRef {
  id: string
  shown: string
  original?: string
}

const shownExt = (type: string) => (type === 'image/webp' ? 'webp' : type === 'image/png' ? 'png' : 'jpg')
export const shownPath = (p: Photo, displayType: string) => `photos/shown/${p.fileName.replace(/\.[^.]+$/, '')}.${shownExt(displayType)}`
export const originalPath = (p: Photo) => `photos/original/${p.fileName}`

/**
 * Builds the zip one photo at a time (`entries` can be lazy), so only one image is in memory at once
 * besides the finished zip chunks. `makeJson` receives the file refs and returns backup.json's text.
 */
export async function buildBackupZip(
  entries: AsyncIterable<PhotoEntry> | Iterable<PhotoEntry>,
  makeJson: (refs: PhotoFileRef[]) => string,
  includeOriginals: boolean,
): Promise<Blob> {
  const chunks: Uint8Array[] = []
  let failure: Error | null = null
  let finished!: () => void
  const done = new Promise<void>((r) => (finished = r))
  const zip = new Zip((err, chunk, final) => {
    if (err) failure = err
    else chunks.push(chunk)
    if (final || err) finished()
  })
  const add = async (path: string, blob: Blob) => {
    const f = new ZipPassThrough(path)
    zip.add(f)
    f.push(new Uint8Array(await blob.arrayBuffer()), true)
  }

  const refs: PhotoFileRef[] = []
  for await (const e of entries) {
    const ref: PhotoFileRef = { id: e.photo.id, shown: shownPath(e.photo, e.display.type) }
    await add(ref.shown, e.display)
    if (includeOriginals && e.original) {
      ref.original = originalPath(e.photo)
      await add(ref.original, e.original)
    }
    refs.push(ref)
  }
  const json = new ZipDeflate('backup.json', { level: 9 })
  zip.add(json)
  json.push(strToU8(makeJson(refs)), true)
  zip.end()
  await done
  if (failure) throw failure
  return new Blob(chunks as BlobPart[], { type: 'application/zip' })
}

/** True if the file starts like a zip ("PK"). */
export async function isZip(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer())
  return head[0] === 0x50 && head[1] === 0x4b
}

/** Reads a backup zip by streaming it: returns backup.json's text and every other file as a Blob. */
export async function readBackupZip(file: Blob): Promise<{ json: string; files: Map<string, Blob> }> {
  const parts = new Map<string, Uint8Array[]>()
  const pending: Promise<void>[] = []
  const unzip = new Unzip((entry) => {
    const list: Uint8Array[] = []
    parts.set(entry.name, list)
    pending.push(
      new Promise((resolve, reject) => {
        entry.ondata = (err, data, final) => {
          if (err) return reject(err)
          list.push(data)
          if (final) resolve()
        }
      }),
    )
    entry.start()
  })
  unzip.register(UnzipInflate)
  const reader = file.stream().getReader()
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    unzip.push(value)
  }
  unzip.push(new Uint8Array(0), true)
  await Promise.all(pending)

  const jsonParts = parts.get('backup.json')
  if (!jsonParts) throw new Error('This zip is not a MiniTracker backup (backup.json is missing)')
  const json = strFromU8(concat(jsonParts))
  const files = new Map<string, Blob>()
  for (const [name, list] of parts) if (name !== 'backup.json') files.set(name, new Blob(list as BlobPart[], { type: typeOf(name) }))
  return { json, files }
}

function concat(list: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(list.reduce((n, c) => n + c.length, 0))
  let o = 0
  for (const c of list) {
    out.set(c, o)
    o += c.length
  }
  return out
}

function typeOf(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  return ({ webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', gif: 'image/gif' } as Record<string, string>)[ext ?? ''] ?? 'application/octet-stream'
}
