import { useEffect, useState } from 'react'
import { useStore } from '../../app/store'
import type { Photo } from '../../domain/photos/types'
import { useTx } from '../../i18n'
import { Dialog } from '../../ui/Dialog'
import { usePhotoUrl } from './usePhotoUrl'

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(b < 1024 * 1024 ? 2 : 1)} MB`

/** Full-size viewer with next/previous, caption, original download and delete. */
export function PhotoViewer({ photos, startId, onClose }: { photos: Photo[]; startId: string; onClose: () => void }) {
  const tx = useTx()
  const { photoFiles, updatePhoto, deletePhoto } = useStore()
  const [index, setIndex] = useState(Math.max(0, photos.findIndex((p) => p.id === startId)))
  const photo = photos[Math.min(index, photos.length - 1)]
  const url = usePhotoUrl(photo?.id)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, photos.length - 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [photos.length])

  if (!photo) return null

  async function download() {
    const f = await photoFiles(photo.id)
    if (!f) return
    const blob = f.original ?? f.display
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = f.original ? photo.fileName : photo.fileName.replace(/\.[^.]+$/, blob.type === 'image/webp' ? '.webp' : '.jpg')
    a.click()
    URL.revokeObjectURL(href)
  }

  return (
    <Dialog title={tx('Photo {{n}} of {{total}}', { n: index + 1, total: photos.length })} onClose={onClose} wide>
      <div className="grid gap-3">
        <div className="relative flex min-h-64 items-center justify-center bg-black/40">
          {url && <img src={url} alt={photo.caption || photo.fileName} className="max-h-[60vh] max-w-full object-contain" />}
          <button className="btn absolute left-2" aria-label={tx('Previous photo')} disabled={index === 0} onClick={() => setIndex(index - 1)}>‹</button>
          <button className="btn absolute right-2" aria-label={tx('Next photo')} disabled={index >= photos.length - 1} onClick={() => setIndex(index + 1)}>›</button>
        </div>
        <input
          key={photo.id}
          className="input"
          aria-label={tx('Caption')}
          placeholder={tx('Add a caption')}
          defaultValue={photo.caption}
          onBlur={(e) => e.target.value !== photo.caption && void updatePhoto({ ...photo, caption: e.target.value })}
        />
        <p className="break-all text-xs text-muted">
          {photo.fileName} · {new Date(photo.takenAt).toLocaleDateString()} · {tx('shown {{w}}×{{h}} ({{size}})', { w: photo.width, h: photo.height, size: mb(photo.displayBytes) })} ·{' '}
          {photo.hasOriginal ? tx('original {{size}}', { size: mb(photo.originalBytes) }) : tx('original removed')}
        </p>
        <div className="flex flex-wrap justify-between gap-2">
          <button className="btn btn-primary" onClick={() => void download()}>⬇ {photo.hasOriginal ? tx('Download original') : tx('Download')}</button>
          <button
            className="btn btn-danger"
            onClick={() => {
              if (!confirm(tx('Delete this photo?'))) return
              void deletePhoto(photo).then(() => (photos.length <= 1 ? onClose() : setIndex(Math.max(0, index - 1))))
            }}
          >
            {tx('Delete')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
