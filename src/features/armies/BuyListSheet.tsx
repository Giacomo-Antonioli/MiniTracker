import { printPage } from '../../app/platform'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BuyList } from '../../domain/lists/buy'
import type { PaintPlan, PaintStatus } from '../../domain/lists/schemes'
import type { ArmyList } from '../../domain/lists/types'
import type { PaintDef } from '../../domain/paints/types'
import { PaintRows } from '../paints/MissingPaintsSheet'
import type { UnitCard } from '../../domain/lists/cards'
import { DatasheetCards, KeywordLegend } from './DatasheetCards'
import type { Rule } from '../../domain/catalogue/types'
import { useTx, txr } from '../../i18n'

/** Printable buy list. Rendered off-screen and printed (or saved as PDF from the print dialog), like recipe cards. */
const STATUS = (): Record<PaintStatus, string> => ({ buy: txr('to buy'), unpainted: txr('to paint'), painted: txr('painted ✓') })

export function BuyListSheet({ list, buy, plan, paintById, subtitle, cards, legend = [], paints = true, buyRows = true, onDone }: { list: ArmyList; buy: BuyList; plan: PaintPlan; paintById: Map<string, PaintDef>; subtitle: string; cards?: UnitCard[]; legend?: Rule[]; paints?: boolean; buyRows?: boolean; onDone: () => void }) {
  const tx = useTx()
  const [date] = useState(() => new Date().toLocaleDateString())
  useEffect(() => {
    const done = () => onDone()
    window.addEventListener('afterprint', done)
    const t = setTimeout(() => void printPage(), 50)
    return () => {
      clearTimeout(t)
      window.removeEventListener('afterprint', done)
    }
  }, [onDone])

  return createPortal(
    <div className="print-only" aria-label={tx('Buy list sheet')}>
      <h1 className="text-2xl font-bold">{tx('Buy list – {{name}}', { name: list.name })}</h1>
      <p className="text-sm">{subtitle}</p>
      {buyRows && buy.rows.length > 0 && (
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="w-8 py-1"> </th>
            <th className="py-1">{tx('Unit')}</th>
            <th className="py-1 text-right">{tx('Models to buy')}</th>
            <th className="py-1 text-right">{tx('Points in list')}</th>
          </tr>
        </thead>
        <tbody>
          {buy.rows.map((r) => (
            <tr key={r.datasheetId} className="border-b border-black/30">
              <td className="py-1">☐</td>
              <td className="py-1">{r.name}{r.units > 1 ? ` (${tx('{{n}} units', { n: r.units })})` : ''}</td>
              <td className="py-1 text-right">{r.missingModels}</td>
              <td className="py-1 text-right">{r.points}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <td />
            <td className="py-1">{tx('Total')}</td>
            <td className="py-1 text-right">{buy.missingModels}</td>
            <td className="py-1 text-right">{buy.points}</td>
          </tr>
        </tfoot>
      </table>
      )}
      {paints && plan.groups.map((g) => (
        <section key={g.scheme.id} className="mt-6" style={{ breakInside: 'avoid' }}>
          <h2 className="text-lg font-bold">{tx('Scheme: {{name}}', { name: g.scheme.name })}</h2>
          <p className="text-sm">{g.units.map((u) => `${u.name} (${STATUS()[u.status]})`).join(' · ')}</p>
          <PaintRows rows={g.paints.map((p) => ({ paintId: p.paintId, paint: paintById.get(p.paintId), have: p.have, usedBy: p.have ? 'have' : 'buy' }))} />
        </section>
      ))}
      {paints && plan.withoutScheme.length > 0 && <p className="mt-6 text-sm">{tx('No scheme: {{list}}', { list: plan.withoutScheme.map((u) => u.name).join(', ') })}</p>}
      {cards && cards.length > 0 && (
        <section style={{ breakBefore: 'page' }}>
          <h1 className="text-2xl font-bold">{tx('Datasheets – {{name}}', { name: list.name })}</h1>
          <DatasheetCards cards={cards} />
          <KeywordLegend rules={legend} />
        </section>
      )}
      <p className="mt-6 text-xs">MiniTracker · {date}</p>
    </div>,
    document.body,
  )
}
