import jsQR from 'jsqr'
import QRCode from 'qrcode'
import { useCallback, useEffect, useRef, useState } from 'react'
import { appDb } from '../../app/store'
import { pieceFromText, Reassembler } from '../../domain/sync/protocol'
import { carouselFrames, FRAME_SIZES, packSyncFile, unpackSyncFile, type FrameSize } from '../../data/syncCarousel'
import type { Device } from '../../data/syncDevice'
import { makeSyncFile, type SyncFile } from '../../data/syncFile'
import { useTx } from '../../i18n'
import { Dialog } from '../../ui/Dialog'

const SPEEDS = { slow: 2, normal: 4, fast: 7 } as const
type Speed = keyof typeof SPEEDS

/** Shows this device's data (no photos) as a looping QR sequence. */
export function QrSender({ me, onClose }: { me: Device; onClose: () => void }) {
  const tx = useTx()
  const pack = useCallback(async () => packSyncFile(await makeSyncFile(appDb, me, { photos: false })), [me])
  return <QrLoop title={tx('QR carousel: send')} intro={tx('On the other device open Sync › QR carousel › Read, and point its camera at this screen. Keep going until it says it has everything. Photos are not included.')} pack={pack} onClose={onClose} />
}

/** Any packed data (see packText) as a looping QR sequence: a sync, or an army list (#193). */
export function QrLoop({ title, intro, pack, onClose }: { title: string; intro: string; pack: () => Promise<string>; onClose: () => void }) {
  const tx = useTx()
  const [size, setSize] = useState<FrameSize>('medium')
  const [speed, setSpeed] = useState<Speed>('normal')
  const [frames, setFrames] = useState<string[]>()
  const [i, setI] = useState(0)
  const [svg, setSvg] = useState('')
  const cache = useRef(new Map<number, string>())

  useEffect(() => {
    let live = true
    void (async () => {
      const packed = await pack()
      if (!live) return
      cache.current.clear()
      setFrames(carouselFrames(packed, size))
      setI(0)
    })()
    return () => {
      live = false
    }
  }, [pack, size])
  useEffect(() => {
    if (!frames) return
    const t = setInterval(() => setI((n) => (n + 1) % frames.length), 1000 / SPEEDS[speed])
    return () => clearInterval(t)
  }, [frames, speed])
  useEffect(() => {
    if (!frames) return
    const hit = cache.current.get(i)
    if (hit) return setSvg(hit)
    void QRCode.toString(frames[i], { type: 'svg', margin: 2, errorCorrectionLevel: 'L' }).then((s) => {
      cache.current.set(i, s)
      setSvg(s)
    })
  }, [frames, i])

  const secs = frames ? Math.ceil(frames.length / SPEEDS[speed]) : 0
  return (
    <Dialog title={title} onClose={onClose} wide>
      <div className="grid justify-items-center gap-2 text-sm">
        <p className="text-center text-muted">{intro}</p>
        <div className="aspect-square w-full max-w-[min(80vw,60dvh)] rounded bg-white p-2" aria-label={tx('QR frame')} dangerouslySetInnerHTML={{ __html: svg }} />
        <p role="status">{frames ? tx('Frame {{n}} of {{total}} · one loop ≈ {{secs}} s', { n: i + 1, total: frames.length, secs }) : tx('Preparing…')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1">{tx('QR size')}
            <select className="input" aria-label={tx('QR size')} value={size} onChange={(e) => setSize(e.target.value as FrameSize)}>
              {(Object.keys(FRAME_SIZES) as FrameSize[]).map((k) => <option key={k} value={k}>{k === 'small' ? tx('Simple (easier to read)') : k === 'medium' ? tx('Medium') : tx('Dense (fewer frames)')}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1">{tx('Speed')}
            <select className="input" aria-label={tx('Speed')} value={speed} onChange={(e) => setSpeed(e.target.value as Speed)}>
              {(Object.keys(SPEEDS) as Speed[]).map((k) => <option key={k} value={k}>{k === 'slow' ? tx('slow ({{n}}/s)', { n: SPEEDS[k] }) : k === 'normal' ? tx('normal ({{n}}/s)', { n: SPEEDS[k] }) : tx('fast ({{n}}/s)', { n: SPEEDS[k] })}</option>)}
            </select>
          </label>
        </div>
        <p className="text-xs text-muted">{tx("If the other device misses frames, choose Simple or slow down. Turn up this screen's brightness.")}</p>
      </div>
    </Dialog>
  )
}

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> }
const nativeDetector = (): Detector | undefined => {
  const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector
  try {
    return BD ? new BD({ formats: ['qr_code'] }) : undefined
  } catch {
    return undefined
  }
}

/** Reads a QR carousel with the camera until every frame arrived; then hands over the sync file. */
export function QrReceiver({ onFile, onClose }: { onFile: (f: SyncFile) => void; onClose: () => void }) {
  const tx = useTx()
  return <QrRead title={tx('QR carousel: read')} hint={tx('Point the camera at the QR carousel on the other device.')} read={async (t) => onFile(await unpackSyncFile(t))} onClose={onClose} />
}

/** Reads any QR carousel; `read` gets the packed text and may throw to show an error (#193). */
export function QrRead({ title, hint, read: use, onClose }: { title: string; hint: string; read: (packed: string) => Promise<void>; onClose: () => void }) {
  const tx = useTx()
  const video = useRef<HTMLVideoElement>(null)
  const [have, setHave] = useState({ have: 0, total: 0 })
  const [err, setErr] = useState('')
  const done = useRef(use)
  done.current = use
  useEffect(() => {
    let stop = false
    let stream: MediaStream | undefined
    const r = new Reassembler()
    const detector = nativeDetector()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const read = async (v: HTMLVideoElement): Promise<string | undefined> => {
      if (detector) return (await detector.detect(v).catch(() => []))[0]?.rawValue
      const scale = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight))
      canvas.width = Math.round(v.videoWidth * scale)
      canvas.height = Math.round(v.videoHeight * scale)
      ctx!.drawImage(v, 0, 0, canvas.width, canvas.height)
      const img = ctx!.getImageData(0, 0, canvas.width, canvas.height)
      return jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data
    }
    const tick = async () => {
      const v = video.current
      if (stop || !v) return
      if (v.readyState >= 2 && v.videoWidth) {
        const text = await read(v)
        const piece = text ? pieceFromText(text) : undefined
        if (piece) {
          const out = r.add(piece)
          setHave(r.progress)
          if (out !== undefined) {
            stop = true
            stream?.getTracks().forEach((t) => t.stop())
            try {
              return await done.current(out)
            } catch (e) {
              return setErr((e as Error).message)
            }
          }
        }
      }
      requestAnimationFrame(() => void tick())
    }
    if (!navigator.mediaDevices?.getUserMedia) setErr(tx('This browser cannot use the camera here.'))
    else
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } } }).then((st) => {
        stream = st
        if (video.current) {
          video.current.srcObject = st
          void video.current.play()
        }
        requestAnimationFrame(() => void tick())
      }, () => setErr(tx('No camera access. Allow the camera to read the QR carousel.')))
    return () => {
      stop = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [tx])
  return (
    <Dialog title={title} onClose={onClose}>
      <div className="grid gap-2 text-sm">
        {err ? <p className="text-danger" role="alert">{err}</p> : <video ref={video} className="w-full rounded" muted playsInline aria-label={tx('Camera')} />}
        <progress className="w-full" max={have.total || 1} value={have.have} aria-label={tx('Frames read')} />
        <p role="status">{have.total ? tx('{{have}} of {{total}} frames', { have: have.have, total: have.total }) : hint}</p>
        <p className="text-xs text-muted">{tx('Hold steady, fill most of the camera view with the code. Missed frames come round again.')}</p>
      </div>
    </Dialog>
  )
}
