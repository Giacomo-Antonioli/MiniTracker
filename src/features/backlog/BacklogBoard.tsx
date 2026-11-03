import { useMemo, useState } from 'react'
import { useStore } from '../../app/store'
import { boardColumns, type BoardCard } from '../../domain/collection/board'
import type { OwnedUnit } from '../../domain/collection/types'
import { MoveDialog } from './MoveDialog'

const DRAG_TYPE = 'application/x-minitracker-group'

/** Kanban view of the backlog: drag a card to another stage, or use its "Move to" menu (works on touch). */
export function BacklogBoard({ units, selectedId, onCardClick }: { units: OwnedUnit[]; selectedId: string | null; onCardClick: (id: string, clicks: number) => void }) {
  const { pipeline } = useStore()
  const columns = useMemo(() => boardColumns(units, pipeline), [units, pipeline])
  const [moving, setMoving] = useState<(BoardCard & { to: string }) | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const find = (key: string) => columns.flatMap((c) => c.cards).find((c) => `${c.unit.id}/${c.group.id}` === key)

  return (
    <div className="flex min-h-[60vh] gap-3 overflow-x-auto pb-2" aria-label="Board">
      {columns.map(({ stage, cards }) => (
        <section
          key={stage.id}
          aria-label={`Stage ${stage.name}`}
          className={`panel flex w-60 shrink-0 flex-col gap-2 p-2 ${over === stage.id ? 'ring-2 ring-accent' : ''}`}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
            e.preventDefault()
            setOver(stage.id)
          }}
          onDragLeave={() => setOver((o) => (o === stage.id ? null : o))}
          onDrop={(e) => {
            e.preventDefault()
            setOver(null)
            const card = find(e.dataTransfer.getData(DRAG_TYPE))
            if (card && card.group.status !== stage.id) setMoving({ ...card, to: stage.id })
          }}
        >
          <h2 className="flex items-center justify-between px-1 text-sm font-semibold">
            <span>{stage.name}</span>
            <span className="text-muted">{cards.reduce((n, c) => n + c.group.count, 0)}</span>
          </h2>
          {cards.map((card) => (
            <article
              key={card.group.id}
              aria-label={`${card.unit.customName}, ${card.group.count} in ${stage.name}`}
              draggable
              onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, `${card.unit.id}/${card.group.id}`)}
              onClick={(e) => onCardClick(card.unit.id, e.detail)}
              className={`cursor-grab rounded border bg-panel-2 p-2 text-sm active:cursor-grabbing ${selectedId === card.unit.id ? 'border-accent' : 'border-line'}`}
            >
              <div className="font-medium">{card.unit.customName}</div>
              <div className="flex items-center justify-between gap-2 text-xs text-muted">
                <span className="truncate">{card.group.count} model{card.group.count === 1 ? '' : 's'}{card.unit.factionName ? ` · ${card.unit.factionName}` : ''}</span>
                <span className="flex gap-1">
                  <button className="hover:text-accent" title="Painter companion" aria-label={`Paint ${card.unit.customName}`} onClick={(e) => { e.stopPropagation(); useStore.getState().openCompanion('paint', card.unit.id) }}>🎨</button>
                  <button className="hover:text-accent" title="Builder companion" aria-label={`Build ${card.unit.customName}`} onClick={(e) => { e.stopPropagation(); useStore.getState().openCompanion('build', card.unit.id) }}>🔨</button>
                </span>
                <select
                  className="max-w-24 rounded border border-line bg-transparent text-xs"
                  aria-label={`Move ${card.unit.customName} to`}
                  value=""
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => e.target.value && setMoving({ ...card, to: e.target.value })}
                >
                  <option value="">Move…</option>
                  {pipeline.stages.filter((s) => s.id !== stage.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </article>
          ))}
          {cards.length === 0 && <p className="px-1 text-xs text-muted">Drop models here</p>}
        </section>
      ))}
      {moving && <MoveDialog unit={moving.unit} group={moving.group} initialTo={moving.to} onClose={() => setMoving(null)} />}
    </div>
  )
}
