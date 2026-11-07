import { useMemo, useState } from 'react'
import { useStore } from '../../app/store'
import { missingForSchemes } from '../../domain/paints/missing'
import { useTx } from '../../i18n'
import { Dialog } from '../../ui/Dialog'
import { AddToShoppingButton } from '../shopping/AddToShoppingDialog'
import { MissingPaintsSheet } from './MissingPaintsSheet'

/** Pick schemes, then print the paints they use that you don't own. Your own schemes are picked to start with. */
export function MissingPaintsDialog({ onClose }: { onClose: () => void }) {
  const tx = useTx()
  const { schemes, paints, paintStock } = useStore()
  const sorted = useMemo(() => [...schemes].sort((a, b) => Number(a.origin !== 'personal') - Number(b.origin !== 'personal') || a.name.localeCompare(b.name)), [schemes])
  const [picked, setPicked] = useState(() => new Set(schemes.filter((s) => s.origin === 'personal').map((s) => s.id)))
  const [printing, setPrinting] = useState(false)
  const chosen = sorted.filter((s) => picked.has(s.id))
  const rows = useMemo(() => missingForSchemes(chosen, paints, paintStock), [chosen, paints, paintStock])
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <Dialog title={tx('Paints to buy')} onClose={onClose}>
      <div className="flex gap-2 text-sm">
        <button className="btn" onClick={() => setPicked(new Set(sorted.map((s) => s.id)))}>{tx('All')}</button>
        <button className="btn" onClick={() => setPicked(new Set())}>{tx('None')}</button>
      </div>
      <ul className="mt-2 max-h-72 overflow-y-auto text-sm">
        {sorted.map((s) => (
          <li key={s.id}>
            <label className="flex items-center gap-2 py-0.5">
              <input type="checkbox" checked={picked.has(s.id)} onChange={() => toggle(s.id)} />
              {s.name} <span className="text-muted">{s.origin === 'personal' ? '' : s.origin}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm">{rows.length === 1 ? (chosen.length === 1 ? tx('1 paint to buy from 1 scheme') : tx('1 paint to buy from {{m}} schemes', { m: chosen.length })) : chosen.length === 1 ? tx('{{n}} paints to buy from 1 scheme', { n: rows.length }) : tx('{{n}} paints to buy from {{m}} schemes', { n: rows.length, m: chosen.length })}</p>
      <div className="mt-3 flex justify-end gap-2">
        <AddToShoppingButton items={rows.map((r) => ({ kind: 'paint' as const, name: r.paint ? `${r.paint.brand} ${r.paint.name}` : r.paintId, refId: r.paintId, qty: 1, sources: r.schemes.map((x) => tx('Scheme: {{name}}', { name: x })) }))} />
        <button className="btn btn-primary" disabled={!chosen.length} onClick={() => setPrinting(true)}>{tx('Print / save PDF')}</button>
      </div>
      {printing && <MissingPaintsSheet rows={rows} schemes={chosen.map((s) => s.name)} onDone={() => setPrinting(false)} />}
    </Dialog>
  )
}
