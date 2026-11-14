import { useState } from 'react'
import { ROUND_BASES, trayPlan } from '../../domain/storage/trayGuide'
import { useTx } from '../../i18n'

/** Guide: cheap cardboard storage for models kept at home, with a hole size calculator. */
export function StorageGuide() {
  const tx = useTx()
  const [base, setBase] = useState<number>(32)
  const [w, setW] = useState(300)
  const [d, setD] = useState(200)
  const plan = trayPlan(base, w, d)
  return (
    <details className="panel p-4 text-sm" data-tour="storage-guide">
      <summary className="cursor-pointer font-display text-lg text-accent">{tx('Guide: cheap cardboard storage for models at home')}</summary>
      <div className="mt-3 grid gap-3">
        <p className="text-muted">{tx('For models that stay at home you do not need magnets or foam. You only need to stop models touching each other and to keep weight off them.')}</p>
        <ol className="grid list-decimal gap-1 pl-5">
          <li>{tx('Glue a base of two layers of corrugated cardboard (PVA, then press under books).')}</li>
          <li>{tx('Glue a "cell sheet" on top: one more layer with one round hole per base. The model stands in its hole and nothing touches the paint.')}</li>
          <li>{tx('Tall or fragile models (spears, wings): add a second cell sheet under them for depth and leave headroom, so a lid never presses on them.')}</li>
          <li>{tx('Keep painted and unpainted models in separate trays. Painted trays get a thin felt or foam offcut at the bottom.')}</li>
          <li>{tx('Stack the trays in a lidded box or drawers with a spacer rim between trays, so no weight rests on the models.')}</li>
          <li>{tx('Number the trays and cells (Tray 3, cell 12). In MiniTracker add the tray as a place and type the number of cells as its slots.')}</li>
        </ol>
        <p className="text-muted">{tx('Skip: insulation foam (crumbles, dust on paint), flat thin cardboard (sags), magnets (only worth it for transport).')}</p>

        <fieldset className="grid gap-2 rounded border border-line p-3">
          <legend className="px-1 text-xs text-muted">{tx('Hole size calculator')}</legend>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1">{tx('Base (mm)')}
              <select className="input" aria-label={tx('Base (mm)')} value={ROUND_BASES.includes(base as never) ? base : ''} onChange={(e) => e.target.value && setBase(Number(e.target.value))}>
                {ROUND_BASES.map((b) => <option key={b} value={b}>{b}</option>)}
                {!ROUND_BASES.includes(base as never) && <option value="">{tx('other')}</option>}
              </select>
              <input className="input w-20" type="number" min={1} step="0.5" aria-label={tx('Base width in mm')} value={base} onChange={(e) => setBase(Number(e.target.value))} />
            </label>
            <label className="flex items-center gap-1">{tx('Tray width (mm)')}<input className="input w-20" type="number" min={1} value={w} onChange={(e) => setW(Number(e.target.value))} /></label>
            <label className="flex items-center gap-1">{tx('Tray depth (mm)')}<input className="input w-20" type="number" min={1} value={d} onChange={(e) => setD(Number(e.target.value))} /></label>
          </div>
          {plan ? (
            <p role="status">
              {tx('Cut holes of {{hole}} mm, {{pitch}} mm apart centre to centre: {{cols}} × {{rows}} = {{cells}} cells. Use {{cells}} as the Slots of the place.', { hole: plan.hole, pitch: plan.pitch, cols: plan.cols, rows: plan.rows, cells: plan.cells })}
            </p>
          ) : <p className="text-muted" role="status">{tx('The tray is too small for one hole.')}</p>}
        </fieldset>
      </div>
    </details>
  )
}
