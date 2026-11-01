import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BuyList } from '../../domain/lists/buy'
import type { ArmyList } from '../../domain/lists/types'

/** Printable buy list. Rendered off-screen and printed (or saved as PDF from the print dialog), like recipe cards. */
export function BuyListSheet({ list, buy, subtitle, onDone }: { list: ArmyList; buy: BuyList; subtitle: string; onDone: () => void }) {
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
      <p className="mt-6 text-xs">MiniTracker · {date}</p>
    </div>,
    document.body,
  )
}
