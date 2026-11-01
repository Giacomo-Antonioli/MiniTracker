import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BuyList } from '../../domain/lists/buy'
import type { PaintPlan, PaintStatus } from '../../domain/lists/schemes'
import type { ArmyList } from '../../domain/lists/types'

/** Printable buy list. Rendered off-screen and printed (or saved as PDF from the print dialog), like recipe cards. */
const STATUS: Record<PaintStatus, string> = { buy: 'to buy', unpainted: 'to paint', painted: 'painted ✓' }

export function BuyListSheet({ list, buy, plan, paintName, subtitle, onDone }: { list: ArmyList; buy: BuyList; plan: PaintPlan; paintName: Map<string, string>; subtitle: string; onDone: () => void }) {
  const [date] = useState(() => new Date().toLocaleDateString())
  useEffect(() => {
    const done = () => onDone()
    window.addEventListener('afterprint', done)
    const t = setTimeout(() => window.print(), 50)
    return () => {
      clearTimeout(t)
      window.removeEventListener('afterprint', done)
    }
  }, [onDone])

  return createPortal(
    <div className="print-only" aria-label="Buy list sheet">
      <h1 className="text-2xl font-bold">Buy list – {list.name}</h1>
      <p className="text-sm">{subtitle}</p>
      {buy.rows.length > 0 && (
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="w-8 py-1"> </th>
            <th className="py-1">Unit</th>
            <th className="py-1 text-right">Models to buy</th>
            <th className="py-1 text-right">Points in list</th>
          </tr>
        </thead>
        <tbody>
          {buy.rows.map((r) => (
            <tr key={r.datasheetId} className="border-b border-black/30">
              <td className="py-1">☐</td>
              <td className="py-1">{r.name}{r.units > 1 ? ` (${r.units} units)` : ''}</td>
              <td className="py-1 text-right">{r.missingModels}</td>
              <td className="py-1 text-right">{r.points}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <td />
            <td className="py-1">Total</td>
            <td className="py-1 text-right">{buy.missingModels}</td>
            <td className="py-1 text-right">{buy.points}</td>
          </tr>
        </tfoot>
      </table>
      )}
      {plan.groups.map((g) => (
        <section key={g.scheme.id} className="mt-6" style={{ breakInside: 'avoid' }}>
          <h2 className="text-lg font-bold">Scheme: {g.scheme.name}</h2>
          <p className="text-sm">{g.units.map((u) => `${u.name} (${STATUS[u.status]})`).join(' · ')}</p>
          <table className="mt-2 w-full border-collapse text-sm">
            <tbody>
              {g.paints.map((p) => (
                <tr key={p.paintId} className="border-b border-black/30">
                  <td className="w-8 py-1">{p.have ? '☑' : '☐'}</td>
                  <td className="py-1">{paintName.get(p.paintId) ?? p.paintId}</td>
                  <td className="py-1 text-right text-xs">{p.have ? 'have' : 'buy'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      {plan.withoutScheme.length > 0 && <p className="mt-6 text-sm">No scheme: {plan.withoutScheme.map((u) => u.name).join(', ')}</p>}
      <p className="mt-6 text-xs">MiniTracker · {date}</p>
    </div>,
    document.body,
  )
}
