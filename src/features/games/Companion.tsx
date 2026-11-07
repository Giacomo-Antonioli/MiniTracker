import { useEffect, useState } from 'react'
import { ctx, useStore } from '../../app/store'
import { formatRuleText } from '../../domain/catalogue/rules'
import type { Datasheet } from '../../domain/catalogue/types'
import { abilitiesNow, clockTotals, damage, fullWounds, nextPhase, pauseClock, PHASES, startClock, stratagemsNow, woundsLeft } from '../../domain/games/companion'
import { addPoints, setCp, totals, type Game } from '../../domain/games/games'
import { stratagemsFor } from '../../domain/stratagems/stratagems'
import { defaultLoadout } from '../../domain/lists/loadout'
import type { ListEntry } from '../../domain/lists/types'
import { GamePhotos } from './GamePhotos'
import { DiceRoller } from '../dice/DiceRoller'
import { useTx, txr } from '../../i18n'
import { LiveStatus, ShareLive } from './LiveShare'
import { currentLive } from '../../data/liveSession'

const Text = ({ text }: { text: string }) => <>{formatRuleText(text).map((p, i) => (p.bold ? <b key={i}>{p.text}</b> : p.text))}</>
const time = (msec: number) => {
  const s = Math.floor(msec / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** A phase's name in the chosen language (the English name stays the key in the game's data). */
const phaseName = (p: (typeof PHASES)[number]) => (p === 'Command' ? txr('Command') : p === 'Movement' ? txr('Movement') : p === 'Shooting' ? txr('Shooting') : p === 'Charge' ? txr('Charge') : txr('Fight'))

/** Model types of a list unit (its loadout, else the default one) with their counts. */
function modelTypes(e: ListEntry, d: Datasheet) {
  const rows = e.loadout ?? (d.models?.length ? defaultLoadout(d, e.models) : [])
  return rows.flatMap((r) => {
    const m = d.models?.find((x) => x.id === r.modelId)
    return m ? [{ name: m.name, count: r.count }] : []
  })
}

/** Phone-friendly match companion for the live game (#72). */
export function Companion({ game: g, onExit }: { game: Game; onExit: () => void }) {
  const tx = useTx()
  const { saveGame, lists, catalogue, stratagemData } = useStore()
  const [now, setNow] = useState(() => new Date().toISOString())
  const [open, setOpen] = useState<string | null>(null)
  const [dice, setDice] = useState(false)
  const [sharing, setSharing] = useState(false)
  useEffect(() => {
    if (!g.clock?.since) return
    const t = setInterval(() => setNow(new Date().toISOString()), 1000)
    return () => clearInterval(t)
  }, [g.clock?.since])
  const save = (next: Game) => void saveGame(next)
  const c = () => ctx()
  const phase = PHASES[g.phase ?? 0]
  const myTurn = g.turn === 'me'
  const list = lists.find((l) => l.id === g.me.listId)
  const sheets = new Map(catalogue?.datasheets.map((d) => [d.id, d]) ?? [])
  const units = (list?.entries ?? []).map((e) => ({ entry: e, d: sheets.get(e.datasheetId) })).filter((x): x is { entry: typeof x.entry; d: Datasheet } => !!x.d)
  const detachments = (catalogue?.detachments ?? []).filter((d) => list?.detachmentIds?.includes(d.id)).map((d) => d.name)
  const strat = stratagemData ? stratagemsFor(detachments, stratagemData, list?.stratagemDetachments) : undefined
  const usable = strat ? stratagemsNow([...strat.detachments.flatMap((d) => d.stratagems), ...strat.core], myTurn, phase) : []
  const rules = strat ? abilitiesNow(strat.detachments.flatMap((d) => d.rules), phase, myTurn) : []
  const catRules = new Map(catalogue?.rules?.map((r) => [r.id, r]) ?? [])
  // Each living unit's abilities and the core/faction rules on its datasheet; a rule shared by several units shows once.
  const unitRules = units
    .filter((u) => !g.me.destroyed.includes(u.entry.id))
    .flatMap((u) => [
      ...Object.entries(u.d.abilityTexts ?? {}).map(([name, text]) => ({ unit: u.d.name, name, text })),
      ...(u.d.ruleIds ?? []).flatMap((id) => (catRules.get(id) ? [{ unit: catRules.get(id)!.kind === 'core' ? 'Core' : 'Army', name: catRules.get(id)!.name, text: catRules.get(id)!.text }] : [])),
    ])
  const seen = new Set<string>()
  const abilities = abilitiesNow(unitRules, phase, myTurn).filter((a) => {
    const k = a.unit === 'Core' || a.unit === 'Army' ? a.name : `${a.unit}-${a.name}`
    return !seen.has(k) && !!seen.add(k)
  })
  const clock = clockTotals(g, now)
  const me = totals(g.me).total
  const them = totals(g.them).total

  return (
    <div className="mx-auto grid max-w-md gap-3 pb-24" aria-label={tx('Companion')}>
      <header className="panel sticky top-0 z-10 grid gap-2 p-3">
        <div className="flex items-center justify-between">
          <span className="font-display text-lg">{tx('Round {{n}}', { n: g.round })} · {myTurn ? tx('Your turn') : tx("{{name}}'s turn", { name: g.them.name })}</span>
          <span className="font-display text-2xl tabular-nums text-accent" aria-label={tx('Score')}>{me}–{them}</span>
        </div>
        <LiveStatus game={g} />
        <ol className="flex gap-1 text-xs" aria-label={tx('Phases')}>
          {PHASES.map((p) => (
            <li key={p} aria-current={p === phase ? 'step' : undefined} className={`flex-1 rounded py-1 text-center ${p === phase ? 'bg-accent text-accent-fg' : 'bg-panel-2 text-muted'}`}>{phaseName(p)}</li>
          ))}
        </ol>
        <div className="flex items-center gap-2 text-sm">
          <span aria-label={tx('My CP')}>{tx('CP')} {g.me.cp}</span>
          <button className="btn px-2 py-0" aria-label={tx('My CP −1')} onClick={() => save(setCp(g, 'me', -1, c()))}>−</button>
          <button className="btn px-2 py-0" aria-label={tx('My CP +1')} onClick={() => save(setCp(g, 'me', 1, c()))}>+</button>
          <span className="ml-auto tabular-nums" aria-label={tx('Clock')}>⏱ {time(clock.me)} / {time(clock.them)} · {time(clock.total)}</span>
          <button className="btn px-2 py-0" aria-label={clock.running ? tx('Pause clock') : tx('Start clock')} onClick={() => save(clock.running ? pauseClock(g, c()) : startClock(g, c()))}>{clock.running ? '⏸' : '▶'}</button>
        </div>
      </header>

      <section className="panel grid gap-2 p-3" aria-label={tx('Now')}>
        <h2 className="font-display">{tx('Now: {{phase}} phase', { phase: phaseName(phase) })}</h2>
        {phase === 'Command' && myTurn && <p className="text-sm text-muted">{tx('Score primary objectives and check Battle-shock.')}</p>}
        <div className="flex flex-wrap gap-2">
          <button className="btn px-2 py-0.5 text-sm" onClick={() => save(addPoints(g, 'me', 'primary', 1, c()))}>{tx('My primary +1')}</button>
          <button className="btn px-2 py-0.5 text-sm" onClick={() => save(addPoints(g, 'me', 'secondary', 1, c()))}>{tx('My secondary +1')}</button>
          <button className="btn px-2 py-0.5 text-sm" onClick={() => save(addPoints(g, 'them', 'primary', 1, c()))}>{tx('Their VP +1')}</button>
        </div>
        {rules.map((r) => <p key={r.id} className="text-sm"><b>{r.name}:</b> <Text text={r.text} /></p>)}
        {abilities.map((a) => <p key={`${a.unit}-${a.name}`} className="text-sm"><b>{a.unit} · {a.name}:</b> <Text text={a.text} /></p>)}
        {stratagemData ? (
          <div className="grid gap-1.5" aria-label={tx('Stratagems now')}>
            <h3 className="text-xs uppercase tracking-wider text-muted">{tx('Stratagems ({{n}})', { n: usable.length })}</h3>
            {usable.map((s) => (
              <details key={s.id} className="rounded border border-line p-2 text-sm">
                <summary className="flex cursor-pointer items-center gap-2">
                  <span className="flex-1 font-semibold">{s.name}</span>
                  <span className="text-xs text-muted">{tx('{{n}} CP', { n: s.cp })}</span>
                  <button
                    className="btn px-2 py-0 text-xs"
                    disabled={g.me.cp < Number(s.cp)}
                    onClick={(e) => {
                      e.preventDefault()
                      save(setCp(g, 'me', -Number(s.cp), c()))
                    }}
                  >
                    {tx('Use')}
                  </button>
                </summary>
                <p className="mt-1 whitespace-pre-line text-xs"><Text text={s.text} /></p>
              </details>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted">{tx('Import stratagems in Settings → Catalogue to see the ones you can use now.')}</p>
        )}
      </section>

      <section className="grid gap-2" aria-label={tx('My units')}>
        {units.map(({ entry, d }) => {
          const full = fullWounds(entry.models, d.stats, modelTypes(entry, d))
          const w = woundsLeft(g, entry.id, full)
          const dead = g.me.destroyed.includes(entry.id)
          return (
            <article key={entry.id} className={`panel grid gap-2 p-3 ${dead ? 'opacity-50' : ''}`} aria-label={tx('{{name}} unit', { name: d.name })}>
              <div className="flex items-center gap-2">
                <button className="flex-1 text-left font-semibold" onClick={() => setOpen(open === entry.id ? null : entry.id)}>{dead ? '☠ ' : ''}{d.name}</button>
                <button className="btn h-9 w-9 p-0 text-lg" aria-label={tx('{{name}}: one wound', { name: d.name })} onClick={() => save(damage(g, entry.id, full, -1, c()))}>−</button>
                <button className="btn h-9 w-9 p-0 text-lg" aria-label={tx('{{name}}: heal one wound', { name: d.name })} onClick={() => save(damage(g, entry.id, full, 1, c()))}>+</button>
              </div>
              <div className="flex flex-wrap gap-1" aria-label={tx('{{name}} wounds', { name: d.name })}>
                {w.map((v, i) => (
                  <span key={i} className={`rounded px-1.5 text-xs tabular-nums ${v === 0 ? 'bg-panel-2 text-muted line-through' : v < full[i] ? 'bg-danger/30' : 'bg-accent/20'}`}>{v}/{full[i]}</span>
                ))}
              </div>
              {open === entry.id && (
                <div className="grid gap-1 text-xs">
                  {d.stats?.map((s) => <p key={s.name} className="tabular-nums">{s.values.map(([k, v]) => `${k} ${v}`).join(' · ')}</p>)}
                  {d.weapons?.map((wp) => <p key={wp.name}><b>{wp.name}</b> {wp.values.map(([k, v]) => `${k} ${v}`).join(' · ')}</p>)}
                </div>
              )}
            </article>
          )
        })}
        {!units.length && <p className="text-sm text-muted">{tx('Start the game from an army list to track your units here.')}</p>}
      </section>

      <div className="panel p-3"><GamePhotos game={g} /></div>

      {dice && <DiceRoller onClose={() => setDice(false)} />}
      {sharing && <ShareLive game={g} onClose={() => setSharing(false)} />}
      <footer className="fixed inset-x-0 bottom-0 z-10 flex justify-center gap-2 border-t border-line bg-panel p-3">
        <button className="btn" onClick={onExit}>{tx('Score board')}</button>
        <button className="btn" onClick={() => setDice(true)}>{tx('🎲 Dice')}</button>
        {!currentLive()?.game && g.status === 'live' && <button className="btn" onClick={() => setSharing(true)}>{tx('📡 Share live')}</button>}
        <button className="btn btn-primary px-6 text-lg" disabled={g.round === 5 && g.turn !== g.first && phase === 'Fight'} onClick={() => save(nextPhase(g, c()))}>
          {phase === 'Fight' ? tx('Next turn ▶') : `${phaseName(PHASES[(g.phase ?? 0) + 1])} ▶`}
        </button>
      </footer>
    </div>
  )
}
