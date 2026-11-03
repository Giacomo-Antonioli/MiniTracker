import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../../app/store'
import { EDITIONS } from '../../data/catalogue/fetch'
import type { Catalogue } from '../../domain/catalogue/types'
import { keywordLegend, unitCards } from '../../domain/lists/cards'
import { listOwnership } from '../../domain/lists/ownership'
import { listPoints } from '../../domain/lists/points'
import { battleSizes } from '../../domain/lists/rules'
import type { ArmyList } from '../../domain/lists/types'
import { DatasheetCards, KeywordLegend } from './DatasheetCards'
import { StratagemCards } from './StratagemCards'
import { detachmentNames, stratagemsFor } from '../../domain/stratagems/stratagems'

export interface ArmyPrintOptions {
  cards: boolean
  ownership: boolean
  stratagems: boolean
}

/** The whole army as a printable roster, optionally with datasheet cards and owned/painted counts. */
export function ArmySheet({ list, cat, options, onDone }: { list: ArmyList; cat: Catalogue; options: ArmyPrintOptions; onDone: () => void }) {
  const { units, pipeline, stratagemData } = useStore()
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

  const sheets = new Map(cat.datasheets.map((d) => [d.id, d]))
  const enh = new Map((cat.enhancements ?? []).map((x) => [x.id, x]))
  const points = listPoints(list, sheets, enh)
  const own = listOwnership(list, units, pipeline)
  const linkedTo = (id: string) => (own.byEntry.get(id)?.from ?? []).map((f) => units.find((u) => u.id === f.unitId)).filter((u): u is NonNullable<typeof u> => !!u)
  const detachments = (cat.detachments ?? []).filter((d) => list.detachmentIds?.includes(d.id)).map((d) => d.name)
  const subtitle = [cat.factions.find((f) => f.id === list.factionId)?.name, EDITIONS.find((x) => x.key === list.edition)?.label, battleSizes(cat).find((b) => b.id === list.battleSize)?.name, detachments.join(', ')].filter(Boolean).join(' · ')

  return createPortal(
    <div className="print-only" aria-label="Army sheet">
      <header className="flex items-baseline justify-between border-b-2 border-black pb-1">
        <h1 className="text-2xl font-bold">{list.name}</h1>
        <span className="text-lg font-bold">{points.total} / {list.pointsLimit} pts</span>
      </header>
      <p className="text-sm">{subtitle}</p>
      <table className="mt-3 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-1">Unit</th>
            <th className="py-1 text-right">Models</th>
            <th className="py-1 pl-3">Notes</th>
            {options.ownership && <th className="py-1 text-right">Owned</th>}
            {options.ownership && <th className="py-1 text-right">Painted</th>}
            <th className="py-1 text-right">Points</th>
          </tr>
        </thead>
        <tbody>
          {list.entries.map((e) => {
            const d = sheets.get(e.datasheetId)
            const x = enh.get(e.enhancementId ?? '')
            const o = own.byEntry.get(e.id)
            const leads = e.attachedTo ? list.entries.find((t) => t.id === e.attachedTo) : undefined
            return (
              <tr key={e.id} className="border-b border-black/30 align-top">
                <td className="py-1">{d?.name ?? 'Unknown unit'}</td>
                <td className="py-1 text-right">{e.models}</td>
                <td className="py-1 pl-3 text-xs">
                  {[e.warlord && 'Warlord', x && `${x.name} (+${x.points})`, leads && `Leads ${sheets.get(leads.datasheetId)?.name ?? 'a unit'}`].filter(Boolean).join(' · ')}
                </td>
                {options.ownership && <td className="py-1 text-right">{o ? `${o.have}/${o.need}` : '–'}</td>}
                {options.ownership && <td className="py-1 text-right">{o ? o.painted : '–'}</td>}
                <td className="py-1 text-right">{(points.byEntry.get(e.id) ?? 0) + (x?.points ?? 0)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {options.ownership && <p className="mt-2 text-sm">{own.missingModels ? `${own.missingModels} models missing` : 'Every model owned'} · {own.unpaintedModels} to paint</p>}
      {options.cards && (
        <section style={{ breakBefore: 'page' }}>
          {(() => {
            const cards = unitCards(list, cat, (e) => linkedTo(e.id))
            return (
              <>
                <DatasheetCards cards={cards} />
                <KeywordLegend rules={keywordLegend(cards, cat.rules ?? [])} />
              </>
            )
          })()}
        </section>
      )}
      {options.stratagems && stratagemData && (() => {
        const r = stratagemsFor(detachments, stratagemData, list.stratagemDetachments)
        return <StratagemCards core={r.core} detachments={r.detachments} />
      })()}
      <p className="mt-6 text-xs">MiniTracker · {date}</p>
    </div>,
    document.body,
  )
}

/** Asked before printing the army: what to include. Owned/painted counts are off unless asked for. */
export function ArmyPrintDialog({ list, cat, onSave, onCancel, onPrint }: { list: ArmyList; cat: Catalogue; onSave: (l: ArmyList) => void; onCancel: () => void; onPrint: (o: ArmyPrintOptions) => void }) {
  const { stratagemData } = useStore()
  const [o, setO] = useState<ArmyPrintOptions>({ cards: true, ownership: false, stratagems: !!stratagemData })
  const names = (cat.detachments ?? []).filter((d) => list.detachmentIds?.includes(d.id)).map((d) => d.name)
  const r = stratagemData ? stratagemsFor(names, stratagemData, list.stratagemDetachments) : undefined
  const choices = stratagemData ? detachmentNames(stratagemData) : []
  return (
    <div role="dialog" aria-label="Print army" className="panel absolute right-0 z-20 mt-1 grid w-64 gap-2 border-accent/60 p-3">
      <h3 className="font-semibold">Print army</h3>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={o.cards} onChange={(e) => setO({ ...o, cards: e.target.checked })} /> Datasheet cards</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={o.ownership} onChange={(e) => setO({ ...o, ownership: e.target.checked })} /> Owned and painted models</label>
      {stratagemData ? (
        <>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={o.stratagems} onChange={(e) => setO({ ...o, stratagems: e.target.checked })} /> Stratagem cards</label>
          {o.stratagems && r?.detachments.map((d) => (
            <label key={d.name} className="grid gap-0.5 text-xs">
              <span className={d.matched ? 'text-muted' : 'text-danger'}>{d.matched ? `${d.name}: ${d.stratagems.length} stratagems` : `${d.name}: not found, pick it`}</span>
              <select
                className="input py-0.5"
                aria-label={`Stratagems for ${d.name}`}
                value={d.matched ?? ''}
                onChange={(e) => onSave({ ...list, stratagemDetachments: { ...list.stratagemDetachments, [d.name]: e.target.value }, updatedAt: new Date().toISOString() })}
              >
                <option value="">—</option>
                {choices.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          ))}
        </>
      ) : (
        <p className="text-xs text-muted">Stratagem cards: import them in Settings → Catalogue.</p>
      )}
      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={() => onPrint(o)}>🖨 Print</button>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
