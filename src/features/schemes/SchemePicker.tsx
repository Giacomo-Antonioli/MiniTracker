import { useEffect, useRef, useState } from 'react'
import { colourStrip } from '../../domain/schemes/scheme'
import type { PaintScheme, SchemeOrigin } from '../../domain/schemes/types'
import type { PaintDef } from '../../domain/paints/types'
import { ColourStrip } from './ColourStrip'
import { ORIGIN_LABEL } from './origin'

/** Scheme dropdown that shows each scheme's colours (a native select can't). */
export function SchemePicker({ label, value, groups, paints, isDefault, onChange }: {
  label: string
  value?: string
  groups: { origin: SchemeOrigin; schemes: PaintScheme[] }[]
  paints: PaintDef[]
  isDefault?: (s: PaintScheme) => boolean
  onChange: (id: string | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const chosen = groups.flatMap((g) => g.schemes).find((s) => s.id === value)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])
  const pick = (id: string | undefined) => {
    onChange(id)
    setOpen(false)
  }
  const row = (s: PaintScheme) => (
    <li key={s.id} role="option" aria-selected={s.id === value} className={`cursor-pointer rounded px-2 py-1 hover:bg-panel-2 ${s.id === value ? 'bg-panel-2' : ''}`} onClick={() => pick(s.id)}>
      <div className="text-sm">{s.name}{isDefault?.(s) ? ' ⭐' : ''}</div>
      <ColourStrip colours={colourStrip(s, paints)} height="h-2" />
    </li>
  )

  return (
    <div className="relative" ref={box}>
      <button type="button" className="input flex w-full flex-col items-stretch gap-1 text-left" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{chosen ? `${chosen.name}${isDefault?.(chosen) ? ' ⭐' : ''}` : 'None'} <span className="float-right text-muted">▾</span></span>
        {chosen && <ColourStrip colours={colourStrip(chosen, paints)} height="h-2" />}
      </button>
      {open && (
        <ul role="listbox" aria-label={label} className="panel absolute z-20 mt-1 max-h-80 w-full overflow-y-auto p-1">
          <li role="option" aria-selected={!value} className="cursor-pointer rounded px-2 py-1 text-sm hover:bg-panel-2" onClick={() => pick(undefined)}>None</li>
          {groups.map((g) => (
            <li key={g.origin} role="presentation">
              <div className="px-2 pt-2 text-xs uppercase tracking-wider text-muted">{ORIGIN_LABEL[g.origin]}</div>
              <ul role="group" aria-label={ORIGIN_LABEL[g.origin]}>{g.schemes.map(row)}</ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
