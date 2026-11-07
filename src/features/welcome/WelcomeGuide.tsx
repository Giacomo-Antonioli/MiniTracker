import { useState } from 'react'
import { THEMES, useStore, type Theme } from '../../app/store'
import { isDesktopApp } from '../../app/platform'
import { EDITIONS, GAMES, type GameId } from '../../domain/catalogue/editions'
import { AUTO, UI_SCALES, effectiveScale, scaleLabel } from '../../domain/settings/uiScale'
import { Dialog, ProgressBar } from '../../ui/Dialog'
import { useWelcome } from './welcome'

export type WelcomeGo = 'backlog' | 'sync' | 'backup' | 'guide'

const STEPS = ['Welcome', 'Your games', 'Look', 'Your data', 'Find your way'] as const

/** First-start guide (#168): a few steps to set the app up; every step can be skipped. */
export function WelcomeGuide({ onGo }: { onGo: (to: WelcomeGo) => void }) {
  const finish = useWelcome((w) => w.finish)
  const [step, setStep] = useState(0)
  const last = step === STEPS.length - 1
  const leave = (to?: WelcomeGo) => {
    finish()
    if (to) onGo(to)
  }

  return (
    <Dialog title="Welcome to MiniTracker" onClose={() => leave()} wide>
      <div className="grid gap-4 p-4" aria-label="Welcome guide">
        <ol className="flex flex-wrap gap-1 text-xs" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button className={`rounded px-2 py-0.5 ${i === step ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`} aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)}>
                {i + 1}. {s}
              </button>
            </li>
          ))}
        </ol>

        <section className="grid min-h-48 content-start gap-3" aria-label={STEPS[step]}>
          {step === 0 && <Intro />}
          {step === 1 && <Games />}
          {step === 2 && <Look />}
          {step === 3 && <Data onGo={leave} />}
          {step === 4 && <Tour onGo={leave} />}
        </section>

        <footer className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <button className="btn" onClick={() => leave()}>Skip guide</button>
          <span className="flex-1" />
          {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}>Back</button>}
          {last ? <button className="btn btn-primary" onClick={() => leave()}>Start using MiniTracker</button> : <button className="btn btn-primary" onClick={() => setStep(step + 1)}>Next</button>}
        </footer>
      </div>
    </Dialog>
  )
}

function Intro() {
  return (
    <>
      <h2 className="font-display text-xl text-accent">Your pile of shame, under control</h2>
      <p>MiniTracker keeps track of your miniatures from box to finished model: what you own, what stage it's at, which paints you need, and army lists built from what you have.</p>
      <p className="text-muted">Everything stays on this device. Nothing is uploaded; you choose when to sync with your other devices.</p>
      <p className="text-sm text-muted">This guide takes a minute. You can skip it at any time and open it again from Settings › Appearance.</p>
    </>
  )
}

function Games() {
  const { catalogues, catalogueJob: job, downloadCatalogue } = useStore()
  const busy = job.phase !== 'idle'
  return (
    <>
      <h2 className="font-display text-xl text-accent">Which games do you play?</h2>
      <p className="text-sm text-muted">Download a catalogue for the units, points and rules of a game. It comes from the community BSData project (Middle-earth from the MESBG list builder) and is converted on this device. You can add more later in Settings › Catalogue data.</p>
      <ul className="grid gap-2">
        {(Object.keys(GAMES) as GameId[]).map((g) => {
          const e = EDITIONS.find((x) => x.game === g)!
          const have = catalogues.some((c) => c.source.repo === e.repo)
          const mine = job.repo === e.repo
          return (
            <li key={g} className="flex flex-wrap items-center gap-2">
              <span className="flex-1">{GAMES[g]} <span className="text-sm text-muted">· {e.label}</span></span>
              {have ? <span className="text-ok">✓ Installed</span> : <button className="btn text-sm" disabled={busy} onClick={() => void downloadCatalogue(e.repo)}>⬇ Download</button>}
              {mine && busy && <span className="w-full"><ProgressBar ratio={job.phase === 'downloading' && job.total ? job.done / job.total : job.phase === 'converting' ? 1 : 0} /></span>}
              {mine && job.error && <span className="w-full text-sm text-danger" role="alert">{job.error}</span>}
            </li>
          )
        })}
      </ul>
    </>
  )
}

function Look() {
  const { theme, setTheme, uiScale, setUiScale } = useStore()
  const shown = effectiveScale(uiScale, window.innerWidth)
  return (
    <>
      <h2 className="font-display text-xl text-accent">Make it yours</h2>
      <label className="flex items-center gap-3">
        Theme
        <select className="input" value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
          {Object.entries(THEMES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
      <label className="flex flex-wrap items-center gap-3">
        Text and interface size
        <input className="w-40 accent-[var(--accent)]" type="range" min={0} max={UI_SCALES.length - 1} step={1} aria-label="Text and interface size" value={UI_SCALES.indexOf(shown as (typeof UI_SCALES)[number])} onChange={(e) => setUiScale(UI_SCALES[Number(e.target.value)])} />
        <span className="tabular-nums">{scaleLabel(shown)}{uiScale === AUTO && ' (auto)'}</span>
        {uiScale !== AUTO && <button type="button" className="btn px-2 py-0.5 text-sm" onClick={() => setUiScale(AUTO)}>Auto</button>}
      </label>
      <p className="text-sm text-muted">Auto follows the window: a bigger or maximised window gets bigger text.</p>
    </>
  )
}

function Data({ onGo }: { onGo: (to: WelcomeGo) => void }) {
  return (
    <>
      <h2 className="font-display text-xl text-accent">Already use MiniTracker somewhere else?</h2>
      <p className="text-sm text-muted">{isDesktopApp() ? 'This app keeps its own data, separate from MiniTracker in your browser.' : 'Each browser and device keeps its own data.'} Bring yours over, or start fresh.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <button className="btn grid gap-1 p-3 text-left" onClick={() => onGo('sync')}><b>⇄ Sync from another device</b><span className="text-sm text-muted">Phone, browser or computer: by code, QR or a sync file.</span></button>
        <button className="btn grid gap-1 p-3 text-left" onClick={() => onGo('backup')}><b>Restore a backup</b><span className="text-sm text-muted">A backup file you exported before.</span></button>
        <button className="btn grid gap-1 p-3 text-left" onClick={() => onGo('backlog')}><b>+ Start fresh</b><span className="text-sm text-muted">Add your first unit to the backlog.</span></button>
      </div>
    </>
  )
}

function Tour({ onGo }: { onGo: (to: WelcomeGo) => void }) {
  const pages: [string, string][] = [
    ['Backlog', 'every unit you own or want, by painting stage'],
    ['Armies', 'army lists built from what you have, with what to buy'],
    ['Catalogue and Rules', 'units, points and rules of your games'],
    ['Paints and Schemes', 'your paints and painting recipes'],
    ['Workshop and Storage', 'tools, supplies and where your models are'],
    ['Stats and Goals', 'your progress over time'],
    ['Games', 'play: missions, dice, scores'],
    ['Sync and Settings', 'other devices, backups, catalogues, appearance'],
  ]
  return (
    <>
      <h2 className="font-display text-xl text-accent">Where things are</h2>
      <ul className="grid gap-1 text-sm">
        {pages.map(([name, what]) => <li key={name}><b>{name}</b>: <span className="text-muted">{what}</span></li>)}
      </ul>
      <p className="text-sm">Pick a game at the top of the menu to see only its units, or All games for everything.</p>
      <button className="btn w-fit" onClick={() => onGo('guide')}>📖 Open the full user guide</button>
    </>
  )
}
