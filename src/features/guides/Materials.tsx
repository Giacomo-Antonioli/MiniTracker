import { useState } from 'react'
import { ctx, useStore } from '../../app/store'
import { MATERIALS, type Material } from '../../domain/guides/materials'
import { newSupply } from '../../domain/supplies/supplies'

/** Basing materials: what they are, how to use them, who makes them; each can be added to Supplies. */
export function MaterialsList() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {MATERIALS.map((m) => <MaterialCard key={m.id} material={m} />)}
    </div>
  )
}

export function MaterialCard({ material: m }: { material: Material }) {
  const { supplies, saveSupply } = useStore()
  const [added, setAdded] = useState(false)
  const owned = added || supplies.some((s) => s.name.toLowerCase() === m.name.toLowerCase())
  return (
    <article className="panel grid content-start gap-2 p-4 text-sm" aria-label={`Material ${m.name}`}>
      <header className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-accent">{m.name}</h3>
        {owned ? (
          <span className="text-xs text-ok">✓ In Supplies</span>
        ) : (
          <button
            className="btn shrink-0 text-xs"
            onClick={async () => {
              await saveSupply(newSupply({ name: m.name, category: m.category, quantity: 1, lowAt: 0 }, ctx()))
              setAdded(true)
            }}
          >
            + Add to Supplies
          </button>
        )}
      </header>
      <p>{m.what}</p>
      <ol className="grid list-decimal gap-1 pl-5">{m.how.map((h) => <li key={h}>{h}</li>)}</ol>
      <ul className="grid list-disc gap-1 pl-5">{m.tips.map((h) => <li key={h}>{h}</li>)}</ul>
      <p><b>Avoid:</b> {m.mistakes.join(' ')}</p>
      <p className="text-xs text-muted">
        Made by:{' '}
        {m.brands.map((b, i) => (
          <span key={b.name}>{i > 0 && ' · '}<a className="hover:text-accent hover:underline" href={b.url} target="_blank" rel="noreferrer">{b.name}</a></span>
        ))}
      </p>
    </article>
  )
}

export function MaterialPanel({ material, onClose }: { material: Material; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-label={`Material guide ${material.name}`} onClick={onClose}>
      <div className="h-full w-[380px] max-w-full overflow-y-auto bg-bg p-3" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex justify-end">
          <button className="btn" aria-label="Close material" onClick={onClose}>✕</button>
        </div>
        <MaterialCard material={material} />
      </div>
    </div>
  )
}
