import { useState } from 'react'
import { useStore } from '../../app/store'
import { factionsOf } from '../../domain/collection/backlog'
import { UnitFormDialog } from './UnitFormDialog'
import { UnitPanel } from './UnitPanel'
import { useTx } from '../../i18n'

/** Full page for one unit (double-click in the backlog). */
export function UnitPage({ unitId, onBack, onOpenDatasheet, onOpenScheme }: { unitId: string; onBack: () => void; onOpenDatasheet: (id: string) => void; onOpenScheme: (id: string) => void }) {
  const tx = useTx()
  const { units } = useStore()
  const [editing, setEditing] = useState(false)
  const unit = units.find((u) => u.id === unitId)

  if (!unit) {
    return (
      <div className="grid gap-3">
        <p className="text-muted">{tx('This unit no longer exists.')}</p>
        <button className="btn w-fit" onClick={onBack}>{tx('← Back to backlog')}</button>
      </div>
    )
  }
  return (
    <>
      <UnitPanel unit={unit} variant="page" onEdit={() => setEditing(true)} onClose={onBack} onOpenDatasheet={onOpenDatasheet} onOpenScheme={onOpenScheme} />
      {editing && <UnitFormDialog unit={unit} factions={factionsOf(units)} onClose={() => setEditing(false)} />}
    </>
  )
}
