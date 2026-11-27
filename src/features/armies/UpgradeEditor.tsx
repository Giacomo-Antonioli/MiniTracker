import type { Datasheet, UpgradeSection } from '../../domain/catalogue/types'
import type { ListEntry } from '../../domain/lists/types'
import { applyUpgrades, gearWeapons, pickKey, sectionLimits, type Picks } from '../../domain/lists/upgrades'
import { useTx } from '../../i18n'

/** Unit-level upgrades (One Page Rules): tick or count the options of each section; shows the resulting weapons. */
export function UpgradeEditor({ d, entry, onChange }: { d: Datasheet; entry: ListEntry; onChange: (picks: Picks | undefined) => void }) {
  const tx = useTx()
  if (!d.upgrades?.length) return null
  const picks = entry.upgrades ?? {}
  const weapons = gearWeapons(applyUpgrades(d, picks).gear)

  const set = (s: UpgradeSection, optionId: string, n: number) => {
    const next: Picks = { ...picks, [pickKey(s.id, optionId)]: n }
    // Where only one fits, choosing another option swaps to it.
    if (n > 0 && sectionLimits(s, d.minModels).total === 1) {
      for (const o of s.options) if (o.id !== optionId) delete next[pickKey(s.id, o.id)]
    }
    for (const [k, v] of Object.entries(next)) if (!v) delete next[k]
    onChange(Object.keys(next).length ? next : undefined)
  }

  return (
    <div className="grid basis-full gap-2 rounded border border-line/60 p-2" aria-label={tx('{{name}} loadout', { name: d.name })}>
      <div className="flex items-center gap-2 text-muted">
        <span>{tx('Upgrades')}</span>
        {entry.upgrades && <button className="ml-auto underline" onClick={() => onChange(undefined)}>{tx('Clear upgrades')}</button>}
      </div>
      <p>{weapons.map((w) => `${w.values[0][1]}x ${w.name}`).join(', ')}</p>
      {d.upgrades.map((s) => {
        const { perOption, total } = sectionLimits(s, d.minModels)
        const used = s.options.reduce((n, o) => n + (picks[pickKey(s.id, o.id)] ?? 0), 0)
        return (
          <fieldset key={s.id} className="grid gap-0.5">
            <legend className="font-semibold">{s.label}</legend>
            {s.options.map((o) => {
              const n = picks[pickKey(s.id, o.id)] ?? 0
              // "any" replacements are bounded by the weapons there are; the list checks report going over.
              const max = Math.min(perOption, total === 1 ? 1 : n + Math.max(0, total - used))
              return (
                <label key={o.id} className="flex items-center gap-1">
                  {perOption === 1 ? (
                    <input type="checkbox" checked={n > 0} disabled={!n && total > 1 && used >= total} onChange={(ev) => set(s, o.id, ev.target.checked ? 1 : 0)} />
                  ) : (
                    <input
                      className="input w-14 py-0"
                      type="number"
                      min={0}
                      max={Number.isFinite(max) ? max : undefined}
                      value={n}
                      onChange={(ev) => set(s, o.id, Math.max(0, Math.min(max, Math.floor(Number(ev.target.value) || 0))))}
                    />
                  )}
                  <span>{o.label} <span className="text-muted">(+{tx('{{n}} pts', { n: o.points })})</span></span>
                </label>
              )
            })}
          </fieldset>
        )
      })}
    </div>
  )
}
