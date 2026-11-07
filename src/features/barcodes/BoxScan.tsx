import { useEffect, useState } from 'react'
import { useStore } from '../../app/store'
import { boxStatus, isBarcode, isGamesWorkshop, lookupProduct, suggestDatasheets, type BoxContent, type BoxMapping } from '../../domain/barcodes/barcodes'
import { ownedModels } from '../../domain/collection/ownedUnit'
import { isGone } from '../../domain/collection/pipeline'
import { pathLabel, whereIs } from '../../domain/storage/storage'
import { useTx } from '../../i18n'
import { Dialog } from '../../ui/Dialog'
import { ScanDialog } from '../storage/Labels'

/** Teach the app a box: name and the units inside (datasheet + models). */
function TeachForm({ code, start, onDone }: { code: string; start?: BoxMapping; onDone: () => void }) {
  const tx = useTx()
  const { catalogue, saveBarcode } = useStore()
  const sheets = catalogue?.datasheets ?? []
  const [name, setName] = useState(start?.name ?? '')
  const [rows, setRows] = useState<BoxContent[]>(start?.contents ?? [{ name: '', models: 1 }])
  const [looking, setLooking] = useState(!start)
  const [found, setFound] = useState<string>()
  const [err, setErr] = useState('')
  useEffect(() => {
    if (start) return
    let live = true
    void lookupProduct(code).then((n) => {
      if (!live) return
      setLooking(false)
      if (!n) return
      setFound(n)
      setName((x) => x || n)
      const best = suggestDatasheets(n, sheets)[0]
      if (best) setRows((r) => (r.length === 1 && !r[0].name ? [{ datasheetId: best.id, name: best.name, models: 1 }] : r))
    })
    return () => {
      live = false
    }
  }, [code, start, sheets])
  const suggestions = suggestDatasheets(name, sheets)
  const pick = (i: number, id: string) => {
    const d = sheets.find((x) => x.id === id)
    setRows(rows.map((r, j) => (j === i ? { ...r, datasheetId: d?.id, name: d?.name ?? r.name } : r)))
  }
  return (
    <form
      className="grid gap-2"
      aria-label={tx('Teach box')}
      onSubmit={(e) => {
        e.preventDefault()
        try {
          void saveBarcode({ code, name, contents: rows.map((r) => ({ ...r, name: r.name.trim() })), createdAt: start?.createdAt ?? new Date().toISOString() }).then(onDone, (x: Error) => setErr(x.message))
        } catch (x) {
          setErr((x as Error).message)
        }
      }}
    >
      <p className="text-sm text-muted">
        {start ? tx('Edit this box.') : isGamesWorkshop(code) ? tx('New barcode {{code}} (Games Workshop). Tell the app what is inside; next time it will know.', { code }) : tx('New barcode {{code}}. Tell the app what is inside; next time it will know.', { code })}
        {looking ? ` ${tx('Looking it up…')}` : found ? ` ${tx('Open Products Facts says: “{{name}}”.', { name: found })}` : start ? '' : ` ${tx('Not found in Open Products Facts.')}`}
      </p>
      {!start && (
        <p className="flex flex-wrap gap-3 text-sm">
          {tx('Look it up:')}
          <a className="text-accent underline" href={`https://www.upcitemdb.com/upc/${encodeURIComponent(code)}`} target="_blank" rel="noreferrer">🔎 UPCitemdb</a>
          <a className="text-accent underline" href={`https://www.barcodespider.com/${encodeURIComponent(code)}`} target="_blank" rel="noreferrer">🔎 Barcode Spider</a>
        </p>
      )}
      <input className="input" aria-label={tx('Box name')} placeholder={tx("Box name, e.g. Combat Patrol: T'au")} value={name} onChange={(e) => setName(e.target.value)} />
      <ul className="grid gap-2">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            {sheets.length > 0 && (
              <select className="input max-w-56" aria-label={tx('Datasheet {{n}}', { n: i + 1 })} value={r.datasheetId ?? ''} onChange={(e) => pick(i, e.target.value)}>
                <option value="">{tx('Datasheet…')}</option>
                {suggestions.length > 0 && <optgroup label={tx('Suggested')}>{suggestions.map((d) => <option key={'s' + d.id} value={d.id}>{d.name}</option>)}</optgroup>}
                <optgroup label={tx('All')}>{sheets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</optgroup>
              </select>
            )}
            <input className="input flex-1" aria-label={tx('Unit {{n}}', { n: i + 1 })} placeholder={tx('Unit name')} value={r.name} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <input className="input w-20" type="number" min={1} aria-label={tx('Models {{n}}', { n: i + 1 })} value={r.models} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, models: Number(e.target.value) } : x)))} />
            {rows.length > 1 && <button type="button" className="btn px-2 py-0.5" aria-label={tx('Remove unit {{n}}', { n: i + 1 })} onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</button>}
          </li>
        ))}
      </ul>
      <button type="button" className="btn w-fit" onClick={() => setRows([...rows, { name: '', models: 1 }])}>{tx('+ Another unit in the box')}</button>
      <button className="btn btn-primary w-fit">{tx('Save box')}</button>
      {err && <p className="text-sm text-danger" role="alert">{err}</p>}
    </form>
  )
}

/** What a scanned box means for you: owned models, where they are, and open shopping lines to tick off. */
export function BoxDialog({ code, onClose, onOpenUnit }: { code: string; onClose: () => void; onOpenUnit?: (id: string) => void }) {
  const tx = useTx()
  const { barcodes, units, shopItems, setBought, storage } = useStore()
  const m = barcodes.find((x) => x.code === code)
  const [editing, setEditing] = useState(false)
  const status = m ? boxStatus(m, units, shopItems, (u) => (isGone(u.lifecycle) ? 0 : ownedModels(u))) : []
  return (
    <Dialog title={m ? m.name : tx('Unknown box')} onClose={onClose} wide>
      {!m || editing ? <TeachForm code={code} start={m} onDone={() => setEditing(false)} /> : (
        <div className="grid gap-3" aria-label={tx('Box status')}>
          {status.map(({ content: c, owned, units: mine, shopping }, i) => (
            <section key={i} className="grid gap-1 rounded border border-line p-2">
              <h3 className="font-semibold">{c.name} <span className="text-sm text-muted">· {tx('{{n}} in the box', { n: c.models })}</span></h3>
              <p className="text-sm">{owned ? (owned === 1 ? tx('✅ You own 1 model') : tx('✅ You own {{n}} models', { n: owned })) : tx('❌ You don’t own any yet')}</p>
              {mine.length > 0 && (
                <ul className="text-sm">
                  {mine.map((u) => {
                    const w = whereIs(storage, u.id)
                    return <li key={u.id}>{onOpenUnit ? <button className="text-accent underline" onClick={() => onOpenUnit(u.id)}>{u.customName}</button> : u.customName}{w.placeId ? <span className="text-muted"> · {pathLabel(storage, w.placeId, w.slot)}</span> : null}</li>
                  })}
                </ul>
              )}
              {shopping.map((it) => (
                <div key={it.id} className="flex flex-wrap items-center gap-2 text-sm">
                  {tx('🛒 On the shopping list: {{qty}} × {{name}}', { qty: it.qty, name: it.name })}
                  <button className="btn px-2 py-0.5" onClick={() => void setBought(it.id, true)}>{tx('✓ Mark bought')}</button>
                </div>
              ))}
            </section>
          ))}
          <button className="btn w-fit" onClick={() => setEditing(true)}>{tx('Edit box')}</button>
        </div>
      )}
    </Dialog>
  )
}

/** "Scan box" button: camera or typed barcode → box dialog. */
export function ScanBoxButton({ onOpenUnit }: { onOpenUnit?: (id: string) => void }) {
  const tx = useTx()
  const [scanning, setScanning] = useState(false)
  const [code, setCode] = useState<string>()
  const [err, setErr] = useState('')
  return (
    <>
      <button className="btn" data-tour="scan-box" onClick={() => setScanning(true)}>{tx('📷 Scan box')}</button>
      {scanning && (
        <ScanDialog
          title={tx('Scan a box barcode')}
          onClose={() => setScanning(false)}
          onText={(t) => {
            if (!isBarcode(t)) return setErr(tx('“{{code}}” is not a box barcode.', { code: t }))
            setErr('')
            setScanning(false)
            setCode(t)
          }}
        />
      )}
      {err && <span className="text-sm text-danger" role="alert">{err}</span>}
      {code && <BoxDialog code={code} onOpenUnit={onOpenUnit} onClose={() => setCode(undefined)} />}
    </>
  )
}
