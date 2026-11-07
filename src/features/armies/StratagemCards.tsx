import { formatRuleText } from '../../domain/catalogue/rules'
import type { DetachmentRule, Stratagem } from '../../domain/stratagems/stratagems'
import { useTx } from '../../i18n'

const Text = ({ text }: { text: string }) => (
  <>{formatRuleText(text).map((p, i) => (p.bold ? <b key={i}>{p.text}</b> : p.text))}</>
)

function Card({ s }: { s: Stratagem }) {
  const tx = useTx()
  return (
    <article aria-label={tx('{{name}} stratagem', { name: s.name })} className="rounded border-2 border-black p-2 text-[8pt]" style={{ breakInside: 'avoid' }}>
      <header className="flex items-start justify-between gap-2 border-b border-black pb-0.5">
        <h3 className="text-[9.5pt] font-bold uppercase leading-tight">{s.name}</h3>
        <span className="shrink-0 rounded-full border-2 border-black px-1.5 text-[9pt] font-bold">{tx('{{n}} CP', { n: s.cp })}</span>
      </header>
      <p className="mt-0.5 text-[7pt] italic">{s.type} · {s.turn} · {s.phase}</p>
      <p className="mt-1 whitespace-pre-line"><Text text={s.text} /></p>
    </article>
  )
}

/** Stratagem cards per detachment, with its rules first, and the core stratagems (data from Wahapedia). */
export function StratagemCards({ detachments, core }: { detachments: { name: string; rules: DetachmentRule[]; stratagems: Stratagem[] }[]; core: Stratagem[] }) {
  const tx = useTx()
  const groups = [...detachments.filter((d) => d.stratagems.length || d.rules.length), { name: tx('Core stratagems'), rules: [], stratagems: core }]
  return (
    <section aria-label={tx('Stratagem cards')} style={{ breakBefore: 'page' }}>
      {groups.map((g) => (
        <div key={g.name} className="mt-3">
          <h2 className="border-b-2 border-black text-lg font-bold">{g.name}</h2>
          {g.rules.map((r) => (
            <div key={r.id} className="mt-1 text-[8.5pt]" style={{ breakInside: 'avoid' }}>
              <b className="uppercase">{r.name}:</b> <span className="whitespace-pre-line"><Text text={r.text} /></span>
            </div>
          ))}
          <div className="mt-2 grid grid-cols-3 gap-2">
            {g.stratagems.map((s) => <Card key={s.id} s={s} />)}
          </div>
        </div>
      ))}
      <p className="mt-3 text-[7pt]">{tx('Stratagems and detachment rules powered by Wahapedia.')}</p>
    </section>
  )
}
