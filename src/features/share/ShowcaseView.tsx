import { useEffect, useMemo, useState } from 'react'
import { useTx } from '../../i18n'
import { decodeShare } from '../../domain/schemes/share'
import { parseShowcase, percent, showcaseSummary, type Progress, type Showcase } from '../../domain/share/showcase'

function Bar({ p, stages, label }: { p: Progress; stages: string[]; label: string }) {
  const tx = useTx()
  return (
    <div className="flex h-3 w-full overflow-hidden rounded bg-panel-2" role="img" aria-label={tx('{{label}}: {{pct}}% painted', { label, pct: percent(p) })}>
      {p.byStage.map((n, i) =>
        n ? <span key={i} title={`${stages[i]}: ${n}`} style={{ width: `${(n / p.models) * 100}%`, opacity: 0.25 + (0.75 * (i + 1)) / stages.length }} className="bg-accent" /> : null,
      )}
    </div>
  )
}

/** Someone's collection from a share link (#97): read-only, nothing is saved here. */
export function ShowcaseView({ token, onClose }: { token: string; onClose: () => void }) {
  const tx = useTx()
  const [s, setS] = useState<Showcase>()
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => {
    decodeShare(token).then((t) => setS(parseShowcase(t)), (e: Error) => setErr(e.message)).catch((e: Error) => setErr(e.message))
  }, [token])
  const sum = useMemo(() => (s ? showcaseSummary(s) : undefined), [s])

  const title = s?.owner ? tx("{{name}}'s collection", { name: s.owner }) : tx('A MiniTracker collection')
  useEffect(() => {
    document.title = `${title} · MiniTracker`
  }, [title])

  if (err)
    return (
      <main className="mx-auto grid max-w-xl gap-3 p-4">
        <p className="text-danger" role="alert">{err}</p>
        <button className="btn w-fit" onClick={onClose}>{tx('Open MiniTracker')}</button>
      </main>
    )
  if (!s || !sum) return <p className="p-4 text-muted">{tx('Opening…')}</p>
  const match = (u: Showcase['units'][number]) => !q || `${u[0]} ${u[1]}`.toLowerCase().includes(q.toLowerCase())

  return (
    <main className="mx-auto grid max-w-3xl gap-4 p-4" aria-label={tx('Shared collection')}>
      <header className="flex flex-wrap items-center gap-2">
        <div className="flex-1">
          <h1 className="font-display text-2xl text-accent">{title}</h1>
          <p className="text-xs text-muted">{s.at ? tx('Read-only snapshot from {{date}}.', { date: new Date(s.at).toLocaleDateString() }) : tx('Read-only snapshot.')} {tx('Nothing from this page is saved on your device.')}</p>
        </div>
        <button className="btn" onClick={onClose}>{tx('Open my MiniTracker')}</button>
      </header>

      <section className="panel grid gap-2 p-4" aria-label={tx('Progress')}>
        <p className="font-display text-3xl tabular-nums">{percent(sum.total)}% <span className="text-base text-muted">{tx('painted · {{done}} of {{total}} models', { done: sum.total.painted, total: sum.total.models })}</span></p>
        <Bar p={sum.total} stages={s.stages} label={tx('All')} />
        <ul className="flex flex-wrap gap-x-3 text-xs text-muted">{s.stages.map((st, i) => sum.total.byStage[i] ? <li key={st}>{st} {sum.total.byStage[i]}</li> : null)}</ul>
        <div className="mt-2 grid gap-2">
          {sum.factions.map((f) => (
            <div key={f.faction} className="grid gap-1 text-sm">
              <div className="flex justify-between"><span>{f.faction}</span><span className="tabular-nums text-muted">{percent(f)}% · {f.painted}/{f.models}</span></div>
              <Bar p={f} stages={s.stages} label={f.faction} />
            </div>
          ))}
        </div>
      </section>

      <section className="panel grid gap-2 p-4" aria-label={tx('Units')}>
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg">{tx('Units ({{n}})', { n: s.units.length })}</h2>
          <input className="input ml-auto w-48" placeholder={tx('Search')} aria-label={tx('Search units')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted"><tr><th>{tx('Unit')}</th><th>{tx('Faction')}</th><th className="text-right">{tx('Painted')}</th><th>{tx('Stages')}</th></tr></thead>
          <tbody>
            {s.units.filter(match).map((u, i) => {
              const models = u[2].reduce((a, b) => a + b, 0)
              const painted = u[2].slice(s.painted).reduce((a, b) => a + b, 0)
              return (
                <tr key={i} className="border-t border-line">
                  <td className="py-1">{u[0]}</td>
                  <td className="text-muted">{u[1]}</td>
                  <td className="text-right tabular-nums">{painted}/{models}</td>
                  <td className="pl-3 text-xs text-muted">{u[2].flatMap((n, k) => (n ? [`${s.stages[k]} ${n}`] : [])).join(' · ')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </main>
  )
}
