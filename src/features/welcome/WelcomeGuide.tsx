import type { ReactNode } from 'react'
import { THEMES, useStore, type Theme } from '../../app/store'
import { isDesktopApp } from '../../app/platform'
import { EDITIONS, GAMES, type GameId } from '../../domain/catalogue/editions'
import { AUTO, UI_SCALES, effectiveScale, scaleLabel } from '../../domain/settings/uiScale'
import { Dialog, ProgressBar } from '../../ui/Dialog'
import { useWelcome } from './welcome'

/** Where a guide button takes you: an app page, Settings › Backup, or the online user guide. */
export type WelcomeGo = 'backlog' | 'paints' | 'schemes' | 'tools' | 'supplies' | 'storage' | 'armies' | 'games' | 'stats' | 'sync' | 'backup' | 'guide'

const STEPS = ['Welcome', 'Your games', 'Look', 'Your data', 'Units', 'Paints', 'Workshop', 'Armies and games', 'Find your way'] as const

/**
 * First-start guide (#168): sets the app up and shows each part. "Try it" buttons open the page and pause the guide;
 * a "Back to the guide" button (WelcomeResume) brings it back at the same step. Skippable at any step.
 */
export function WelcomeGuide({ onGo }: { onGo: (to: WelcomeGo) => void }) {
  const { step, setStep, pause, finish } = useWelcome()
  const last = step === STEPS.length - 1
  /** Leave for good (Skip / Start fresh / Finish), optionally going somewhere. */
  const leave = (to?: WelcomeGo) => {
    finish()
    if (to) onGo(to)
  }
  /** Try something on its page, then come back to this step. */
  const tryIt = (to: WelcomeGo) => {
    if (to === 'guide') return onGo(to)
    pause()
    onGo(to)
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

        <section className="grid min-h-56 content-start gap-3" aria-label={STEPS[step]}>
          {step === 0 && <Intro />}
          {step === 1 && <Games />}
          {step === 2 && <Look />}
          {step === 3 && <Data onTry={tryIt} onFresh={() => setStep(4)} />}
          {step === 4 && (
            <Topic title="Your units" actions={[['Open the Backlog', 'backlog']]} onTry={tryIt}>
              <p>The <b>Backlog</b> is your collection: every unit you own or want, and how many of its models are at each painting stage.</p>
              <Points items={[
                ['+ Add unit', 'pick the unit from the catalogue and say how many models are built, painted…'],
                ['📷 Scan box', 'point the camera at a box barcode; teach it once what is inside'],
                ['⚔ Spearhead box', 'adds a whole Age of Sigmar Spearhead army in one go'],
                ['Wishlisted', 'the first stage: units you want to buy; tick them bought on the Shopping list'],
                ['Board view', 'drag units between stages as you paint'],
              ]} />
            </Topic>
          )}
          {step === 5 && (
            <Topic title="Paints and schemes" actions={[['Open Paints', 'paints'], ['Open Schemes', 'schemes']]} onTry={tryIt}>
              <p><b>Paints</b> has thousands of paints from the main brands. Mark the ones you own; MiniTracker then knows what you can paint with.</p>
              <Points items={[
                ['Owned / running low', 'tick your paints and flag the ones nearly empty'],
                ['Colour match', 'find your closest paint to any colour or to another brand\'s paint'],
                ['Schemes', 'painting recipes step by step; a library to start from, or write your own'],
                ['Missing paints', 'a scheme shows what you lack and adds it to the Shopping list'],
              ]} />
            </Topic>
          )}
          {step === 6 && (
            <Topic title="Workshop" actions={[['Open Tools', 'tools'], ['Open Supplies', 'supplies'], ['Open Storage', 'storage']]} onTry={tryIt}>
              <p>Everything around the hobby desk.</p>
              <Points items={[
                ['Tools', 'brushes, clippers, airbrush… with their condition and when to replace them'],
                ['Supplies', 'glue, primer, varnish, basing: how much is left, with a warning when low'],
                ['Storage', 'boxes and shelves; where each unit is, with QR labels to print'],
                ['Companion', 'times your painting sessions and tracks hours per unit'],
              ]} />
            </Topic>
          )}
          {step === 7 && (
            <Topic title="Armies and games" actions={[['Open Armies', 'armies'], ['Open Games', 'games'], ['Open Stats', 'stats']]} onTry={tryIt}>
              <Points items={[
                ['Armies', 'army lists from the catalogue, with points; see which units you own and what to buy'],
                ['Games', 'play a game: missions, 3D dice, scores, photos; share your list by QR'],
                ['Stats and Goals', 'your painting progress over time and goals to keep it going'],
              ]} />
            </Topic>
          )}
          {step === 8 && <Tour onTry={tryIt} />}
        </section>

        <footer className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <button className="btn" onClick={() => leave()}>Skip guide</button>
          <span className="flex-1 text-center text-xs text-muted">{step + 1} / {STEPS.length}</span>
          {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}>Back</button>}
          {last ? <button className="btn btn-primary" onClick={() => leave()}>Start using MiniTracker</button> : <button className="btn btn-primary" onClick={() => setStep(step + 1)}>Next</button>}
        </footer>
      </div>
    </Dialog>
  )
}

/** While the guide is paused: a button to go back to it, at the same step. */
export function WelcomeResume() {
  const { open, paused, step, resume, finish } = useWelcome()
  if (!open || !paused) return null
  return (
    <div className="panel fixed right-4 bottom-20 z-40 flex items-center gap-2 border-accent p-2 text-sm shadow-lg sm:bottom-4" role="status" aria-label="Welcome guide paused">
      <button className="btn btn-primary" onClick={resume}>↩ Back to the guide ({step + 1}/{STEPS.length})</button>
      <button className="text-muted hover:text-fg" aria-label="End the guide" onClick={finish}>✕</button>
    </div>
  )
}

function Topic({ title, actions, onTry, children }: { title: string; actions: [string, WelcomeGo][]; onTry: (to: WelcomeGo) => void; children: ReactNode }) {
  return (
    <>
      <h2 className="font-display text-xl text-accent">{title}</h2>
      {children}
      <div className="flex flex-wrap items-center gap-2">
        {actions.map(([label, to]) => <button key={to} className="btn" onClick={() => onTry(to)}>{label}</button>)}
        <span className="text-sm text-muted">The guide waits: use "Back to the guide" to carry on.</span>
      </div>
    </>
  )
}

function Points({ items }: { items: [string, string][] }) {
  return (
    <ul className="grid gap-1.5">
      {items.map(([name, what]) => (
        <li key={name} className="leading-snug"><b>{name}</b> <span className="text-muted">· {what}</span></li>
      ))}
    </ul>
  )
}

function Intro() {
  return (
    <>
      <h2 className="font-display text-xl text-accent">Your pile of shame, under control</h2>
      <p>MiniTracker keeps track of your miniatures from box to finished model: what you own, what stage it's at, which paints you need, and army lists built from what you have.</p>
      <p className="text-muted">Everything stays on this device. Nothing is uploaded; you choose when to sync with your other devices.</p>
      <p className="text-sm text-muted">The guide sets up the app and shows each part; "Open…" buttons take you there and the guide waits. Skip it at any time and open it again from Settings › Appearance.</p>
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

function Data({ onTry, onFresh }: { onTry: (to: WelcomeGo) => void; onFresh: () => void }) {
  const choices: [string, string, () => void][] = [
    ['⇄ Sync from another device', 'From your phone, a browser or another computer: by pairing code, QR or a sync file.', () => onTry('sync')],
    ['Restore a backup', 'Open a backup file you exported before.', () => onTry('backup')],
    ['+ Start fresh', 'Nothing to bring over: carry on with the guide and add your first units.', onFresh],
  ]
  return (
    <>
      <h2 className="font-display text-xl text-accent">Already use MiniTracker somewhere else?</h2>
      <p className="text-muted">{isDesktopApp() ? 'This app keeps its own data, separate from MiniTracker in your browser.' : 'Each browser and device keeps its own data.'} Bring yours over, or start fresh.</p>
      <ul className="grid gap-2">
        {choices.map(([title, what, act]) => (
          <li key={title}>
            <button className="btn flex w-full flex-wrap items-baseline justify-start gap-x-3 gap-y-1 p-3 text-left" onClick={act}>
              <b className="shrink-0">{title}</b>
              <span className="min-w-0 flex-1 text-muted">{what}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

function Tour({ onTry }: { onTry: (to: WelcomeGo) => void }) {
  return (
    <>
      <h2 className="font-display text-xl text-accent">Find your way</h2>
      <Points items={[
        ['Menu', 'every page is in the menu on the left (☰ on a phone)'],
        ['Game picker', 'at the top of the menu: one game, or All games, for Home, Backlog, Stats and Armies'],
        ['Home', 'your pile, recent progress and what to paint next; rearrange its cards'],
        ['Sync', 'keep your phone, browser and computer in step'],
        ['Settings', 'catalogues, appearance, pipelines, backups'],
      ]} />
      <button className="btn w-fit" onClick={() => onTry('guide')}>📖 Open the full user guide</button>
    </>
  )
}
