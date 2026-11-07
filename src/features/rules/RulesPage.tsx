import { useMemo, useState } from 'react'
import { useStore } from '../../app/store'
import { datasheetsWithRule } from '../../domain/catalogue/rules'
import { useTx } from '../../i18n'
import { RuleText } from './RuleText'

export function RulesPage({ onOpenSettings, onOpenDatasheet }: { onOpenSettings: () => void; onOpenDatasheet: (id: string) => void }) {
  const tx = useTx()
  const { catalogue, downloadCatalogue, catalogueJob } = useStore()
  const groupName = (g: string) => (g === 'Core rules' ? tx('Core rules') : g === 'Other faction rules' ? tx('Other faction rules') : g)
  const [text, setText] = useState('')
  const [group, setGroup] = useState('')
  const [usersOf, setUsersOf] = useState<string | null>(null)
  const rules = catalogue?.rules

  const groups = useMemo(() => {
    if (!catalogue || !rules) return []
    const words = text.toLowerCase().split(/\s+/).filter(Boolean)
    const factionName = (id?: string) => catalogue.factions.find((f) => f.id === id)?.name ?? 'Other faction rules'
    const map = new Map<string, typeof rules>()
    for (const r of rules) {
      const g = r.kind === 'core' ? 'Core rules' : factionName(r.factionId)
      if (group && g !== group) continue
      if (!words.every((w) => `${r.name} ${r.text}`.toLowerCase().includes(w))) continue
      map.set(g, [...(map.get(g) ?? []), r])
    }
    return [...map.entries()].sort(([a], [b]) => (a === 'Core rules' ? -1 : b === 'Core rules' ? 1 : a.localeCompare(b)))
  }, [catalogue, rules, text, group])

  const allGroups = useMemo(() => {
    if (!catalogue || !rules) return []
    const names = new Set(rules.map((r) => (r.kind === 'core' ? 'Core rules' : catalogue.factions.find((f) => f.id === r.factionId)?.name ?? 'Other faction rules')))
    return [...names].sort((a, b) => (a === 'Core rules' ? -1 : b === 'Core rules' ? 1 : a.localeCompare(b)))
  }, [catalogue, rules])

  if (!catalogue) {
    return (
      <div className="grid max-w-xl gap-3">
        <h1 className="font-display text-2xl text-accent" data-tour="rules-title">{tx('Rules')}</h1>
        <p className="text-muted">{tx('No unit catalogue installed yet. Rules come with it.')}</p>
        <button className="btn btn-primary w-fit" onClick={onOpenSettings}>{tx('Go to Settings → Catalogue data')}</button>
      </div>
    )
  }
  if (!rules) {
    return (
      <div className="grid max-w-xl gap-3">
        <h1 className="font-display text-2xl text-accent" data-tour="rules-title">{tx('Rules')}</h1>
        <p className="text-muted">{tx('Your catalogue was downloaded before rules were supported. Download it again to get every rule and ability explained.')}</p>
        <button className="btn btn-primary w-fit" disabled={catalogueJob.phase !== 'idle'} onClick={() => void downloadCatalogue(catalogue.source.repo === 'local files' ? undefined : catalogue.source.repo)}>
          {catalogueJob.phase === 'idle' ? tx('⬇ Download again') : tx('Downloading…')}
        </button>
      </div>
    )
  }

  const total = groups.reduce((n, [, list]) => n + list.length, 0)
  return (
    <div className="grid max-w-4xl gap-4">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-2xl text-accent" data-tour="rules-title">{tx('Rules')}</h1>
        <span className="text-sm text-muted">{tx('{{n}} of {{total}} rules', { n: total, total: rules.length })} · {catalogue.gameName}</span>
      </header>
      <section className="flex flex-wrap gap-2" aria-label={tx('Rule filters')}>
        <input className="input w-64" placeholder={tx('🔍 Search name or text')} value={text} onChange={(e) => setText(e.target.value)} />
        <select className="input" aria-label={tx('Group')} value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">{tx('All groups')}</option>
          {allGroups.map((g) => <option key={g} value={g}>{groupName(g)}</option>)}
        </select>
      </section>
      {groups.map(([g, list]) => (
        <section key={g} className="panel grid gap-3 p-4" aria-label={groupName(g)}>
          <h2 className="font-display text-lg">{groupName(g)} <span className="text-sm text-muted">({list.length})</span></h2>
          {list.map((r) => {
            const users = usersOf === r.id ? datasheetsWithRule(catalogue, r) : null
            return (
              <div key={r.id} className="grid gap-1 border-t border-line pt-2 first:border-0 first:pt-0">
                <RuleText name={r.name} text={r.text} />
                <button className="w-fit text-xs text-muted underline" onClick={() => setUsersOf(usersOf === r.id ? null : r.id)}>
                  {users ? tx('Hide units') : tx('Which units have it?')}
                </button>
                {users && (
                  <p className="text-xs">
                    {users.length === 0
                      ? tx('No units found.')
                      : users.slice(0, 60).map((d, i) => (
                          <span key={d.id}>
                            {i > 0 && ', '}
                            <button className="text-accent underline" onClick={() => onOpenDatasheet(d.id)}>{d.name}</button>
                          </span>
                        ))}
                    {users.length > 60 && ` ${tx('and {{n}} more', { n: users.length - 60 })}`}
                  </p>
                )}
              </div>
            )
          })}
        </section>
      ))}
      {total === 0 && <p className="text-center text-muted">{tx('No rules match.')}</p>}
    </div>
  )
}
