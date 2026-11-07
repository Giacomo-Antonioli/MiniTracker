import { EDITIONS, gameOfRepo } from '../../domain/catalogue/editions'
import { GamePhotos } from './GamePhotos'
import { DiceRoller } from '../dice/DiceRoller'
import { WhoGoesFirst } from '../dice/WhoGoesFirst'
import { ListQrRead } from '../armies/ListQr'
import { DEPLOYMENTS, DISPOSITIONS, draw, isDisposition, MISSION_PACK, PRIMARIES, primaries, TWISTS, type Disposition } from '../../domain/games/missions'
import { useState } from 'react'
import { ctx, useStore } from '../../app/store'
import { editionOfRepo } from '../../data/catalogue/fetch'
import type { Catalogue } from '../../domain/catalogue/types'
import { addPoints, endGame, gameStats, newGame, result, ROUNDS, setCp, toggleDestroyed, totals, type Game, type SideKey, type StatRow } from '../../domain/games/games'
import type { ArmyList } from '../../domain/lists/types'
import { importListFile } from '../armies/ImportForm'
import { advanceTurn } from '../../domain/games/companion'
import { Companion } from './Companion'
import { JoinLive, LiveStatus } from './LiveShare'
import { useTx } from '../../i18n'

const RESULT_CLASS = { win: 'text-ok', loss: 'text-danger', draw: 'text-muted' } as const

/** Games (#71): start one, keep score live, then look back at the history and results. */
export function GamesPage() {
  const tx = useTx()
  const { games } = useStore()
  const live = games.find((g) => g.status === 'live')
  const [starting, setStarting] = useState(false)
  const [companion, setCompanion] = useState(false)
  const [joining, setJoining] = useState(false)
  if (live && companion) return <Companion game={live} onExit={() => setCompanion(false)} />
  return (
    <div className="grid gap-4">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-accent" data-tour="games-title">{tx('Games')}</h1>
        {!live && !starting && <button className="btn btn-primary" data-tour="new-game" onClick={() => setStarting(true)}>{tx('▶ New game')}</button>}
        {!live && !starting && <button className="btn" onClick={() => setJoining(true)}>{tx('📡 Join live game')}</button>}
        {live && <LiveStatus game={live} />}
      </header>
      {joining && <JoinLive onClose={() => setJoining(false)} onJoined={() => setCompanion(true)} />}
      {live ? <LiveGame game={live} onCompanion={() => setCompanion(true)} /> : starting && <NewGameForm onCancel={() => setStarting(false)} onStarted={() => setStarting(false)} />}
      <History />
    </div>
  )
}

function NewGameForm({ onCancel, onStarted }: { onCancel: () => void; onStarted: () => void }) {
  const tx = useTx()
  const { lists, catalogue, saveGame } = useStore()
  const [listId, setListId] = useState(lists[0]?.id ?? '')
  const [opponent, setOpponent] = useState('')
  const [faction, setFaction] = useState('')
  const [mission, setMission] = useState('')
  const [deployment, setDeployment] = useState('')
  const [theirMission, setTheirMission] = useState('')
  const [twist, setTwist] = useState('')
  const [disp, setDisp] = useState<{ me?: Disposition; them?: Disposition }>({})
  const pickDisp = (k: 'me' | 'them', v: string) => {
    const next = { ...disp, [k]: isDisposition(v) ? v : undefined }
    setDisp(next)
    if (next.me && next.them) {
      const p = primaries(next.me, next.them)
      setMission(p.me)
      setTheirMission(p.them)
    }
  }
  const [first, setFirst] = useState<SideKey>('me')
  const [theirList, setTheirList] = useState<ArmyList | undefined>()
  const [decide, setDecide] = useState<'roll' | 'coin' | null>(null)
  const [readQr, setReadQr] = useState(false)
  const pickTheirs = (l: ArmyList) => {
    setTheirList(l)
    if (!faction) setFaction(factionName(catalogue, l.factionId) ?? '')
  }
  const [error, setError] = useState('')
  const mine = lists.find((l) => l.id === listId)
  // Mission cards are 40k's (#194); other games (#99) type their mission.
  const game = mine ? (EDITIONS.find((e) => e.key === mine.edition)?.game ?? '40k') : catalogue ? gameOfRepo(catalogue.source.repo) : '40k'
  const is40k = game === '40k'
  const factionName = (c: Catalogue | null, id?: string) => c?.factions.find((f) => f.id === id)?.name

  const load = async (f: File) => {
    setError('')
    try {
      if (!catalogue) throw new Error(tx('Install a catalogue first (Settings → Catalogue)'))
      const edition = editionOfRepo(catalogue.source.repo)?.key ?? '11e'
      const r = await importListFile(f, catalogue, edition)
      pickTheirs(r.list)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <form
      className="panel grid gap-3 p-4"
      aria-label={tx('New game')}
      data-tour="new-game-form"
      onSubmit={(e) => {
        e.preventDefault()
        void saveGame(newGame({ myListId: mine?.id, myFaction: factionName(catalogue, mine?.factionId), opponent, theirFaction: faction, theirList, mission, theirMission, deployment, twist, battleSize: mine?.battleSize, first }, ctx())).then(onStarted)
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">{tx('My army list')}
          <select className="input" value={listId} onChange={(e) => setListId(e.target.value)}>
            <option value="">{tx('No list')}</option>
            {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm" data-tour="opponent">{tx('Opponent')}<input className="input" value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder={tx('Name')} /></label>
        <label className="grid gap-1 text-sm">{tx('Their faction')}
          <input className="input" list="game-factions" value={faction} onChange={(e) => setFaction(e.target.value)} />
          <datalist id="game-factions">{catalogue?.factions.map((f) => <option key={f.id} value={f.name} />)}</datalist>
        </label>
        <div className="grid gap-1 text-sm">
          <span>{tx('Their list (optional)')}</span>
          <div className="flex flex-wrap gap-2">
            <label className="btn px-2 py-0.5 text-sm">{tx('📄 File')}
              <input className="sr-only" type="file" accept=".rosz,.ros,.json,.txt" aria-label={tx('Their list file')} onChange={(e) => { const f = e.target.files?.[0]; if (f) void load(f) }} />
            </label>
            <button type="button" className="btn px-2 py-0.5 text-sm" onClick={() => setReadQr(true)}>{tx('📷 Read QR')}</button>
            {lists.length > 0 && (
              <select className="input py-0.5 text-sm" aria-label={tx('Their list from my lists')} value="" onChange={(e) => { const l = lists.find((x) => x.id === e.target.value); if (l) pickTheirs({ ...structuredClone(l), id: ctx().newId() }) }}>
                <option value="">{tx('One of my lists…')}</option>
                {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )}
          </div>
          {theirList && (
            <span className="flex items-center gap-2 text-xs text-muted" aria-label={tx('Their list')}>
              {tx('{{name}}: {{n}} units', { name: theirList.name, n: theirList.entries.length })}
              <button type="button" className="underline" onClick={() => setTheirList(undefined)}>{tx('remove')}</button>
            </span>
          )}
        </div>
        {!is40k ? (
          <>
            <label className="grid gap-1 text-sm">{tx('Mission')}<input className="input" value={mission} onChange={(e) => setMission(e.target.value)} /></label>
            <label className="grid gap-1 text-sm">{tx('Deployment')}<input className="input" value={deployment} onChange={(e) => setDeployment(e.target.value)} /></label>
          </>
        ) : (
        <fieldset className="grid gap-2 rounded border border-line p-2 text-sm sm:col-span-2" aria-label={tx('Mission')}>
          <legend className="px-1 text-xs text-muted">{tx('Mission · {{pack}} cards, or type your own', { pack: MISSION_PACK })}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['me', 'them'] as const).map((k) => (
              <label key={k} className="grid gap-1">{k === 'me' ? tx('My force disposition') : tx('Their force disposition')}
                <span className="flex gap-1">
                  <select className="input flex-1" value={disp[k] ?? ''} onChange={(e) => pickDisp(k, e.target.value)}>
                    <option value="">—</option>
                    {DISPOSITIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <button type="button" className="btn px-2 py-0" aria-label={k === 'me' ? tx('Draw my force disposition') : tx('Draw their force disposition')} title={tx('Draw at random')} onClick={() => pickDisp(k, draw(DISPOSITIONS))}>🎲</button>
                </span>
              </label>
            ))}
            <label className="grid gap-1">{tx('My primary mission')}<input className="input" list="game-primaries" value={mission} onChange={(e) => setMission(e.target.value)} /></label>
            <label className="grid gap-1">{tx('Their primary mission')}<input className="input" list="game-primaries" value={theirMission} onChange={(e) => setTheirMission(e.target.value)} /></label>
            <datalist id="game-primaries">{PRIMARIES.map((m) => <option key={m} value={m} />)}</datalist>
            <label className="grid gap-1">{tx('Deployment')}
              <span className="flex gap-1">
                <input className="input flex-1" list="game-deployments" value={deployment} onChange={(e) => setDeployment(e.target.value)} />
                <button type="button" className="btn px-2 py-0" aria-label={tx('Draw deployment')} title={tx('Draw at random')} onClick={() => setDeployment(draw(DEPLOYMENTS))}>🎲</button>
              </span>
              <datalist id="game-deployments">{DEPLOYMENTS.map((m) => <option key={m} value={m} />)}</datalist>
            </label>
            <label className="grid gap-1">{tx('Twist (optional)')}
              <span className="flex gap-1">
                <input className="input flex-1" list="game-twists" value={twist} onChange={(e) => setTwist(e.target.value)} />
                <button type="button" className="btn px-2 py-0" aria-label={tx('Draw twist')} title={tx('Draw at random')} onClick={() => setTwist(draw(TWISTS))}>🎲</button>
              </span>
              <datalist id="game-twists">{TWISTS.map((m) => <option key={m} value={m} />)}</datalist>
            </label>
          </div>
        </fieldset>
        )}
        <div className="grid gap-1 text-sm">
          <label className="grid gap-1">{tx('Who goes first')}
            <select className="input" value={first} onChange={(e) => setFirst(e.target.value as SideKey)}>
              <option value="me">{tx('Me')}</option>
              <option value="them">{tx('Opponent')}</option>
            </select>
          </label>
          <span className="flex gap-2">
            <button type="button" className="btn px-2 py-0.5 text-sm" onClick={() => setDecide('roll')}>{tx('🎲 Roll off')}</button>
            <button type="button" className="btn px-2 py-0.5 text-sm" onClick={() => setDecide('coin')}>{tx('🪙 Coin flip')}</button>
          </span>
        </div>
      </div>
      {readQr && <ListQrRead onClose={() => setReadQr(false)} onList={(l) => { setReadQr(false); pickTheirs(l) }} />}
      {decide && <WhoGoesFirst mode={decide} opponent={opponent} onClose={() => setDecide(null)} onDone={(w) => { setFirst(w); setDecide(null) }} />}
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary" data-tour="start-game">{tx('▶ Start game')}</button>
        <button type="button" className="btn" onClick={onCancel}>{tx('Cancel')}</button>
      </div>
    </form>
  )
}

/** Names of a list's entries, from the catalogue. */
function useEntryNames() {
  const tx = useTx()
  const { catalogue } = useStore()
  const names = new Map(catalogue?.datasheets.map((d) => [d.id, d.name]) ?? [])
  return (l?: ArmyList) => (l?.entries ?? []).map((e) => ({ id: e.id, name: names.get(e.datasheetId) ?? tx('Unknown unit'), models: e.models }))
}

/** One side of a live game. Its own component so its buttons stay in place while the game updates. */
function Side({ k, g, units }: { k: SideKey; g: Game; units: { id: string; name: string; models: number }[] }) {
  const tx = useTx()
  const { saveGame } = useStore()
  const c = ctx()
  // Build on the latest saved game, so quick taps never undo each other.
  const apply = (f: (g: Game) => Game) => void saveGame(f(useStore.getState().games.find((x) => x.id === g.id) ?? g))
  const s = g[k]
  const t = totals(s)
  const r = s.rounds[g.round - 1]
  return (
    <section className={`panel grid content-start gap-3 p-4 ${g.turn === k ? 'border-accent' : ''}`} aria-label={k === 'me' ? tx('My side') : tx('Their side')}>
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg">{s.name}{s.faction ? <span className="text-sm text-muted"> · {s.faction}</span> : null}</h2>
        <span className="font-display text-4xl text-accent tabular-nums" aria-label={tx('{{name}} total', { name: s.name })} data-tour={`${k}-total`}>{t.total}</span>
      </header>
      {(['primary', 'secondary'] as const).map((kind) => (
        <div key={kind} className="flex items-center gap-2">
          <span className="w-28 text-sm capitalize">{kind === 'primary' ? tx('primary') : tx('secondary')} <span className="text-xs text-muted">({kind === 'primary' ? t.primary : t.secondary})</span></span>
          <span className="w-10 text-center tabular-nums" aria-label={tx('{{name}} {{kind}} this round', { name: s.name, kind: kind === 'primary' ? tx('primary') : tx('secondary') })}>{r[kind]}</span>
          <button type="button" className="btn px-2 py-0.5" aria-label={tx('{{name}} {{kind}} −1', { name: s.name, kind: kind === 'primary' ? tx('primary') : tx('secondary') })} onClick={() => apply((g) => addPoints(g, k, kind, -1, c))}>−1</button>
          <button type="button" className="btn px-2 py-0.5" aria-label={tx('{{name}} {{kind}} +1', { name: s.name, kind: kind === 'primary' ? tx('primary') : tx('secondary') })} onClick={() => apply((g) => addPoints(g, k, kind, 1, c))}>+1</button>
          <button type="button" className="btn px-2 py-0.5" aria-label={tx('{{name}} {{kind}} +5', { name: s.name, kind: kind === 'primary' ? tx('primary') : tx('secondary') })} data-tour={`${k}-${kind}-5`} onClick={() => apply((g) => addPoints(g, k, kind, 5, c))}>+5</button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <span className="w-28 text-sm">{tx('Command points')}</span>
        <span className="w-10 text-center tabular-nums" aria-label={tx('{{name}} CP', { name: s.name })}>{s.cp}</span>
        <button type="button" className="btn px-2 py-0.5" aria-label={tx('{{name}} CP −1', { name: s.name })} onClick={() => apply((g) => setCp(g, k, -1, c))}>−1</button>
        <button type="button" className="btn px-2 py-0.5" aria-label={tx('{{name}} CP +1', { name: s.name })} onClick={() => apply((g) => setCp(g, k, 1, c))}>+1</button>
      </div>
      <div className="grid gap-1">
        <h3 className="text-xs uppercase tracking-wider text-muted">{tx('Units destroyed:')} {s.destroyed.length}{units.length ? ` / ${units.length}` : ''}</h3>
        {units.length ? (
          <ul className="grid gap-0.5 text-sm">
            {units.map((u) => (
              <li key={u.id}>
                <label className={`flex items-center gap-2 ${s.destroyed.includes(u.id) ? 'text-muted line-through' : ''}`}>
                  <input type="checkbox" checked={s.destroyed.includes(u.id)} onChange={() => apply((g) => toggleDestroyed(g, k, u.id, c))} />
                  {u.name} <span className="text-xs text-muted">({u.models})</span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex gap-2">
            <button type="button" className="btn px-2 py-0.5" aria-label={tx('{{name}}: one more unit destroyed', { name: s.name })} onClick={() => apply((g) => toggleDestroyed(g, k, `unit-${s.destroyed.length + 1}`, c))}>{tx('+ Unit destroyed')}</button>
            {s.destroyed.length > 0 && <button type="button" className="btn px-2 py-0.5" aria-label={tx('{{name}}: one less unit destroyed', { name: s.name })} onClick={() => apply((g) => toggleDestroyed(g, k, s.destroyed.at(-1)!, c))}>−</button>}
          </div>
        )}
      </div>
    </section>
  )
}

function LiveGame({ game: g, onCompanion }: { game: Game; onCompanion: () => void }) {
  const tx = useTx()
  const { saveGame, deleteGame, lists } = useStore()
  const [ending, setEnding] = useState(false)
  const [dice, setDice] = useState(false)
  const [notes, setNotes] = useState('')
  const entries = useEntryNames()
  const save = (next: Game) => void saveGame(next)
  const c = ctx()
  const myList = lists.find((l) => l.id === g.me.listId)

  return (
    <div className="grid gap-3" aria-label={tx('Live game')} data-tour="live-game">
      <div className="panel flex flex-wrap items-center gap-3 p-3">
        <span className="font-display text-xl">{tx('Round {{n}} / {{max}}', { n: g.round, max: ROUNDS })}</span>
        <span className="text-sm" role="status" data-tour="turn-status">{g.turn === 'me' ? tx('Your turn') : tx("{{name}}'s turn", { name: g.them.name })}</span>
        {(g.mission || g.deployment) && <span className="text-sm text-muted" aria-label={tx('Mission')}>{[g.mission && (g.theirMission ? tx('{{a}} vs {{b}}', { a: g.mission, b: g.theirMission }) : g.mission), g.deployment, g.twist && tx('Twist: {{name}}', { name: g.twist })].filter(Boolean).join(' · ')}</span>}
        <button className="btn ml-auto" data-tour="dice" onClick={() => setDice(true)}>{tx('🎲 Dice')}</button>
        <button className="btn" onClick={onCompanion}>{tx('📱 Companion')}</button>
        <button className="btn btn-primary" disabled={g.round === ROUNDS && g.turn !== g.first} data-tour="next-turn" onClick={() => save(advanceTurn(g, c))}>{tx('Next turn ▶')}</button>
        <button className="btn" data-tour="end-game" onClick={() => setEnding(true)}>{tx('End game')}</button>
        <button className="btn btn-danger" onClick={() => { if (confirm(tx('Delete this game?'))) void deleteGame(g.id) }}>{tx('Delete')}</button>
      </div>
      {dice && <DiceRoller onClose={() => setDice(false)} />}
      {ending && (
        <div className="panel grid gap-2 border-accent/60 p-3" role="dialog" aria-label={tx('End game')} data-tour="end-game-form">
          <p className="text-sm">{tx('Final score {{a}}–{{b}}:', { a: totals(g.me).total, b: totals(g.them).total })} <b>{result(g) === 'win' ? tx('win') : result(g) === 'loss' ? tx('loss') : tx('draw')}</b></p>
          <label className="grid gap-1 text-sm">{tx('Notes')}<textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={() => save(endGame(g, notes, c))}>{tx('Save game')}</button>
            <button className="btn btn-danger" onClick={() => { if (confirm(tx('Discard this game? It will not be saved.'))) void deleteGame(g.id) }}>{tx('Discard game')}</button>
            <button className="btn" onClick={() => setEnding(false)}>{tx('Back')}</button>
          </div>
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        <Side k="me" g={g} units={entries(myList)} />
        <Side k="them" g={g} units={entries(g.them.list)} />
      </div>
      <RoundTable game={g} />
      <div className="panel p-3"><GamePhotos game={g} /></div>
    </div>
  )
}

function RoundTable({ game: g }: { game: Game }) {
  const tx = useTx()
  return (
    <table className="w-full text-sm" aria-label={tx('Score by round')} data-tour="score-by-round">
      <thead className="text-xs uppercase tracking-wider text-muted">
        <tr><th className="text-left">{tx('Round')}</th>{g.me.rounds.map((_, i) => <th key={i}>{i + 1}</th>)}<th>{tx('Total')}</th></tr>
      </thead>
      <tbody>
        {(['me', 'them'] as const).map((k) => (
          <tr key={k} className="border-t border-line text-center tabular-nums">
            <td className="py-1 text-left">{g[k].name}</td>
            {g[k].rounds.map((r, i) => <td key={i} title={tx('Primary {{a}} · Secondary {{b}}', { a: r.primary, b: r.secondary })}>{r.primary + r.secondary}</td>)}
            <td className="font-semibold">{totals(g[k]).total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function StatsTable({ title, rows }: { title: string; rows: StatRow[] }) {
  const tx = useTx()
  if (!rows.length) return null
  return (
    <table className="w-full text-sm" aria-label={title}>
      <thead className="text-left text-xs uppercase tracking-wider text-muted">
        <tr><th>{title}</th><th className="text-right">{tx('Played')}</th><th className="text-right">{tx('W-L-D')}</th><th className="text-right">{tx('Win %')}</th><th className="text-right">{tx('Avg score')}</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-t border-line">
            <td className="py-1">{r.key}</td>
            <td className="text-right">{r.played}</td>
            <td className="text-right">{r.wins}-{r.losses}-{r.draws}</td>
            <td className="text-right">{Math.round((r.wins / r.played) * 100)}%</td>
            <td className="text-right">{r.avgFor}–{r.avgAgainst}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function History() {
  const tx = useTx()
  const { games, lists, deleteGame } = useStore()
  const [open, setOpen] = useState<string | null>(null)
  const entries = useEntryNames()
  const done = games.filter((g) => g.status === 'done').sort((a, b) => b.date.localeCompare(a.date))
  const listName = (id: string) => lists.find((l) => l.id === id)?.name
  const stats = gameStats(games, listName)
  if (!done.length) return <p className="text-sm text-muted">{tx('No finished games yet.')}</p>
  return (
    <>
      <section className="panel grid gap-2 p-4" aria-label={tx('Game history')}>
        <h2 className="font-display text-lg">{tx('History')}</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted">
            <tr><th>{tx('Date')}</th><th>{tx('My list')}</th><th>{tx('Opponent')}</th><th>{tx('Mission')}</th><th className="text-right">{tx('Score')}</th><th className="text-right">{tx('Result')}</th><th /></tr>
          </thead>
          <tbody>
            {done.map((g) => {
              const r = result(g)
              return [
                <tr key={g.id} className="cursor-pointer border-t border-line hover:bg-panel-2" onClick={() => setOpen(open === g.id ? null : g.id)}>
                  <td className="py-1">{new Date(g.date).toLocaleDateString()}</td>
                  <td>{(g.me.listId && listName(g.me.listId)) || '—'}</td>
                  <td>{g.them.name}{g.them.faction ? ` · ${g.them.faction}` : ''}</td>
                  <td>{g.mission || '—'}</td>
                  <td className="text-right tabular-nums">{totals(g.me).total}–{totals(g.them).total}</td>
                  <td className={`text-right font-semibold ${RESULT_CLASS[r]}`}>{r === 'win' ? tx('W') : r === 'loss' ? tx('L') : tx('D')}</td>
                  <td className="w-8 text-right">
                    <button className="px-1 text-muted hover:text-danger" aria-label={tx('Delete game vs {{name}}', { name: g.them.name })} title={tx('Delete game')} onClick={(e) => { e.stopPropagation(); if (confirm(tx('Delete this game?'))) void deleteGame(g.id) }}>✕</button>
                  </td>
                </tr>,
                open === g.id && (
                  <tr key={`${g.id}-d`}>
                    <td colSpan={7} className="bg-panel-2/40 p-3">
                      <RoundTable game={g} />
                      <p className="mt-2 text-sm">{tx('Lost:')} {g.me.destroyed.length ? entries(lists.find((l) => l.id === g.me.listId)).filter((u) => g.me.destroyed.includes(u.id)).map((u) => u.name).join(', ') || tx('{{n}} units', { n: g.me.destroyed.length }) : tx('none')}</p>
                      <p className="text-sm">{tx('Destroyed:')} {g.them.destroyed.length ? entries(g.them.list).filter((u) => g.them.destroyed.includes(u.id)).map((u) => u.name).join(', ') || tx('{{n}} units', { n: g.them.destroyed.length }) : tx('none')}</p>
                      {g.notes && <p className="mt-1 whitespace-pre-line text-sm">{g.notes}</p>}
                      <div className="mt-2"><GamePhotos game={g} /></div>
                      <button className="btn btn-danger mt-2 px-2 py-0.5 text-sm" onClick={() => { if (confirm(tx('Delete this game?'))) void deleteGame(g.id) }}>{tx('Delete game')}</button>
                    </td>
                  </tr>
                ),
              ]
            })}
          </tbody>
        </table>
      </section>
      <section className="panel grid gap-4 p-4" aria-label={tx('Results')}>
        <h2 className="font-display text-lg">{tx('Results')}</h2>
        <StatsTable title={tx('Overall')} rows={[stats.overall]} />
        <StatsTable title={tx('By list')} rows={stats.byList} />
        <StatsTable title={tx('By opponent faction')} rows={stats.byOpponent} />
      </section>
    </>
  )
}
