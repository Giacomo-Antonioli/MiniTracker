import type { Catalogue, Datasheet, StatLine } from '../../domain/catalogue/types'
import { ruleForKeyword } from '../../domain/catalogue/rules'
import { RuleText } from '../rules/RuleText'
import { useTx } from '../../i18n'

const h3 = 'text-xs font-semibold uppercase tracking-wider text-muted'

function ProfileTable({ title, rows, label }: { title: string; rows: StatLine[]; label: string }) {
  const tx = useTx()
  if (!rows.length) return null
  const cols = rows[0].values.map(([c]) => c)
  return (
    <div className="grid gap-1 overflow-x-auto">
      <h4 className="text-xs text-muted">{title}</h4>
      <table className="text-xs" aria-label={label}>
        <thead>
          <tr className="text-left text-muted">
            <th className="pr-2 font-normal">{tx('Name')}</th>
            {cols.map((c) => <th key={c} className="px-1 font-normal">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-line/50 align-top">
              <td className="pr-2 font-semibold">{r.name}</td>
              {r.values.map(([c, v]) => <td key={c} className={`px-1 ${c === 'Keywords' ? 'min-w-32' : 'whitespace-nowrap'}`}>{v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** What the catalogue says about a datasheet: stats, weapons, abilities, rules, wargear and keywords. */
export function DatasheetInfo({ catalogue, d }: { catalogue: Catalogue; d: Datasheet }) {
  const tx = useTx()
  const tags = (title: string, items: string[]) =>
    items.length > 0 && (
      <section className="border-b border-line p-4">
        <h3 className={`mb-2 ${h3}`}>{title}</h3>
        <div className="flex flex-wrap gap-1">
          {items.map((x) => <span key={x} className="rounded bg-panel-2 px-2 py-0.5 text-xs">{x}</span>)}
        </div>
      </section>
    )
  const ranged = (d.weapons ?? []).filter((w) => w.kind === 'ranged')
  const melee = (d.weapons ?? []).filter((w) => w.kind === 'melee')

  return (
    <>
      {(d.stats?.length ?? 0) > 0 && (
        <section className="grid gap-2 border-b border-line p-4" aria-label={tx('Stats')}>
          <h3 className={h3}>{tx('Stats')}</h3>
          <ProfileTable title="" rows={d.stats!} label={tx('Stat lines')} />
        </section>
      )}
      {(ranged.length > 0 || melee.length > 0) && (
        <section className="grid gap-3 border-b border-line p-4" aria-label={tx('Weapons')}>
          <h3 className={h3}>{tx('Weapons')}</h3>
          <ProfileTable title={tx('Ranged')} rows={ranged} label={tx('Ranged weapons')} />
          <ProfileTable title={tx('Melee')} rows={melee} label={tx('Melee weapons')} />
        </section>
      )}
      {d.abilities.length > 0 && (
        <section className="grid gap-2 border-b border-line p-4" aria-label={tx('Abilities')}>
          <h3 className={h3}>{tx('Abilities')}</h3>
          {d.abilities.map((a) => <RuleText key={a} name={a} text={d.abilityTexts?.[a]} />)}
        </section>
      )}
      {(d.ruleIds?.length ?? 0) > 0 && (
        <section className="grid gap-2 border-b border-line p-4" aria-label={tx('Rules')}>
          <h3 className={h3}>{tx('Rules')}</h3>
          {d.ruleIds!.map((id) => {
            const r = catalogue.rules?.find((x) => x.id === id)
            return r ? <RuleText key={id} name={r.name} text={r.text} /> : null
          })}
        </section>
      )}
      {(d.weaponKeywords?.length ?? 0) > 0 && (
        <section className="grid gap-2 border-b border-line p-4" aria-label={tx('Weapon abilities')}>
          <h3 className={h3}>{tx('Weapon abilities')}</h3>
          {d.weaponKeywords!.map((k) => {
            const r = ruleForKeyword(catalogue.rules ?? [], k)
            return <RuleText key={k} name={k} text={r?.text} />
          })}
        </section>
      )}
      {(!catalogue.rules || (catalogue.formatVersion ?? 0) < 5) && (
        <p className="border-b border-line p-4 text-xs text-muted">{catalogue.rules ? tx('Download the catalogue again (Settings → Catalogue data) to see stats and weapon profiles.') : tx('Download the catalogue again (Settings → Catalogue data) to see what each ability and rule means, stats and weapons.')}</p>
      )}
      {tags(tx('Wargear options'), d.wargear)}
      {tags(tx('Keywords'), d.keywords)}
      {tags(tx('Faction keywords'), d.factionKeywords)}
    </>
  )
}
