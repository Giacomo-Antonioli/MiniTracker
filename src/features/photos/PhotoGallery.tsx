import { useState } from 'react'
import { useStore } from '../../app/store'
import type { OwnedUnit } from '../../domain/collection/types'
import type { Photo } from '../../domain/photos/types'
import { PhotoThumb } from './PhotoThumb'
import { PhotoViewer } from './PhotoViewer'

/** Unit gallery: all photos of the unit (own and from history steps). */
export function PhotoGallery({ unit, photos }: { unit: OwnedUnit; photos: Photo[] }) {
  const addPhotos = useStore((s) => s.addPhotos)
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function add(list: FileList | null) {
    const files = [...(list ?? [])]
    if (!files.length) return
    setBusy(true)
    setError('')
    try {
      await addPhotos(unit, files)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="border-b border-line p-4" aria-label="Photos">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Photos ({photos.length})</h3>
        <div className="flex gap-1">
          <label className={`btn text-sm ${busy ? 'pointer-events-none opacity-50' : ''}`}>
            + Add
            <input type="file" accept="image/*" multiple className="sr-only" aria-label="Add photos" onChange={(e) => { void add(e.target.files); e.target.value = '' }} />
          </label>
          <label className={`btn text-sm ${busy ? 'pointer-events-none opacity-50' : ''}`} title="Take a photo (phone/tablet)">
            📷
            <input type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Take photo" onChange={(e) => { void add(e.target.files); e.target.value = '' }} />
          </label>
        </div>
      </div>
      {busy && <p className="text-sm text-muted" role="status">Saving photos…</p>}
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      {photos.length === 0 ? (
        <p className="text-sm text-muted">No photos yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => <PhotoThumb key={p.id} photo={p} onClick={() => setOpen(p.id)} />)}
        </div>
      )}
      {open && <PhotoViewer photos={photos} startId={open} onClose={() => setOpen(null)} />}
    </section>
  )
}
