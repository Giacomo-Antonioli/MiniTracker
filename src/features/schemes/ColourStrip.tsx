import { useTx } from '../../i18n'
/** Row of paint swatches. */
export function ColourStrip({ colours, height = 'h-3' }: { colours: string[]; height?: string }) {
  const tx = useTx()
  if (!colours.length) return <div className={`${height} w-full rounded bg-panel-2`} aria-hidden="true" />
  return (
    <div className={`flex ${height} w-full overflow-hidden rounded`} aria-label={tx('{{n}} paint colours', { n: colours.length })}>
      {colours.map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}
    </div>
  )
}
