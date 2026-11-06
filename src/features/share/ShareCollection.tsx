import { useEffect, useState } from 'react'
import { useStore } from '../../app/store'
import { buildShowcase, factionOf, SHOWCASE_HASH } from '../../domain/share/showcase'
import { encodeShare } from '../../domain/schemes/share'
import { Dialog } from '../../ui/Dialog'

const OWNER = 'mt.shareOwner'
const readOwner = () => {
  try {
    return localStorage.getItem(OWNER) ?? ''
  } catch {
    return ''
  }
}

/** Makes a read-only link to the collection and its painting progress (#97). */
export function ShareCollection({ onClose }: { onClose: () => void }) {
  const { units, pipeline } = useStore()
  const all = [...new Set(units.map(factionOf))].sort()
  const [owner, setOwner] = useState(readOwner)
  const [factions, setFactions] = useState<string[]>([])
  const [wishlist, setWishlist] = useState(false)
  const [url, setUrl] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let live = true
    const s = buildShowcase(units, pipeline, { owner, factions, wishlist }, new Date().toISOString())
    void encodeShare(JSON.stringify(s)).then((t) => live && setUrl(`${location.origin}${location.pathname}${SHOWCASE_HASH}${t}`))
    try {
      localStorage.setItem(OWNER, owner)
    } catch {
      // Only a convenience.
    }
    return () => {
      live = false
    }
  }, [units, pipeline, owner, factions, wishlist])

  const toggle = (f: string) => setFactions((x) => (x.includes(f) ? x.filter((y) => y !== f) : [...x, f]))
  const copy = () => navigator.clipboard.writeText(url).then(() => setMsg('Link copied'), () => setMsg('Copy failed: select the link and copy it'))
  const share = () => navigator.share?.({ title: owner ? `${owner}'s collection` : 'My collection', url }).catch(() => {})

  return (
    <Dialog title="Share collection" onClose={onClose}>
      <div className="grid gap-3 p-4 text-sm">
        <p className="text-muted">A read-only link with your units and painting progress. Anyone with it can look; nothing is uploaded (the data is inside the link) and no photos are included. It shows the collection as it is now.</p>
        <label className="grid gap-1">Your name (shown on the page)<input className="input" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="optional" /></label>
        {all.length > 1 && (
          <fieldset className="grid gap-1">
            <legend className="mb-1">Factions {factions.length ? `(${factions.length})` : '(all)'}</legend>
            <div className="flex flex-wrap gap-1">
              {all.map((f) => (
                <button key={f} type="button" className={`btn px-2 py-0.5 text-xs ${factions.includes(f) ? 'btn-primary' : ''}`} aria-pressed={factions.includes(f)} onClick={() => toggle(f)}>{f}</button>
              ))}
            </div>
          </fieldset>
        )}
        <label className="flex items-center gap-2"><input type="checkbox" checked={wishlist} onChange={(e) => setWishlist(e.target.checked)} /> Include the wishlist</label>
        <input className="input text-xs" readOnly value={url} aria-label="Share link" onFocus={(e) => e.target.select()} />
        {url.length > 30000 && <p className="text-xs text-danger">This link is long ({Math.round(url.length / 1000)}k characters); some chat apps cut long links. Pick fewer factions.</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" disabled={!url} onClick={() => void copy()}>📋 Copy link</button>
          {'share' in navigator && <button type="button" className="btn" disabled={!url} onClick={() => void share()}>📤 Share…</button>}
          <a className="btn" href={url} target="_blank" rel="noreferrer">👁 Preview</a>
        </div>
        {msg && <p className="text-xs text-muted" role="status">{msg}</p>}
      </div>
    </Dialog>
  )
}
