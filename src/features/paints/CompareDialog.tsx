import { useState } from 'react'
import { useStore } from '../../app/store'
import { hexDistance, matchLabel, owns } from '../../domain/paints/colour'
import type { PaintDef } from '../../domain/paints/types'
import { useTx } from '../../i18n'
import { Combobox } from '../../ui/Combobox'
import { Dialog } from '../../ui/Dialog'
import { ColourMatches } from './ColourMatches'
import { PhotoColourPicker } from './PhotoColourPicker'

const MAX_PAINTS = 4

/** Paints side by side, each measured against the first column: the photo colour if one is taken, else the first paint. */
export function CompareDialog({ initial, onClose }: { initial?: string; onClose: () => void }) {
  const tx = useTx()
  const { paints, paintStock } = useStore()
  const [ids, setIds] = useState<string[]>(initial ? [initial] : [])
  const [sample, setSample] = useState<string>()
  const [text, setText] = useState('')

  const chosen = ids.map((id) => paints.find((p) => p.id === id)).filter((p): p is PaintDef => !!p)
  const reference = sample ?? chosen[0]?.hex
  const full = chosen.length >= MAX_PAINTS
  const words = text.toLowerCase().split(/\s+/).filter(Boolean)
  const options = words.length
    ? paints
        .filter((p) => !ids.includes(p.id) && words.every((w) => `${p.name} ${p.brand}`.toLowerCase().includes(w)))
        .slice(0, 20)
        .map((p) => ({ value: p.id, label: p.name, hint: `${p.brand}${p.range ? ` ${p.range}` : ''}` }))
    : []
  const add = (id: string) => setIds((x) => (x.includes(id) || x.length >= MAX_PAINTS ? x : [...x, id]))

  const column = (key: string, hex: string, name: string, detail: string, isReference: boolean, remove: () => void) => {
    const d = isReference ? undefined : hexDistance(reference!, hex)
    return (
      <li key={key} className="flex min-w-0 flex-col">
        <span className="h-28 border border-line" style={{ background: hex }} />
        <span className="grid gap-0.5 p-1 text-sm">
          <b className="break-words">{name}</b>
          <span className="text-xs text-muted">{detail}</span>
          <span className="text-xs">{isReference ? tx('Reference') : d !== undefined && `${matchLabel(d)} · ΔE ${d.toFixed(1)}`}</span>
          <button className="btn w-fit text-xs" aria-label={tx('Remove {{name}}', { name })} onClick={remove}>✕</button>
        </span>
      </li>
    )
  }

  return (
    <Dialog title={tx('Compare colours')} onClose={onClose} wide>
      <div className="grid gap-3">
        {full ? (
          <p className="text-sm text-muted">{tx('Four paints at most: remove one to add another.')}</p>
        ) : (
          <Combobox label={tx('Add a paint')} placeholder={tx('🔍 Search name or brand')} text={text} onTextChange={setText} options={options} onSelect={(o) => { add(o.value); setText('') }} />
        )}
        {(sample || chosen.length > 0) && (
          <ul className="grid auto-cols-fr grid-flow-col" aria-label={tx('Compared colours')}>
            {sample && column('photo', sample, tx('From the photo'), sample, true, () => setSample(undefined))}
            {chosen.map((p, i) => column(p.id, p.hex, p.name, `${p.brand} · ${owns(paintStock, p.id) ? tx('Owned') : tx('Not owned')}`, !sample && i === 0, () => setIds(ids.filter((x) => x !== p.id))))}
          </ul>
        )}
        <PhotoColourPicker onPick={setSample} />
        {sample && <ColourMatches hex={sample} onPick={(p) => add(p.id)} />}
      </div>
    </Dialog>
  )
}
