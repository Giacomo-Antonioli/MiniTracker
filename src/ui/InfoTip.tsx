import { useId } from 'react'

/** Small ⓘ icon that shows an explanation on hover or keyboard focus. */
export function InfoTip({ text, label = 'More info' }: { text: string; label?: string }) {
  const id = useId()
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-muted text-[10px] leading-none text-muted hover:border-accent hover:text-accent focus:border-accent focus:text-accent focus:outline-none"
      >
        i
      </button>
      <span
        id={id}
        role="tooltip"
        className="panel pointer-events-none invisible absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 p-2 text-xs text-fg opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  )
}
