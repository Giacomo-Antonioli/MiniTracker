import { useState } from 'react'
import { useStore } from '../../app/store'
import { factionsOf } from '../../domain/collection/backlog'
import { UnitFormDialog } from './UnitFormDialog'
import { UnitPanel } from './UnitPanel'

/** Full page for one unit (double-click in the backlog). */
export function UnitPage({ unitId, onBack, onOpenDatasheet }: { unitId: string; onBack: () => void; onOpenDatasheet: (id: string) => void }) {
  const { units } = useStore()
  const [editing, setEditing] = useState(false)
  const unit = units.find((u) => u.id === unitId)

  if (!unit) {
    return (
      <div className="grid gap-3">
        <p className="text-muted">This unit no longer exists.</p>
        <button className="btn w-fit" onClick={onBack}>← Back to backlog</button>
      </div>
    )
  }
  return (
    <>
      <UnitPanel unit={unit} variant="page" onEdit={() => setEditing(true)} onClose={onBack} onOpenDatasheet={onOpenDatasheet} />
      {editing && <UnitFormDialog unit={unit} factions={factionsOf(units)} onClose={() => setEditing(false)} />}
    </>
  )
}
