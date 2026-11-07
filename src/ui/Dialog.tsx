import { useEffect, useRef, type ReactNode } from 'react'

/** Native <dialog>, opened as modal while mounted. */
export function Dialog({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
    // showModal() focuses the first control (the ✕); a control marked data-autofocus gets the focus instead.
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
  }, [])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={title}
      className={`panel m-auto max-h-[92dvh] overflow-y-auto p-0 text-fg ${wide ? 'w-[min(720px,95vw)]' : 'w-[min(440px,95vw)]'}`}
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-display text-lg text-accent">{title}</h2>
        <button className="text-muted hover:text-fg" onClick={() => ref.current?.close()} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="p-4">{children}</div>
    </dialog>
  )
}

export function ProgressBar({ ratio }: { ratio: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-panel-2" role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full bg-accent" style={{ width: `${ratio * 100}%` }} />
    </div>
  )
}
