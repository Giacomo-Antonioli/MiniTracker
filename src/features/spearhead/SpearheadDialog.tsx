import { useState } from 'react'
import { ctx, useStore } from '../../app/store'
import data from '../../data/spearhead/boxes.json'
import { gameOfRepo } from '../../domain/catalogue/editions'
import { createUnit, ownedModels } from '../../domain/collection/ownedUnit'
import { WISHLISTED, firstOwnedStage, isGone } from '../../domain/collection/pipeline'
import { boxContents, candidates, unitsForBox, type SpearheadBox } from '../../domain/spearhead/spearhead'
import { useTx } from '../../i18n'
import { Dialog } from '../../ui/Dialog'

const BOXES = data.boxes as SpearheadBox[]
const FACTIONS = [...new Set(BOXES.map((b) => b.faction))]

/** Add every unit of an Age of Sigmar Spearhead box to the backlog (#99). */
export function SpearheadDialog({ onClose }: { onClose: () => void }) {
  const tx = useTx()
  const { catalogue, catalogues, units, pipeline, saveUnit } = useStore()
  // Match against Age of Sigmar even when another game's catalogue is active.
  const aos = catalogue && gameOfRepo(catalogue.source.repo) === 'aos' ? catalogue : catalogues.find((c) => gameOfRepo(c.source.repo) === 'aos')
  const [faction, setFaction] = useState(FACTIONS[0])
  const armies = BOXES.filter((b) => b.faction === faction)
  const [boxId, setBoxId] = useState(armies[0].id)
  const box = armies.find((b) => b.id === boxId) ?? armies[0]
  const [picks, setPicks] = useState<Record<string, string>>({})
  const owned = firstOwnedStage(pipeline)
  const [status, setStatus] = useState<string>(WISHLISTED)
  const [done, setDone] = useState('')
  const rows = boxContents(box, aos)
  const have = (datasheetId?: string, name?: string) =>
    units.filter((u) => !isGone(u.lifecycle) && (datasheetId ? u.datasheetId === datasheetId : u.customName.toLowerCase() === name?.toLowerCase())).reduce((n, u) => n + ownedModels(u), 0)

  return (
    <Dialog title={tx('Spearhead box')} onClose={onClose} wide>
      <form
        className="grid gap-3 p-4"
        aria-label={tx('Spearhead box')}
        onSubmit={(e) => {
          e.preventDefault()
          const news = unitsForBox(box, aos, status, picks)
          void Promise.all(news.map((n) => saveUnit(createUnit(n, ctx())))).then(() => setDone(tx('Added {{n}} units from {{box}} to the backlog.', { n: news.length, box: box.name })))
        }}
      >
        <p className="text-sm text-muted">
          {tx("Each Spearhead army is one box with fixed contents, read from Games Workshop's free Spearhead rules.")}
          {!aos && ` ${tx('Download the Age of Sigmar catalogue to link the units to their warscrolls.')}`}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">{tx('Faction')}
            <select className="input" value={faction} onChange={(e) => {
              setFaction(e.target.value)
              setBoxId(BOXES.find((b) => b.faction === e.target.value)!.id)
              setPicks({})
            }}>
              {FACTIONS.map((f) => <option key={f}>{f}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm">{tx('Army')}
            <select className="input" value={box.id} onChange={(e) => { setBoxId(e.target.value); setPicks({}) }}>
              {armies.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
        </div>
        <ul className="grid gap-1" aria-label={tx('Box contents')}>
          {rows.map((r) => {
            const opts = aos ? candidates(r.entry, aos, box.faction) : []
            const id = picks[r.entry] ?? r.datasheetId ?? ''
            const mine = have(id || undefined, r.entry)
            return (
              <li key={r.entry} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-8 text-right tabular-nums">{r.models}×</span>
                {opts.length > 1 ? (
                  <select className="input max-w-full flex-1 py-1" aria-label={tx('Build of {{name}}', { name: r.entry })} value={id} onChange={(e) => setPicks({ ...picks, [r.entry]: e.target.value })}>
                    {opts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                ) : (
                  <span className="flex-1">{r.name}{aos && !r.datasheetId && <span className="text-muted"> · {tx('not in the catalogue')}</span>}</span>
                )}
                <span className={mine ? 'text-ok' : 'text-muted'}>{mine ? tx('you own {{n}}', { n: mine }) : tx('none owned')}</span>
              </li>
            )
          })}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">{tx('Add as')}
            <select className="input py-1" aria-label={tx('Add as')} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value={WISHLISTED}>{tx('Wishlisted')}</option>
              {pipeline.stages.filter((s) => s.id !== WISHLISTED).map((s) => <option key={s.id} value={s.id}>{s.id === owned ? tx('{{name}} (owned)', { name: s.name }) : s.name}</option>)}
            </select>
          </label>
          <button className="btn btn-primary">{tx('Add {{n}} units to the backlog', { n: rows.length })}</button>
          <a className="ml-auto text-sm text-accent underline" href={box.source} target="_blank" rel="noreferrer">{tx('Rules (PDF)')}</a>
        </div>
        {done && <p className="text-sm" role="status">{done}</p>}
      </form>
    </Dialog>
  )
}
