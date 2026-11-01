import { useId, useRef, useState, type ReactNode } from 'react'

export interface ComboOption {
  value: string
  label: string
  /** Small text on the right, e.g. "Battleline · 5–10 · 80 pts". */
  hint?: string
  /** Heading shown above the first option of each group. */
  group?: string
}

interface Props {
  label: string
  /** Text in the input. Controlled so free text is possible. */
  text: string
  onTextChange: (text: string) => void
  options: ComboOption[]
  onSelect: (option: ComboOption) => void
  placeholder?: string
  /** Shown under the list, e.g. a hint when nothing matches. */
  footer?: ReactNode
  autoFocus?: boolean
}

/** Type-to-search input with a list of suggestions (ARIA combobox pattern). Options are filtered by the caller. */
export function Combobox({ label, text, onTextChange, options, onSelect, placeholder, footer, autoFocus }: Props) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)
  const shown = open && (options.length > 0 || footer)

  function pick(o: ComboOption) {
    onSelect(o)
    setOpen(false)
  }

  function move(delta: number) {
    if (!options.length) return
    const next = (active + delta + options.length) % options.length
    setActive(next)
    listRef.current?.querySelector(`#${CSS.escape(`${id}-o${next}`)}`)?.scrollIntoView?.({ block: 'nearest' })
  }

  return (
    <div className="relative grid gap-1">
      <label htmlFor={`${id}-input`} className="text-sm text-muted">{label}</label>
      <input
        id={`${id}-input`}
        className="input"
        role="combobox"
        aria-expanded={!!shown}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={shown && options.length ? `${id}-o${active}` : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          onTextChange(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (!open) setOpen(true)
            else move(1)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            move(-1)
          } else if (e.key === 'Enter' && shown && options[active]) {
            e.preventDefault()
            pick(options[active])
          } else if (e.key === 'Escape' && open) {
            e.preventDefault()
            e.stopPropagation()
            setOpen(false)
          }
        }}
      />
      {shown && (
        <ul
          id={`${id}-list`}
          ref={listRef}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="panel absolute top-full z-10 mt-1 max-h-72 w-full overflow-y-auto py-1 shadow-xl"
        >
          {options.map((o, i) => (
            <li key={o.value} role="presentation">
              {o.group && o.group !== options[i - 1]?.group && (
                <div className="px-3 pt-2 pb-1 text-xs uppercase tracking-wider text-muted" role="presentation">{o.group}</div>
              )}
              <div
                id={`${id}-o${i}`}
                role="option"
                aria-selected={i === active}
                className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-1.5 ${i === active ? 'bg-panel-2 text-accent' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o)}
              >
                <span>{o.label}</span>
                {o.hint && <span className="shrink-0 text-xs text-muted">{o.hint}</span>}
              </div>
            </li>
          ))}
          {footer && <li role="presentation" className="px-3 py-2 text-xs text-muted">{footer}</li>}
        </ul>
      )}
    </div>
  )
}
