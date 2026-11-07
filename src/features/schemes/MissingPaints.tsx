import { useStore } from '../../app/store'
import { closestOwnedSubstitute, matchLabel } from '../../domain/paints/colour'
import { useTx } from '../../i18n'

/** "Missing paints (n): A (use B, close), C" — each with the closest paint you own. */
export function MissingPaints({ ids, name }: { ids: string[]; name: (id: string) => string }) {
  const tx = useTx()
  const { paints, paintStock } = useStore()
  return (
    <>
      <b className="text-danger">{tx('Missing paints ({{n}}):', { n: ids.length })}</b>{' '}
      {ids.map((id, i) => {
        const p = paints.find((x) => x.id === id)
        const sub = p && closestOwnedSubstitute(p, paints, paintStock)
        return (
          <span key={id}>
            {i > 0 && ', '}
            {name(id)}
            {sub && <span className="text-muted" title={`ΔE2000 ${sub.distance.toFixed(1)}`}> {tx('(use {{name}}, {{match}})', { name: sub.paint.name, match: matchLabel(sub.distance) })}</span>}
          </span>
        )
      })}
    </>
  )
}
