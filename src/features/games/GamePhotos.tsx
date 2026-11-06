import { useEffect, useState } from 'react'
import { useStore } from '../../app/store'
import type { Game } from '../../domain/games/games'
import { PhotoThumb } from '../photos/PhotoThumb'
import { PhotoViewer } from '../photos/PhotoViewer'

/** Photos of a game (#164): the table, the armies, the final position. */
export function GamePhotos({ game }: { game: Game }) {
  const { photos: all, loadGamePhotos, addGamePhotos } = useStore()
  const photos = all[game.id] ?? []
  const [open, setOpen] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void loadGamePhotos(game.id)
  }, [game.id, loadGamePhotos])

  return (
    <section className="grid gap-2" aria-label="Game photos">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Photos ({photos.length})</h3>
        <label className="btn px-2 py-0.5 text-sm">
          📷 Add
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            aria-label="Add game photos"
            onChange={async (e) => {
              const files = [...(e.target.files ?? [])]
              e.target.value = ''
              try {
                setError('')
                await addGamePhotos(game, files)
              } catch (err) {
                setError((err as Error).message)
              }
            }}
          />
        </label>
      </div>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {photos.map((p) => <PhotoThumb key={p.id} photo={p} onClick={() => setOpen(p.id)} />)}
        </div>
      )}
      {open && <PhotoViewer photos={photos} startId={open} onClose={() => setOpen(null)} />}
    </section>
  )
}
