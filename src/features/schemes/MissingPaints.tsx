import { useStore } from '../../app/store'
import { closestOwnedSubstitute, matchLabel } from '../../domain/paints/colour'

/** "Missing paints (n): A (use B, close), C" — each with the closest paint you own. */
export function MissingPaints({ ids, name }: { ids: string[]; name: (id: string) => string }) {
  const { paints, paintStock } = useStore()
  return (
    <>
      <b className="text-danger">Missing paints ({ids.length}):</b>{' '}
      {ids.map((id, i) => {
        const p = paints.find((x) => x.id === id)
        const sub = p && closestOwnedSubstitute(p, paints, paintStock)
        return (
          <span key={id}>
            {i > 0 && ', '}
            {name(id)}
            {sub && <span className="text-muted" title={`ΔE2000 ${sub.distance.toFixed(1)}`}> (use {sub.paint.name}, {matchLabel(sub.distance)})</span>}
          </span>
        )
      })}
    </>
  )
}
