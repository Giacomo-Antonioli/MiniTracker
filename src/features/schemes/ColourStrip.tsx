/** Row of paint swatches. */
export function ColourStrip({ colours, height = 'h-3' }: { colours: string[]; height?: string }) {
  if (!colours.length) return <div className={`${height} w-full rounded bg-panel-2`} aria-hidden="true" />
  return (
    <div className={`flex ${height} w-full overflow-hidden rounded`} aria-label={`${colours.length} paint colours`}>
      {colours.map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}
    </div>
  )
}
