import { useEffect, useState } from 'react'
import { useStore } from '../../app/store'
import type { PaintScheme } from '../../domain/schemes/types'
import { PhotoThumb } from '../photos/PhotoThumb'
import { PhotoViewer } from '../photos/PhotoViewer'

/** Scheme gallery: add photos, pick the cover. Step photos appear here too. */
export function SchemePhotos({ scheme, cover, onCover }: { scheme: PaintScheme; cover?: string; onCover: (id: string | undefined) => void }) {
  const { photos: all, loadSchemePhotos, addSchemePhotos } = useStore()
  const photos = all[scheme.id] ?? []
  const [open, setOpen] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void loadSchemePhotos(scheme.id)
  }, [scheme.id, loadSchemePhotos])

  return (
    <section className="border-b border-line p-4" aria-label="Scheme photos">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Photos ({photos.length})</h3>
        <label className="btn text-sm">
          + Add
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            aria-label="Add scheme photos"
            onChange={async (e) => {
              const files = [...(e.target.files ?? [])]
              e.target.value = ''
              try {
                setError('')
                const added = await addSchemePhotos(scheme, files)
                if (!cover && added[0]) onCover(added[0].id)
              } catch (err) {
                setError((err as Error).message)
              }
            }}
          />
        </label>
      </div>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      {photos.length === 0 ? (
        <p className="text-sm text-muted">No photos yet. The first one becomes the cover.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {photos.map((p) => (
            <div key={p.id} className="grid justify-items-center gap-1">
              <PhotoThumb photo={p} onClick={() => setOpen(p.id)} />
              <button
                className={`text-xs ${cover === p.id ? 'text-accent' : 'text-muted underline'}`}
                aria-pressed={cover === p.id}
                onClick={() => onCover(cover === p.id ? undefined : p.id)}
              >
                {cover === p.id ? '★ cover' : 'set cover'}
              </button>
            </div>
          ))}
        </div>
      )}
      {open && <PhotoViewer photos={photos} startId={open} onClose={() => setOpen(null)} />}
    </section>
  )
}
