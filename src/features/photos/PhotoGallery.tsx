import { useState } from 'react'
import { useStore } from '../../app/store'
import type { OwnedUnit, StatusEvent } from '../../domain/collection/types'
import { photoTimeline } from '../../domain/photos/timeline'
import { stageColour } from '../backlog/BacklogTable'
import type { Photo } from '../../domain/photos/types'
import { useTx } from '../../i18n'
import { PhotoThumb } from './PhotoThumb'
import { PhotoViewer } from './PhotoViewer'

/** Unit gallery: all photos of the unit (own and from history steps). */
export function PhotoGallery({ unit, photos, thumbSize, events = [] }: { unit: OwnedUnit; photos: Photo[]; thumbSize?: string; events?: StatusEvent[] }) {
  const tx = useTx()
  const addPhotos = useStore((s) => s.addPhotos)
  const pipeline = useStore((s) => s.pipeline)
  const [view, setView] = useState<'grid' | 'timeline'>(() => {
    try {
      return localStorage.getItem('photos.view') === 'timeline' ? 'timeline' : 'grid'
    } catch {
      return 'grid'
    }
  })
  const pick = (v: 'grid' | 'timeline') => {
    setView(v)
    try {
      localStorage.setItem('photos.view', v)
    } catch {
      // Not remembered: the grid shows next time.
    }
  }
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
    <section className="border-b border-line p-4" aria-label={tx('Photos')}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{tx('Photos ({{n}})', { n: photos.length })}</h3>
        <div className="flex gap-1">
          {photos.length > 1 && (
            <div className="flex overflow-hidden rounded border border-line text-sm" role="group" aria-label={tx('Photo view')}>
              {(['grid', 'timeline'] as const).map((v) => (
                <button key={v} aria-pressed={view === v} className={`px-2 ${view === v ? 'bg-accent text-accent-fg' : 'hover:bg-panel-2'}`} onClick={() => pick(v)}>{v === 'grid' ? tx('Grid') : tx('Timeline')}</button>
              ))}
            </div>
          )}
          <label className={`btn text-sm ${busy ? 'pointer-events-none opacity-50' : ''}`}>
            {tx('+ Add')}
            <input type="file" accept="image/*" multiple className="sr-only" aria-label={tx('Add photos')} onChange={(e) => { void add(e.target.files); e.target.value = '' }} />
          </label>
          <label className={`btn text-sm ${busy ? 'pointer-events-none opacity-50' : ''}`} title={tx('Take a photo (phone/tablet)')}>
            📷
            <input type="file" accept="image/*" capture="environment" className="sr-only" aria-label={tx('Take photo')} onChange={(e) => { void add(e.target.files); e.target.value = '' }} />
          </label>
        </div>
      </div>
      {busy && <p className="text-sm text-muted" role="status">{tx('Saving photos…')}</p>}
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      {photos.length === 0 ? (
        <p className="text-sm text-muted">{tx('No photos yet.')}</p>
      ) : view === 'timeline' && photos.length > 1 ? (
        <ol className="flex gap-4 overflow-x-auto pb-2" aria-label={tx('Photo timeline')}>
          {photoTimeline(photos, events).map(({ photo, stageId }, i) => {
            const stage = pipeline.stages.find((x) => x.id === stageId)
            return (
              <li key={photo.id} className="relative grid shrink-0 justify-items-center gap-1 text-xs">
                {i > 0 && <span className="absolute -left-4 top-[calc(50%-1px)] h-0.5 w-4 bg-line" aria-hidden />}
                <span className="text-muted">{new Date(photo.takenAt).toLocaleDateString()}</span>
                <PhotoThumb photo={photo} size={thumbSize} onClick={() => setOpen(photo.id)} />
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: stageId ? stageColour(pipeline, stageId) : 'var(--muted)' }} />
                  {stage?.name ?? tx('Before tracking')}
                </span>
              </li>
            )
          })}
        </ol>
      ) : (
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => <PhotoThumb key={p.id} photo={p} size={thumbSize} onClick={() => setOpen(p.id)} />)}
        </div>
      )}
      {open && <PhotoViewer photos={photos} startId={open} onClose={() => setOpen(null)} />}
    </section>
  )
}
