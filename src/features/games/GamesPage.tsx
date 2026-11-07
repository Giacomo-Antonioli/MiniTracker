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

const RESULT = { win: 'W', loss: 'L', draw: 'D' } as const
const RESULT_CLASS = { win: 'text-ok', loss: 'text-danger', draw: 'text-muted' } as const

/** Games (#71): start one, keep score live, then look back at the history and results. */
export function GamesPage() {
  const { games } = useStore()
  const live = games.find((g) => g.status === 'live')
  const [starting, setStarting] = useState(false)
  const [companion, setCompanion] = useState(false)
  const [joining, setJoining] = useState(false)
  if (live && companion) return <Companion game={live} onExit={() => setCompanion(false)} />
  return (
    <div className="grid gap-4">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-accent">Games</h1>
        {!live && !starting && <button className="btn btn-primary" onClick={() => setStarting(true)}>▶ New game</button>}
        {!live && !starting && <button className="btn" onClick={() => setJoining(true)}>📡 Join live game</button>}
        {live && <LiveStatus game={live} />}
      </header>
      {joining && <JoinLive onClose={() => setJoining(false)} onJoined={() => setCompanion(true)} />}
      {live ? <LiveGame game={live} onCompanion={() => setCompanion(true)} /> : starting && <NewGameForm onCancel={() => setStarting(false)} onStarted={() => setStarting(false)} />}
      <History />
    </div>
  )
}

function NewGameForm({ onCancel, onStarted }: { onCancel: () => void; onStarted: () => void }) {
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
      if (!catalogue) throw new Error('Install a catalogue first (Settings → Catalogue)')
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
      aria-label="New game"
      onSubmit={(e) => {
        e.preventDefault()
        void saveGame(newGame({ myListId: mine?.id, myFaction: factionName(catalogue, mine?.factionId), opponent, theirFaction: faction, theirList, mission, theirMission, deployment, twist, battleSize: mine?.battleSize, first }, ctx())).then(onStarted)
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">My army list
          <select className="input" value={listId} onChange={(e) => setListId(e.target.value)}>
            <option value="">No list</option>
            {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">Opponent<input className="input" value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="Name" /></label>
        <label className="grid gap-1 text-sm">Their faction
          <input className="input" list="game-factions" value={faction} onChange={(e) => setFaction(e.target.value)} />
          <datalist id="game-factions">{catalogue?.factions.map((f) => <option key={f.id} value={f.name} />)}</datalist>
        </label>
        <div className="grid gap-1 text-sm">
          <span>Their list (optional)</span>
          <div className="flex flex-wrap gap-2">
            <label className="btn px-2 py-0.5 text-sm">📄 File
              <input className="sr-only" type="file" accept=".rosz,.ros,.json,.txt" aria-label="Their list file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void load(f) }} />
            </label>
            <button type="button" className="btn px-2 py-0.5 text-sm" onClick={() => setReadQr(true)}>📷 Read QR</button>
            {lists.length > 0 && (
              <select className="input py-0.5 text-sm" aria-label="Their list from my lists" value="" onChange={(e) => { const l = lists.find((x) => x.id === e.target.value); if (l) pickTheirs({ ...structuredClone(l), id: ctx().newId() }) }}>
                <option value="">One of my lists…</option>
                {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )}
          </div>
          {theirList && (
            <span className="flex items-center gap-2 text-xs text-muted" aria-label="Their list">
              {theirList.name}: {theirList.entries.length} units
              <button type="button" className="underline" onClick={() => setTheirList(undefined)}>remove</button>
            </span>
          )}
        </div>
        {!is40k ? (
          <>
            <label className="grid gap-1 text-sm">Mission<input className="input" value={mission} onChange={(e) => setMission(e.target.value)} /></label>
            <label className="grid gap-1 text-sm">Deployment<input className="input" value={deployment} onChange={(e) => setDeployment(e.target.value)} /></label>
          </>
        ) : (
        <fieldset className="grid gap-2 rounded border border-line p-2 text-sm sm:col-span-2" aria-label="Mission">
          <legend className="px-1 text-xs text-muted">Mission · {MISSION_PACK} cards, or type your own</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['me', 'them'] as const).map((k) => (
              <label key={k} className="grid gap-1">{k === 'me' ? 'My force disposition' : 'Their force disposition'}
                <span className="flex gap-1">
                  <select className="input flex-1" value={disp[k] ?? ''} onChange={(e) => pickDisp(k, e.target.value)}>
                    <option value="">—</option>
                    {DISPOSITIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <button type="button" className="btn px-2 py-0" aria-label={`Draw ${k === 'me' ? 'my' : 'their'} force disposition`} title="Draw at random" onClick={() => pickDisp(k, draw(DISPOSITIONS))}>🎲</button>
                </span>
              </label>
            ))}
            <label className="grid gap-1">My primary mission<input className="input" list="game-primaries" value={mission} onChange={(e) => setMission(e.target.value)} /></label>
            <label className="grid gap-1">Their primary mission<input className="input" list="game-primaries" value={theirMission} onChange={(e) => setTheirMission(e.target.value)} /></label>
            <datalist id="game-primaries">{PRIMARIES.map((m) => <option key={m} value={m} />)}</datalist>
            <label className="grid gap-1">Deployment
              <span className="flex gap-1">
                <input className="input flex-1" list="game-deployments" value={deployment} onChange={(e) => setDeployment(e.target.value)} />
                <button type="button" className="btn px-2 py-0" aria-label="Draw deployment" title="Draw at random" onClick={() => setDeployment(draw(DEPLOYMENTS))}>🎲</button>
              </span>
              <datalist id="game-deployments">{DEPLOYMENTS.map((m) => <option key={m} value={m} />)}</datalist>
            </label>
            <label className="grid gap-1">Twist (optional)
              <span className="flex gap-1">
                <input className="input flex-1" list="game-twists" value={twist} onChange={(e) => setTwist(e.target.value)} />
                <button type="button" className="btn px-2 py-0" aria-label="Draw twist" title="Draw at random" onClick={() => setTwist(draw(TWISTS))}>🎲</button>
              </span>
              <datalist id="game-twists">{TWISTS.map((m) => <option key={m} value={m} />)}</datalist>
            </label>
          </div>
        </fieldset>
        )}
        <div className="grid gap-1 text-sm">
          <label className="grid gap-1">Who goes first
            <select className="input" value={first} onChange={(e) => setFirst(e.target.value as SideKey)}>
              <option value="me">Me</option>
              <option value="them">Opponent</option>
            </select>
          </label>
          <span className="flex gap-2">
            <button type="button" className="btn px-2 py-0.5 text-sm" onClick={() => setDecide('roll')}>🎲 Roll off</button>
            <button type="button" className="btn px-2 py-0.5 text-sm" onClick={() => setDecide('coin')}>🪙 Coin flip</button>
          </span>
        </div>
      </div>
      {readQr && <ListQrRead onClose={() => setReadQr(false)} onList={(l) => { setReadQr(false); pickTheirs(l) }} />}
      {decide && <WhoGoesFirst mode={decide} opponent={opponent} onClose={() => setDecide(null)} onDone={(w) => { setFirst(w); setDecide(null) }} />}
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary">▶ Start game</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

/** Names of a list's entries, from the catalogue. */
function useEntryNames() {
  const { catalogue } = useStore()
  const names = new Map(catalogue?.datasheets.map((d) => [d.id, d.name]) ?? [])
  return (l?: ArmyList) => (l?.entries ?? []).map((e) => ({ id: e.id, name: names.get(e.datasheetId) ?? 'Unknown unit', models: e.models }))
}

/** One side of a live game. Its own component so its buttons stay in place while the game updates. */
function Side({ k, g, units }: { k: SideKey; g: Game; units: { id: string; name: string; models: number }[] }) {
  const { saveGame } = useStore()
  const c = ctx()
  // Build on the latest saved game, so quick taps never undo each other.
  const apply = (f: (g: Game) => Game) => void saveGame(f(useStore.getState().games.find((x) => x.id === g.id) ?? g))
  const s = g[k]
  const t = totals(s)
  const r = s.rounds[g.round - 1]
  return (
    <section className={`panel grid content-start gap-3 p-4 ${g.turn === k ? 'border-accent' : ''}`} aria-label={k === 'me' ? 'My side' : 'Their side'}>
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg">{s.name}{s.faction ? <span className="text-sm text-muted"> · {s.faction}</span> : null}</h2>
        <span className="font-display text-4xl text-accent tabular-nums" aria-label={`${s.name} total`}>{t.total}</span>
      </header>
      {(['primary', 'secondary'] as const).map((kind) => (
        <div key={kind} className="flex items-center gap-2">
          <span className="w-28 text-sm capitalize">{kind} <span className="text-xs text-muted">({kind === 'primary' ? t.primary : t.secondary})</span></span>
          <span className="w-10 text-center tabular-nums" aria-label={`${s.name} ${kind} this round`}>{r[kind]}</span>
          <button type="button" className="btn px-2 py-0.5" aria-label={`${s.name} ${kind} −1`} onClick={() => apply((g) => addPoints(g, k, kind, -1, c))}>−1</button>
          <button type="button" className="btn px-2 py-0.5" aria-label={`${s.name} ${kind} +1`} onClick={() => apply((g) => addPoints(g, k, kind, 1, c))}>+1</button>
          <button type="button" className="btn px-2 py-0.5" aria-label={`${s.name} ${kind} +5`} onClick={() => apply((g) => addPoints(g, k, kind, 5, c))}>+5</button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <span className="w-28 text-sm">Command points</span>
        <span className="w-10 text-center tabular-nums" aria-label={`${s.name} CP`}>{s.cp}</span>
        <button type="button" className="btn px-2 py-0.5" aria-label={`${s.name} CP −1`} onClick={() => apply((g) => setCp(g, k, -1, c))}>−1</button>
        <button type="button" className="btn px-2 py-0.5" aria-label={`${s.name} CP +1`} onClick={() => apply((g) => setCp(g, k, 1, c))}>+1</button>
      </div>
      <div className="grid gap-1">
        <h3 className="text-xs uppercase tracking-wider text-muted">Units destroyed: {s.destroyed.length}{units.length ? ` / ${units.length}` : ''}</h3>
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
            <button type="button" className="btn px-2 py-0.5" aria-label={`${s.name}: one more unit destroyed`} onClick={() => apply((g) => toggleDestroyed(g, k, `unit-${s.destroyed.length + 1}`, c))}>+ Unit destroyed</button>
            {s.destroyed.length > 0 && <button type="button" className="btn px-2 py-0.5" aria-label={`${s.name}: one less unit destroyed`} onClick={() => apply((g) => toggleDestroyed(g, k, s.destroyed.at(-1)!, c))}>−</button>}
          </div>
        )}
      </div>
    </section>
  )
}

function LiveGame({ game: g, onCompanion }: { game: Game; onCompanion: () => void }) {
  const { saveGame, deleteGame, lists } = useStore()
  const [ending, setEnding] = useState(false)
  const [dice, setDice] = useState(false)
  const [notes, setNotes] = useState('')
  const entries = useEntryNames()
  const save = (next: Game) => void saveGame(next)
  const c = ctx()
  const myList = lists.find((l) => l.id === g.me.listId)

  return (
    <div className="grid gap-3" aria-label="Live game">
      <div className="panel flex flex-wrap items-center gap-3 p-3">
        <span className="font-display text-xl">Round {g.round} / {ROUNDS}</span>
        <span className="text-sm" role="status">{g.turn === 'me' ? 'Your turn' : `${g.them.name}'s turn`}</span>
        {(g.mission || g.deployment) && <span className="text-sm text-muted" aria-label="Mission">{[g.mission && (g.theirMission ? `${g.mission} vs ${g.theirMission}` : g.mission), g.deployment, g.twist && `Twist: ${g.twist}`].filter(Boolean).join(' · ')}</span>}
        <button className="btn ml-auto" onClick={() => setDice(true)}>🎲 Dice</button>
        <button className="btn" onClick={onCompanion}>📱 Companion</button>
        <button className="btn btn-primary" disabled={g.round === ROUNDS && g.turn !== g.first} onClick={() => save(advanceTurn(g, c))}>Next turn ▶</button>
        <button className="btn" onClick={() => setEnding(true)}>End game</button>
        <button className="btn btn-danger" onClick={() => { if (confirm('Delete this game?')) void deleteGame(g.id) }}>Delete</button>
      </div>
      {dice && <DiceRoller onClose={() => setDice(false)} />}
      {ending && (
        <div className="panel grid gap-2 border-accent/60 p-3" role="dialog" aria-label="End game">
          <p className="text-sm">Final score {totals(g.me).total}–{totals(g.them).total}: <b>{result(g) === 'win' ? 'win' : result(g) === 'loss' ? 'loss' : 'draw'}</b></p>
          <label className="grid gap-1 text-sm">Notes<textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={() => save(endGame(g, notes, c))}>Save game</button>
            <button className="btn btn-danger" onClick={() => { if (confirm('Discard this game? It will not be saved.')) void deleteGame(g.id) }}>Discard game</button>
            <button className="btn" onClick={() => setEnding(false)}>Back</button>
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
  return (
    <table className="w-full text-sm" aria-label="Score by round">
      <thead className="text-xs uppercase tracking-wider text-muted">
        <tr><th className="text-left">Round</th>{g.me.rounds.map((_, i) => <th key={i}>{i + 1}</th>)}<th>Total</th></tr>
      </thead>
      <tbody>
        {(['me', 'them'] as const).map((k) => (
          <tr key={k} className="border-t border-line text-center tabular-nums">
            <td className="py-1 text-left">{g[k].name}</td>
            {g[k].rounds.map((r, i) => <td key={i} title={`Primary ${r.primary} · Secondary ${r.secondary}`}>{r.primary + r.secondary}</td>)}
            <td className="font-semibold">{totals(g[k]).total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function StatsTable({ title, rows }: { title: string; rows: StatRow[] }) {
  if (!rows.length) return null
  return (
    <table className="w-full text-sm" aria-label={title}>
      <thead className="text-left text-xs uppercase tracking-wider text-muted">
        <tr><th>{title}</th><th className="text-right">Played</th><th className="text-right">W-L-D</th><th className="text-right">Win %</th><th className="text-right">Avg score</th></tr>
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
  const { games, lists, deleteGame } = useStore()
  const [open, setOpen] = useState<string | null>(null)
  const entries = useEntryNames()
  const done = games.filter((g) => g.status === 'done').sort((a, b) => b.date.localeCompare(a.date))
  const listName = (id: string) => lists.find((l) => l.id === id)?.name
  const stats = gameStats(games, listName)
  if (!done.length) return <p className="text-sm text-muted">No finished games yet.</p>
  return (
    <>
      <section className="panel grid gap-2 p-4" aria-label="Game history">
        <h2 className="font-display text-lg">History</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted">
            <tr><th>Date</th><th>My list</th><th>Opponent</th><th>Mission</th><th className="text-right">Score</th><th className="text-right">Result</th><th /></tr>
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
                  <td className={`text-right font-semibold ${RESULT_CLASS[r]}`}>{RESULT[r]}</td>
                  <td className="w-8 text-right">
                    <button className="px-1 text-muted hover:text-danger" aria-label={`Delete game vs ${g.them.name}`} title="Delete game" onClick={(e) => { e.stopPropagation(); if (confirm('Delete this game?')) void deleteGame(g.id) }}>✕</button>
                  </td>
                </tr>,
                open === g.id && (
                  <tr key={`${g.id}-d`}>
                    <td colSpan={7} className="bg-panel-2/40 p-3">
                      <RoundTable game={g} />
                      <p className="mt-2 text-sm">Lost: {g.me.destroyed.length ? entries(lists.find((l) => l.id === g.me.listId)).filter((u) => g.me.destroyed.includes(u.id)).map((u) => u.name).join(', ') || `${g.me.destroyed.length} units` : 'none'}</p>
                      <p className="text-sm">Destroyed: {g.them.destroyed.length ? entries(g.them.list).filter((u) => g.them.destroyed.includes(u.id)).map((u) => u.name).join(', ') || `${g.them.destroyed.length} units` : 'none'}</p>
                      {g.notes && <p className="mt-1 whitespace-pre-line text-sm">{g.notes}</p>}
                      <div className="mt-2"><GamePhotos game={g} /></div>
                      <button className="btn btn-danger mt-2 px-2 py-0.5 text-sm" onClick={() => { if (confirm('Delete this game?')) void deleteGame(g.id) }}>Delete game</button>
                    </td>
                  </tr>
                ),
              ]
            })}
          </tbody>
        </table>
      </section>
      <section className="panel grid gap-4 p-4" aria-label="Results">
        <h2 className="font-display text-lg">Results</h2>
        <StatsTable title="Overall" rows={[stats.overall]} />
        <StatsTable title="By list" rows={stats.byList} />
        <StatsTable title="By opponent faction" rows={stats.byOpponent} />
      </section>
    </>
  )
}
