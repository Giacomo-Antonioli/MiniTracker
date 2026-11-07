import { formatRuleText } from '../../domain/catalogue/rules'
import type { Rule, WeaponProfile } from '../../domain/catalogue/types'
import type { UnitCard } from '../../domain/lists/cards'
import { txr } from '../../i18n'

/** Rule text from the data: **bold** markers become bold. */
function RuleText({ text }: { text: string }) {
  return <>{formatRuleText(text).map((p, i) => (p.bold ? <b key={i}>{p.text}</b> : p.text))}</>
}

/** What each rule and keyword on the cards means. */
export function KeywordLegend({ rules }: { rules: Rule[] }) {
  if (!rules.length) return null
  return (
    <section aria-label={txr('Keyword legend')} className="mt-4" style={{ breakInside: 'avoid-page' }}>
      <h2 className="border-b-2 border-black text-lg font-bold">{txr('Rules and keywords')}</h2>
      <dl className="mt-1 grid gap-1 text-[8.5pt]" style={{ columns: 2, columnGap: '6mm' }}>
        {rules.map((r) => (
          <div key={r.id} style={{ breakInside: 'avoid' }} className="mb-1">
            <dt className="font-bold uppercase">{r.name}</dt>
            <dd><RuleText text={r.text} /></dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function Weapons({ title, rows }: { title: string; rows: WeaponProfile[] }) {
  if (!rows.length) return null
  const cols = rows[0].values.map(([k]) => k)
  return (
    <table className="mt-1 w-full border-collapse text-[9pt]">
      <thead>
        <tr className="border-b border-black text-left">
          <th className="py-0.5 pr-1">{title}</th>
          {cols.map((c) => <th key={c} className={`px-1 py-0.5 ${c === 'Keywords' ? 'text-left' : 'text-center'}`}>{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((w) => (
          <tr key={w.name} className="border-b border-black/20 align-top">
            <td className="py-0.5 pr-1">{w.name}</td>
            {cols.map((c) => {
              const v = w.values.find(([k]) => k === c)?.[1] ?? '–'
              return <td key={c} className={`px-1 py-0.5 ${c === 'Keywords' ? 'text-[8pt]' : 'text-center'}`}>{v}</td>
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** "Warlord: 1 model, 150 pts · 3 × 1 model, 150 pts": identical entries are counted once. */
export function entryLine(entries: UnitCard['entries']): string {
  const parts = entries.map((e) => [e.warlord && txr('Warlord'), e.models === 1 ? txr('1 model') : txr('{{n}} models', { n: e.models }), e.points !== undefined && txr('{{n}} pts', { n: e.points }), e.enhancement && `${e.enhancement.name} (+${e.enhancement.points})`].filter(Boolean).join(', '))
  const counts = new Map<string, number>()
  parts.forEach((p) => counts.set(p, (counts.get(p) ?? 0) + 1))
  return [...counts].map(([p, n]) => (n > 1 ? `${n} × ${p}` : p)).join(' · ')
}

/** Printable datasheet cards, two to an A4 page; a long card takes its own page (#98). */
export function DatasheetCards({ cards }: { cards: UnitCard[] }) {
  return (
    <div aria-label={txr('Datasheet cards')}>
      {cards.map((c) => {
        const d = c.datasheet
        const pts = c.entries.reduce((n, e) => n + (e.points ?? 0) + (e.enhancement?.points ?? 0), 0)
        return (
          <article key={d.id} aria-label={txr('{{name}} card', { name: d.name })} className="mt-4 rounded border-2 border-black p-3" style={{ breakInside: 'avoid' }}>
            <header className="flex items-baseline justify-between gap-2 border-b-2 border-black pb-1">
              <h2 className="text-lg font-bold uppercase tracking-wide">{d.name}{c.entries.length > 1 ? ` ×${c.entries.length}` : ''}</h2>
              <span className="text-sm font-bold">{txr('{{n}} pts', { n: pts })}</span>
            </header>
            <p className="mt-0.5 text-[8pt]">{entryLine(c.entries)}</p>
            {d.stats?.map((s) => (
              <table key={s.name} className="mt-1 border-collapse text-center text-[9pt]">
                <thead><tr>{d.stats!.length > 1 && <th />}{s.values.map(([k]) => <th key={k} className="w-10 border border-black px-1">{k}</th>)}</tr></thead>
                <tbody><tr>{d.stats!.length > 1 && <td className="pr-2 text-left text-[8pt]">{s.name}</td>}{s.values.map(([k, v]) => <td key={k} className="border border-black px-1 font-bold">{v}</td>)}</tr></tbody>
              </table>
            ))}
            <Weapons title={txr('Ranged weapons')} rows={c.weapons.filter((w) => w.kind === 'ranged')} />
            <Weapons title={txr('Melee weapons')} rows={c.weapons.filter((w) => w.kind === 'melee')} />
            {(c.rules.length > 0 || c.abilities.length > 0) && (
              <div className="mt-1.5 grid gap-0.5 text-[8.5pt]">
                {c.rules.length > 0 && <p><b>{txr('Core:')}</b> {c.rules.join(', ')}</p>}
                {c.abilities.map((a) => <p key={a.name}><b>{a.name}{a.text ? ':' : ''}</b> {a.text && <RuleText text={a.text} />}</p>)}
              </div>
            )}
            <footer className="mt-1.5 border-t border-black pt-0.5 text-[7.5pt] uppercase">
              <span className="font-bold">{txr('Keywords:')}</span> {d.keywords.join(', ')}{d.factionKeywords.length > 0 && <> · <span className="font-bold">{txr('Faction:')}</span> {d.factionKeywords.join(', ')}</>}
            </footer>
          </article>
        )
      })}
    </div>
  )
}
