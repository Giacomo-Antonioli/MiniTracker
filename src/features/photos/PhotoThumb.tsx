import type { Photo } from '../../domain/photos/types'
import { useTx } from '../../i18n'
import { usePhotoUrl } from './usePhotoUrl'

export function PhotoThumb({ photo, onClick, size = 'h-20 w-20' }: { photo: Photo; onClick: () => void; size?: string }) {
  const tx = useTx()
  const url = usePhotoUrl(photo.id)
  return (
    <button className={`${size} shrink-0 overflow-hidden rounded border border-line bg-panel-2 hover:border-accent`} onClick={onClick} aria-label={tx('Open photo {{name}}', { name: photo.fileName })}>
      {url && <img src={url} alt={photo.caption || photo.fileName} className="h-full w-full object-cover" />}
    </button>
  )
}
