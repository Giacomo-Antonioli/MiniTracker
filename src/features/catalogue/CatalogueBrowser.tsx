import { useMemo, useState } from 'react'
import { useStore } from '../../app/store'
import { ownedByDatasheet, pointsTable } from '../../domain/catalogue/owned'
import { searchDatasheets } from '../../domain/catalogue/search'
import type { Catalogue, Datasheet } from '../../domain/catalogue/types'
import { factionsOf } from '../../domain/collection/backlog'
import { UnitFormDialog } from '../backlog/UnitFormDialog'
import { DatasheetInfo } from './DatasheetInfo'
import { useTx } from '../../i18n'

export function CatalogueBrowser({ onOpenSettings, openId }: { onOpenSettings: () => void; openId?: string }) {
  const tx = useTx()
  const { catalogue, units } = useStore()
  const [text, setText] = useState('')
  const [factionId, setFactionId] = useState('')
  const [role, setRole] = useState('')
  const [ownedOnly, setOwnedOnly] = useState(false)
  const [legends, setLegends] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(openId ?? null)
  const [adding, setAdding] = useState<Datasheet | null>(null)

  const owned = useMemo(() => ownedByDatasheet(units), [units])
  const roles = useMemo(() => [...new Set((catalogue?.datasheets ?? []).map((d) => d.role).filter((r): r is string => !!r))].sort(), [catalogue])
  const shown = useMemo(() => {
    if (!catalogue) return []
    return searchDatasheets(catalogue, text, { factionId: factionId || undefined, includeLegends: legends, limit: Infinity }).filter(
      (d) => (!role || d.role === role) && (!ownedOnly || owned.has(d.id)),
    )
  }, [catalogue, text, factionId, legends, role, ownedOnly, owned])

  if (!catalogue) {
    return (
      <div className="grid max-w-xl gap-3">
        <h1 className="font-display text-2xl text-accent" data-tour="catalogue-title">{tx('Catalogue')}</h1>
        <p className="text-muted">{tx('No unit catalogue installed yet.')}</p>
        <button className="btn btn-primary w-fit" onClick={onOpenSettings}>{tx('Go to Settings → Catalogue')}</button>
      </div>
    )
  }

  const selected = catalogue.datasheets.find((d) => d.id === selectedId)

  return (
    <div className="flex h-full gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <header className="flex items-baseline justify-between">
          <h1 className="font-display text-2xl text-accent" data-tour="catalogue-title">{tx('Catalogue')}</h1>
          <span className="text-sm text-muted">
            {tx('{{shown}} of {{total}} units', { shown: shown.length, total: catalogue.datasheets.length })} · {catalogue.gameName}
          </span>
        </header>

        <section className="flex flex-wrap items-center gap-2" aria-label={tx('Catalogue filters')}>
          <input className="input w-60" placeholder={tx('🔍 Search name or keyword')} value={text} onChange={(e) => setText(e.target.value)} />
          <select className="input" aria-label={tx('Faction')} value={factionId} onChange={(e) => setFactionId(e.target.value)}>
            <option value="">{tx('All factions')}</option>
            {catalogue.factions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <select className="input" aria-label={tx('Role')} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">{tx('All roles')}</option>
            {roles.map((r) => <option key={r}>{r}</option>)}
          </select>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={ownedOnly} onChange={(e) => setOwnedOnly(e.target.checked)} /> {tx('Owned only')}</label>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={legends} onChange={(e) => setLegends(e.target.checked)} /> {tx('Legends')}</label>
        </section>

        <div className="panel overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 border-b border-line bg-panel text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="p-2">{tx('Unit')}</th>
                <th className="p-2">{tx('Role')}</th>
                <th className="p-2">{tx('Models')}</th>
                <th className="p-2 text-right">{tx('Points')}</th>
                <th className="p-2 text-right">{tx('Owned')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((d) => {
                const o = owned.get(d.id)
                return (
                  <tr
                    key={d.id}
                    onClick={() => setSelectedId(d.id)}
                    className={`cursor-pointer border-b border-line/50 hover:bg-panel-2 ${d.id === selectedId ? 'bg-panel-2' : ''}`}
                  >
                    <td className="p-2">
                      {d.name}
                      {d.legends && <span className="text-muted"> ({tx('Legends')})</span>}
                    </td>
                    <td className="p-2 text-muted">{d.role ?? '—'}</td>
                    <td className="p-2 text-muted">{d.minModels === d.maxModels ? d.minModels : `${d.minModels}–${d.maxModels}`}</td>
                    <td className="p-2 text-right">{d.points[0].points || '?'}</td>
                    <td className="p-2 text-right">{o ? <span className="text-ok">{o.models} ✓</span> : ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {shown.length === 0 && <p className="p-6 text-center text-muted">{tx('No units match these filters.')}</p>}
        </div>
      </div>

      {selected && (
        <DatasheetPanel
          catalogue={catalogue}
          d={selected}
          owned={owned.get(selected.id)}
          ownedUnits={units.filter((u) => u.datasheetId === selected.id)}
          onAdd={() => setAdding(selected)}
          onClose={() => setSelectedId(null)}
        />
      )}
      {adding && (
        <UnitFormDialog
          factions={factionsOf(units)}
          preset={{ datasheet: adding, factionId: factionId || undefined }}
          onClose={() => setAdding(null)}
        />
      )}
    </div>
  )
}

function DatasheetPanel({
  catalogue,
  d,
  owned,
  ownedUnits,
  onAdd,
  onClose,
}: {
  catalogue: Catalogue
  d: Datasheet
  owned?: { units: number; models: number }
  ownedUnits: { id: string; customName: string }[]
  onAdd: () => void
  onClose: () => void
}) {
  const tx = useTx()
  const factionNames = d.factionIds.map((id) => catalogue.factions.find((f) => f.id === id)?.name).filter(Boolean)
  const section = (title: string, items: string[]) =>
    items.length > 0 && (
      <section className="border-b border-line p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{title}</h3>
        <div className="flex flex-wrap gap-1">
          {items.map((x) => <span key={x} className="rounded bg-panel-2 px-2 py-0.5 text-xs">{x}</span>)}
        </div>
      </section>
    )

  return (
    <aside className="panel fixed inset-0 z-40 flex flex-col overflow-y-auto rounded-none md:static md:z-auto md:h-full md:w-[420px] md:shrink-0 md:rounded-[inherit]" aria-label={tx('Datasheet details')}>
      <header className="border-b border-line p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-display text-xl text-accent">{d.name}</h2>
          <button className="btn" aria-label={tx('Close datasheet')} onClick={onClose}>✕</button>
        </div>
        <p className="mt-1 text-sm text-muted">
          {d.role ?? tx('No role')}
          {d.legends && ` · ${tx('Legends')}`}
        </p>
        <p className="mt-2 text-sm">
          {owned ? <span className="text-ok">{owned.units > 1 ? tx('You own {{models}} models in {{units}} units', { models: owned.models, units: owned.units }) : tx('You own {{models}} models in 1 unit', { models: owned.models })}</span> : <span className="text-muted">{tx('Not in your collection')}</span>}
        </p>
        <button className="btn btn-primary mt-3" onClick={onAdd}>{tx('+ Add to collection')}</button>
      </header>

      <section className="border-b border-line p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{tx('Points')}</h3>
        <table className="text-sm" aria-label={tx('Points by unit size')}>
          <tbody>
            {pointsTable(d).map((r) => (
              <tr key={r.models}>
                <td className="pr-6">{r.models === '1' ? tx('1 model') : tx('{{n}} models', { n: r.models })}</td>
                <td className="font-semibold text-accent">{tx('{{n}} pts', { n: r.points || '?' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <DatasheetInfo catalogue={catalogue} d={d} />
      {section(tx('Available to ({{n}})', { n: factionNames.length }), factionNames as string[])}

      {ownedUnits.length > 0 && (
        <section className="p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{tx('Your units')}</h3>
          <ul className="text-sm">{ownedUnits.map((u) => <li key={u.id}>• {u.customName}</li>)}</ul>
        </section>
      )}
      <p className="mt-auto p-4 text-xs text-muted">{tx('Data: BSData ({{repo}}). Full rules text is not included.', { repo: catalogue.source.repo })}</p>
    </aside>
  )
}
