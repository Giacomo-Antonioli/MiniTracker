import { useState } from 'react'
import { useStore } from '../../app/store'
import { formatRuleText } from '../../domain/catalogue/rules'

/** Rule or ability name with its explanation; how it opens follows Settings → Appearance. */
export function RuleText({ name, text, extra }: { name: string; text?: string; extra?: string }) {
  const mode = useStore((s) => s.ruleDisplay)
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  if (!text) return <span className="rounded bg-panel-2 px-2 py-0.5 text-xs">{name}{extra && <span className="text-muted"> {extra}</span>}</span>

  const shown = mode === 'expanded' || (mode === 'collapsed' && open) || (mode === 'hover' && hover)
  return (
    <div
      className="grid gap-1"
      onMouseEnter={() => mode === 'hover' && setHover(true)}
      onMouseLeave={() => mode === 'hover' && setHover(false)}
      onFocus={() => mode === 'hover' && setHover(true)}
      onBlur={() => mode === 'hover' && setHover(false)}
    >
      <button
        type="button"
        className="flex items-center gap-1 text-left text-sm font-semibold hover:text-accent"
        aria-expanded={shown}
        onClick={() => mode === 'collapsed' && setOpen(!open)}
      >
        {mode !== 'expanded' && <span aria-hidden="true" className={`inline-block text-xs text-muted transition-transform ${shown ? 'rotate-90' : ''}`}>▸</span>}
        {name}
        {extra && <span className="font-normal text-muted">{extra}</span>}
      </button>
      {shown && (
        <p className="rounded border border-line bg-bg p-2 text-sm leading-relaxed" role="note" aria-label={`${name} explanation`}>
          {formatRuleText(text).map((p, i) => (p.bold ? <b key={i}>{p.text}</b> : <span key={i}>{p.text}</span>))}
        </p>
      )}
    </div>
  )
}
