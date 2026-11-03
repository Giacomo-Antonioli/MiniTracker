export interface MagnetDraft {
  slot: string
  options: string
}

const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)

export const toMagnetDrafts = (slots: { slot: string; optionIds: string[] }[]): MagnetDraft[] => slots.map((s) => ({ slot: s.slot, options: s.optionIds.join(', ') }))
export const fromMagnetDrafts = (drafts: MagnetDraft[]) => drafts.map((d) => ({ slot: d.slot, optionIds: split(d.options) }))

/** Edit the magnet slots of one model group: a name and its options; options can be picked from the datasheet's wargear. */
export function MagnetEditor({ slots, wargear, onChange }: { slots: MagnetDraft[]; wargear: string[]; onChange: (s: MagnetDraft[]) => void }) {
  const patch = (i: number, p: Partial<MagnetDraft>) => onChange(slots.map((s, j) => (j === i ? { ...s, ...p } : s)))
  return (
    <div className="ml-6 grid gap-2 border-l-2 border-line pl-3" role="group" aria-label="Magnet slots">
      {slots.map((s, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2" role="group" aria-label={`Magnet slot ${i + 1}`}>
          <input className="input w-32" placeholder="slot, e.g. arms" aria-label="Slot name" value={s.slot} onChange={(e) => patch(i, { slot: e.target.value })} />
          <input className="input min-w-40 flex-1" placeholder="options, comma separated" aria-label="Options" value={s.options} onChange={(e) => patch(i, { options: e.target.value })} />
          {wargear.length > 0 && (
            <select
              className="input w-40"
              aria-label="Add wargear option"
              value=""
              onChange={(e) => {
                const have = split(s.options)
                if (e.target.value && !have.includes(e.target.value)) patch(i, { options: [...have, e.target.value].join(', ') })
              }}
            >
              <option value="">+ from datasheet…</option>
              {wargear.map((w) => <option key={w}>{w}</option>)}
            </select>
          )}
          <button type="button" className="btn btn-danger" aria-label="Remove magnet slot" onClick={() => onChange(slots.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button type="button" className="btn w-fit" onClick={() => onChange([...slots, { slot: '', options: '' }])}>+ Magnet slot</button>
    </div>
  )
}
