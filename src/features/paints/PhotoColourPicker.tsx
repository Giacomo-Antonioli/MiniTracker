import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { averageHex } from '../../domain/paints/colour'
import { useTx } from '../../i18n'

const MAX_SIDE = 900
/** Pixels each side of the tapped one that are averaged, to smooth out noise and highlights. */
const RADIUS = 3

/** Choose a picture and tap a spot to take its colour. The picture stays in this window and is not saved. */
export function PhotoColourPicker({ onPick }: { onPick: (hex: string) => void }) {
  const tx = useTx()
  const canvas = useRef<HTMLCanvasElement>(null)
  const [file, setFile] = useState<File>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!file) return
    const done = new AbortController()
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const c = canvas.current
      if (done.signal.aborted || !c) return
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height))
      c.width = Math.max(1, Math.round(img.width * scale))
      c.height = Math.max(1, Math.round(img.height * scale))
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height)
    }
    img.onerror = () => !done.signal.aborted && setFailed(true)
    img.src = url
    return () => {
      done.abort()
      URL.revokeObjectURL(url)
    }
  }, [file])

  function sample(e: MouseEvent<HTMLCanvasElement>) {
    const c = e.currentTarget
    const box = c.getBoundingClientRect()
    const x = Math.floor(((e.clientX - box.left) / box.width) * c.width)
    const y = Math.floor(((e.clientY - box.top) / box.height) * c.height)
    const left = Math.max(0, x - RADIUS)
    const top = Math.max(0, y - RADIUS)
    const data = c.getContext('2d')?.getImageData(left, top, Math.min(c.width, x + RADIUS + 1) - left, Math.min(c.height, y + RADIUS + 1) - top).data
    const hex = data && averageHex(data)
    if (hex) onPick(hex)
  }

  return (
    <div className="grid gap-2">
      <label className="btn w-fit">
        {tx('📷 From a photo…')}
        <input
          type="file"
          accept="image/*"
          aria-label={tx('Photo to take a colour from')}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            setFailed(false)
            setFile(f)
          }}
        />
      </label>
      {failed && <p role="status" className="text-sm text-danger">{tx('This picture cannot be opened here. Try a JPEG or PNG.')}</p>}
      {file && !failed && (
        <>
          <p className="text-sm text-muted">{tx('Tap a spot to take its colour. Light and camera change colours, so treat the result as a guide.')}</p>
          <canvas ref={canvas} role="img" aria-label={tx('Photo')} onClick={sample} className="max-h-[45dvh] max-w-full cursor-crosshair justify-self-center rounded border border-line" />
        </>
      )}
    </div>
  )
}
