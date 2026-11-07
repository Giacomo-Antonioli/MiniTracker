import QRCode from 'qrcode'
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../app/store'
import { assignCodes, codeFromText, codeLink, findCode, modelCodes, stencilPath, type CodeTarget } from '../../domain/storage/codes'
import { homedIn, kindOf, pathLabel, type Storage } from '../../domain/storage/storage'
import { Dialog } from '../../ui/Dialog'
import { isBarcode } from '../../domain/barcodes/barcodes'
import { decodeFrame } from './decode'
import { WISHLISTED } from '../../domain/collection/pipeline'
import type { OwnedUnit } from '../../domain/collection/types'
import { appUrl, printHtml } from '../../app/platform'
import { txr, useTx } from '../../i18n'

/** Owned models of a unit (wishlisted ones have no base to label yet). */
export const ownedModels = (u: OwnedUnit | undefined) => (u ? u.groups.reduce((n, g) => n + (g.status === WISHLISTED ? 0 : g.count), 0) : 0)

export type LabelLayout = 'stickers' | 'boxes' | 'stencil'
export interface LabelItem { code: string; name: string; sub: string; contents: string[]; qr: string }

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const appBase = appUrl

/** The printable page for a label sheet (A4, sizes in mm). */
export function labelsHtml(items: LabelItem[], layout: LabelLayout, size: number): string {
  const css = `@page{size:A4;margin:8mm}body{font-family:system-ui,sans-serif;margin:0;color:#000}
.grid{display:flex;flex-wrap:wrap;gap:3mm}.st{width:${size}mm;text-align:center;break-inside:avoid}.st svg{width:${size}mm;height:${size}mm;display:block}
.st b{display:block;font:700 ${Math.max(1.8, size / 7).toFixed(1)}mm monospace}
.bx{width:62mm;border:0.3mm solid #000;border-radius:2mm;padding:3mm;display:flex;gap:3mm;break-inside:avoid}.bx svg{width:28mm;height:28mm;flex:none}
.bx h2{margin:0;font-size:4mm}.bx p{margin:1mm 0;font-size:2.6mm}.bx ul{margin:1mm 0 0;padding-left:3.5mm;font-size:2.4mm}.code{font:700 5mm monospace}
.sten svg{display:block;margin:0 0 3mm}.tip{font-size:3mm;color:#444;margin:0 0 4mm}`
  let body = ''
  if (layout === 'stickers') {
    body = `<div class="grid">${items.map((i) => `<div class="st">${i.qr}<b>${esc(i.code)}</b></div>`).join('')}</div>`
  } else if (layout === 'boxes') {
    body = `<div class="grid">${items.map((i) => `<div class="bx">${i.qr}<div><div class="code">${esc(i.code)}</div><h2>${esc(i.name)}</h2><p>${esc(i.sub)}</p>${i.contents.length ? `<ul>${i.contents.slice(0, 12).map((c) => `<li>${esc(c)}</li>`).join('')}${i.contents.length > 12 ? `<li>+${i.contents.length - 12} ${txr('more')}</li>` : ''}</ul>` : ''}</div></div>`).join('')}</div>`
  } else {
    body = `<p class="tip">${txr('Stencil: cut the black shapes out of stencil film or thin card (or load the SVG in a cutting machine), then dab paint or use a paint pen through it.')}</p>` + stencilSvg(items.map((i) => i.code), size)
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>${txr('MiniTracker labels')}</title><style>${css}</style></head><body>${body}<script>onload=()=>print()</script></body></html>`
}

/** All codes as stencils in one SVG, `h` mm high each, with a cut frame around each. */
export function stencilSvg(codes: string[], h: number): string {
  const pad = h * 0.35
  const rows = codes.map((c) => ({ c, ...stencilPath(c, h) }))
  const w = Math.max(10, ...rows.map((r) => r.width)) + pad * 2
  const rh = h + pad * 2
  const total = rows.length * (rh + 2)
  const g = rows.map((r, i) => `<g transform="translate(${pad} ${i * (rh + 2) + pad})"><path d="${r.d}"/></g><rect x="0" y="${i * (rh + 2)}" width="${w.toFixed(1)}" height="${rh.toFixed(1)}" fill="none" stroke="#999" stroke-width="0.2"/>`).join('')
  return `<svg class="sten" xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(1)}mm" height="${total.toFixed(1)}mm" viewBox="0 0 ${w.toFixed(1)} ${total.toFixed(1)}">${g}</svg>`
}

const qrSvg = (text: string) => QRCode.toString(text, { type: 'svg', margin: 0, errorCorrectionLevel: 'L' })

/** Pick units and places, then print stickers, box labels or a stencil sheet. */
export function LabelsDialog({ onClose, unitIds: preset, placeIds: presetPlaces }: { onClose: () => void; unitIds?: string[]; placeIds?: string[] }) {
  const tx = useTx()
  const { storage: s, units, saveStorage } = useStore()
  const stored = units.filter((u) => u.lifecycle === 'active')
  const [units_, setUnits] = useState<string[]>(preset ?? stored.filter((u) => s.homes[u.id]).map((u) => u.id))
  const [places, setPlaces] = useState<string[]>(presetPlaces ?? s.places.map((p) => p.id))
  const [layout, setLayout] = useState<LabelLayout>('stickers')
  const [size, setSize] = useState(15)
  const [msg, setMsg] = useState('')
  const toggle = (list: string[], set: (x: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  const name = (id: string) => units.find((u) => u.id === id)?.customName ?? ''
  const codesOf = (st: Storage, id: string) => modelCodes(st.codes[id], ownedModels(units.find((u) => u.id === id)))

  const build = async (): Promise<{ html: string; next: Storage }> => {
    const next = assignCodes(s, units_, places)
    const items: LabelItem[] = []
    const rows = (layout === 'boxes' ? [] : units_.flatMap((id) => codesOf(next, id).map((code) => ({ id, code })))).concat(places.map((id) => ({ id, code: next.codes[id] })))
    for (const { id, code } of rows) {
      const place = next.places.find((p) => p.id === id)
      items.push({
        code,
        name: place ? `${kindOf(next, place.kind).icon} ${place.name}` : name(id),
        sub: place ? [pathLabel(next, place.parentId), place.location].filter(Boolean).join(' · ') : '',
        contents: place ? homedIn(next, id).map((x) => `${x.slot !== undefined ? `${x.slot}. ` : ''}${name(x.unitId)}`) : [],
        qr: layout === 'stencil' ? '' : await qrSvg(codeLink(appBase(), code)),
      })
    }
    return { html: labelsHtml(items, layout, layout === 'stencil' ? Math.max(6, size / 2) : size), next }
  }

  const print = async () => {
    const { html, next } = await build()
    await saveStorage(next)
    if (!(await printHtml(html))) setMsg(tx('Allow pop-ups for this site to print the labels.'))
  }
  const download = async () => {
    const next = assignCodes(s, units_, places)
    await saveStorage(next)
    const svg = stencilSvg([...units_.flatMap((id) => codesOf(next, id)), ...places.map((id) => next.codes[id])], Math.max(6, size / 2))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    a.download = 'minitracker-stencils.svg'
    a.click()
    setMsg(tx('Stencil SVG downloaded.'))
  }

  return (
    <Dialog title={tx('Labels and stencils')} onClose={onClose} wide>
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label={tx('Layout')}>
          {([['stickers', tx('🏷 QR stickers')], ['boxes', tx('📦 Box labels')], ['stencil', tx('✂ Stencil sheet')]] as const).map(([id, l]) => (
            <button key={id} aria-pressed={layout === id} className={`btn ${layout === id ? 'btn-primary' : ''}`} onClick={() => setLayout(id)}>{l}</button>
          ))}
          {layout !== 'boxes' && (
            <select className="input" aria-label={tx('Size')} value={size} onChange={(e) => setSize(Number(e.target.value))}>
              {[12, 15, 20, 25].map((n) => <option key={n} value={n}>{layout === 'stencil' ? tx('{{n}} mm letters', { n: n / 2 }) : tx('{{n}} mm', { n })}</option>)}
            </select>
          )}
        </div>
        <p className="text-xs text-muted">
          {layout === 'stickers' ? tx('Small QR stickers for under bases or on bags. Tip: print on vinyl label paper and add a coat of varnish so they stay on.')
            : layout === 'boxes' ? tx('One label per place with its QR, code, where it is and what is inside.')
            : tx('Codes in a stencil font (no loose islands): print and cut by hand, or download the SVG for a cutting machine.')}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {layout !== 'boxes' && (
            <fieldset className="grid max-h-56 content-start gap-1 overflow-auto text-sm">
              <legend className="text-xs text-muted">{tx('Units ({{n}}, one label per model)', { n: units_.length })}</legend>
              {stored.map((u) => <label key={u.id} className="flex items-center gap-2"><input type="checkbox" checked={units_.includes(u.id)} onChange={() => toggle(units_, setUnits, u.id)} />{u.customName}<span className="text-muted"> · {ownedModels(u) > 1 ? tx('{{n}} labels', { n: ownedModels(u) }) : tx('1 label')}{s.codes[u.id] ? ` · ${s.codes[u.id]}` : ''}</span></label>)}
            </fieldset>
          )}
          <fieldset className="grid max-h-56 content-start gap-1 overflow-auto text-sm">
            <legend className="text-xs text-muted">{tx('Places ({{n}})', { n: places.length })}</legend>
            {s.places.map((p) => <label key={p.id} className="flex items-center gap-2"><input type="checkbox" checked={places.includes(p.id)} onChange={() => toggle(places, setPlaces, p.id)} />{kindOf(s, p.kind).icon} {pathLabel(s, p.id)}{s.codes[p.id] ? <span className="text-muted"> · {s.codes[p.id]}</span> : null}</label>)}
          </fieldset>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={!units_.length && !places.length} onClick={() => void print()}>{tx('🖨 Print')}</button>
          {layout === 'stencil' && <button className="btn" onClick={() => void download()}>{tx('⬇ Download SVG')}</button>}
        </div>
        {msg && <p className="text-sm text-muted" role="status">{msg}</p>}
      </div>
    </Dialog>
  )
}

/** The code shown big, to copy under a base with a paint pen; gives one if missing. */
export function CodeBadge({ id, kind }: { id: string; kind: 'unit' | 'place' }) {
  const tx = useTx()
  const { storage: s, saveStorage, units } = useStore()
  const code = s.codes[id]
  const models = kind === 'unit' ? modelCodes(code ?? '', ownedModels(units.find((u) => u.id === id))) : []
  if (!code) return <button className="btn w-fit" onClick={() => void saveStorage(assignCodes(s, kind === 'unit' ? [id] : [], kind === 'place' ? [id] : []))}>{tx('🏷 Give it a code')}</button>
  return (
    <div className="flex flex-wrap items-center gap-3" aria-label={tx('Code')}>
      <span className="rounded border-2 border-dashed border-line px-3 py-1 font-mono text-3xl font-bold tracking-wider">{code}</span>
      <span className="text-xs text-muted">
        {models.length > 1 ? tx('Write one code under each base with a paint pen, or print a sticker per model or a stencil from Storage ▸ Labels.') : tx('Write this under the base with a paint pen, or print a sticker or stencil from Storage ▸ Labels.')}
      </span>
      {models.length > 1 && <ul className="flex w-full flex-wrap gap-1 font-mono text-sm" aria-label={tx('Model codes')}>{models.map((c) => <li key={c} className="rounded border border-line px-1.5">{c}</li>)}</ul>}
    </div>
  )
}

/** Type a code or scan a QR with the camera; calls onFound with the unit or place. */
export function FindCode({ onFound, onBarcode }: { onFound: (t: CodeTarget) => void; onBarcode?: (code: string) => void }) {
  const tx = useTx()
  const { storage: s } = useStore()
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [scanning, setScanning] = useState(false)
  const go = (raw: string) => {
    if (onBarcode && isBarcode(raw)) {
      setErr('')
      setScanning(false)
      return onBarcode(raw.trim())
    }
    const code = codeFromText(raw) ?? raw
    const t = findCode(s, code)
    if (t) {
      setErr('')
      setScanning(false)
      onFound(t)
    } else setErr(tx('No unit or place has the code "{{code}}".', { code: code.trim() }))
  }
  return (
    <div className="grid gap-1">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); go(text) }}>
        <input className="input w-32" aria-label={tx('Find code')} placeholder={tx('Code, e.g. U-007')} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn">{tx('Find')}</button>
        <button type="button" className="btn" onClick={() => setScanning(true)}>{tx('📷 Scan')}</button>
      </form>
      {err && <p className="text-sm text-danger" role="alert">{err}</p>}
      {scanning && <ScanDialog onText={go} onClose={() => setScanning(false)} />}
    </div>
  )
}

/** Camera scanner for QR labels and box barcodes, with a typed fallback. */
export function ScanDialog({ onText, onClose, title }: { onText: (t: string) => void; onClose: () => void; title?: string }) {
  const tx = useTx()
  const [typed, setTyped] = useState('')
  const video = useRef<HTMLVideoElement>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let stop = false
    let stream: MediaStream | undefined
    const canvas = document.createElement('canvas')
    const tick = () => {
      const v = video.current
      if (stop || !v) return
      if (v.readyState >= 2 && v.videoWidth) {
        canvas.width = v.videoWidth
        canvas.height = v.videoHeight
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (ctx) {
          ctx.drawImage(v, 0, 0)
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const hit = decodeFrame(img.data, img.width, img.height)
          if (hit) return onText(hit)
        }
      }
      requestAnimationFrame(tick)
    }
    if (!navigator.mediaDevices?.getUserMedia) setErr(tx('This browser cannot use the camera here. Type the code instead, or scan with the phone camera app.'))
    else
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then((st) => {
        stream = st
        if (video.current) {
          video.current.srcObject = st
          void video.current.play()
        }
        requestAnimationFrame(tick)
      }, () => setErr(tx('No camera access. Allow the camera, or type the code instead.')))
    return () => {
      stop = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onText, tx])
  return (
    <Dialog title={title ?? tx('Scan a QR or barcode')} onClose={onClose}>
      {err ? <p className="text-sm text-danger" role="alert">{err}</p> : <video ref={video} className="w-full rounded" muted playsInline aria-label={tx('Camera')} />}
      <p className="mt-2 text-xs text-muted">{tx('Point the camera at a MiniTracker label or the barcode on a box.')}</p>
      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) onText(typed.trim()) }}>
        <input className="input flex-1" aria-label={tx('Type a code or barcode')} placeholder={tx('…or type it')} value={typed} onChange={(e) => setTyped(e.target.value)} />
        <button className="btn">OK</button>
      </form>
    </Dialog>
  )
}
