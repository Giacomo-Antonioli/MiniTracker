import type { ReactNode } from 'react'
import { THEMES, useStore, type Theme } from '../../app/store'
import { isDesktopApp } from '../../app/platform'
import { EDITIONS, GAMES, type GameId } from '../../domain/catalogue/editions'
import { AUTO, UI_SCALES, effectiveScale, scaleLabel } from '../../domain/settings/uiScale'
import { Dialog, ProgressBar } from '../../ui/Dialog'
import { endDemo, startDemo } from './demo'
import { Tour } from './Tour'
import { TOURS, type TourName } from './tours'
import { useWelcome } from './welcome'
import { i18n, useT } from '../../i18n'
import { LanguagePicker } from '../../i18n/LanguagePicker'


/** Guide steps that are guided tours (5–9): reaching them starts the tour straight away. */
const STEP_TOURS: Record<number, TourName> = { 4: 'units', 5: 'paints', 6: 'workshop', 7: 'armies', 8: 'more' }

/** Go to a guide step; a tour step starts its tour. */
export function goToStep(step: number) {
  useWelcome.setState({ step })
  const tour = STEP_TOURS[step]
  if (tour) void beginTour(tour)
}

/** Start a guided tour: the guide steps aside and the pages show the demo collection. */
async function beginTour(name: TourName) {
  await startDemo()
  useWelcome.setState({ touring: name, paused: true })
}

/** The tour running, if any; at its end the user's data comes back and the guide carries on. */
export function WelcomeTour({ onGo }: { onGo: (to: WelcomeGo) => void }) {
  const touring = useWelcome((w) => w.touring) as TourName | null
  if (!touring) return null
  const t = TOURS[touring]
  const tr = i18n.t(`tours.${touring}`, { returnObjects: true }) as { name: string; steps: { title: string; text: string }[] }
  return (
    <Tour
      name={tr.name}
      steps={t.steps.map((s, i) => ({ ...s, ...tr.steps[i] }))}
      onGo={onGo}
      onEnd={(completed) => {
        endDemo()
        const { step } = useWelcome.getState()
        useWelcome.setState({ touring: null, paused: false })
        // Finished: on to the next step (the next tour, if it is one). Ended early: back to this step's page.
        if (completed && step < STEPS.length - 1) goToStep(step + 1)
      }}
    />
  )
}

/** Where a guide button takes you: an app page, Settings › Backup, or the online user guide. */
export type WelcomeGo = 'home' | 'backlog' | 'browse' | 'rules' | 'paints' | 'schemes' | 'shopping' | 'tools' | 'supplies' | 'storage' | 'companion' | 'armies' | 'games' | 'stats' | 'goals' | 'sync' | 'settings' | 'backup' | 'guide'

/** Step names are in the translations (welcome.stepNames); there are nine. */
const STEPS = { length: 9 }
const useStepNames = () => useT()('welcome.stepNames', { returnObjects: true }) as unknown as string[]

/**
 * First-start guide (#168): sets the app up and shows each part. "Try it" buttons open the page and pause the guide;
 * a "Back to the guide" button (WelcomeResume) brings it back at the same step. Skippable at any step.
 */
export function WelcomeGuide({ onGo }: { onGo: (to: WelcomeGo) => void }) {
  const t = useT()
  const names = useStepNames()
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
    <Dialog title={t('welcome.title')} onClose={() => leave()} wide>
      <div className="grid gap-4 p-4" aria-label={t('welcome.label')}>
        <ol className="flex flex-wrap gap-1 text-xs" aria-label={t('welcome.steps')}>
          {names.map((s, i) => (
            <li key={i}>
              <button className={`rounded px-2 py-0.5 ${i === step ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`} aria-current={i === step ? 'step' : undefined} onClick={() => goToStep(i)}>
                {i + 1}. {s}
              </button>
            </li>
          ))}
        </ol>

        <section className="grid min-h-56 content-start gap-3" aria-label={names[step]}>
          {step === 0 && <Intro />}
          {step === 1 && <Games />}
          {step === 2 && <Look />}
          {step === 3 && <Data onTry={tryIt} onFresh={() => goToStep(4)} />}
          {step === 4 && (
            <Topic title={t('welcome.units.title')} tour="units" actions={[[t('welcome.units.open'), 'backlog']]} onTry={tryIt}>
              <p dangerouslySetInnerHTML={{ __html: t('welcome.units.intro') }} />
              <Points items={t('welcome.units.points', { returnObjects: true }) as unknown as [string, string][]} />
            </Topic>
          )}
          {step === 5 && (
            <Topic title={t('welcome.paints.title')} tour="paints" actions={[[t('welcome.paints.openPaints'), 'paints'], [t('welcome.paints.openSchemes'), 'schemes']]} onTry={tryIt}>
              <p dangerouslySetInnerHTML={{ __html: t('welcome.paints.intro') }} />
              <Points items={t('welcome.paints.points', { returnObjects: true }) as unknown as [string, string][]} />
            </Topic>
          )}
          {step === 6 && (
            <Topic title={t('welcome.workshop.title')} tour="workshop" actions={[[t('welcome.workshop.openTools'), 'tools'], [t('welcome.workshop.openSupplies'), 'supplies'], [t('welcome.workshop.openStorage'), 'storage']]} onTry={tryIt}>
              <p>{t('welcome.workshop.intro')}</p>
              <Points items={t('welcome.workshop.points', { returnObjects: true }) as unknown as [string, string][]} />
            </Topic>
          )}
          {step === 7 && (
            <Topic title={t('welcome.armies.title')} tour="armies" actions={[[t('welcome.armies.openArmies'), 'armies'], [t('welcome.armies.openGames'), 'games'], [t('welcome.armies.openStats'), 'stats']]} onTry={tryIt}>
              <Points items={t('welcome.armies.points', { returnObjects: true }) as unknown as [string, string][]} />
            </Topic>
          )}
          {step === 8 && <FindYourWay onTry={tryIt} onTour={() => void beginTour('more')} />}
        </section>

        <footer className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <button className="btn" onClick={() => leave()}>{t('welcome.skip')}</button>
          <span className="flex-1 text-center text-xs text-muted">{step + 1} / {STEPS.length}</span>
          {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}>{t('welcome.back')}</button>}
          {/* Focused, so Enter or Space goes to the next step (not the ✕ close button). */}
          {last ? <button key="start" className="btn btn-primary" autoFocus data-autofocus onClick={() => leave()}>{t('welcome.start')}</button> : <button key={`next-${step}`} className="btn btn-primary" autoFocus data-autofocus onClick={() => goToStep(step + 1)}>{t('welcome.next')}</button>}
        </footer>
      </div>
    </Dialog>
  )
}

/** While the guide is paused: a button to go back to it, at the same step. */
export function WelcomeResume() {
  const t = useT()
  const { open, paused, step, touring, resume, finish } = useWelcome()
  if (!open || !paused || touring) return null
  return (
    <div className="panel fixed right-4 bottom-20 z-40 flex items-center gap-2 border-accent p-2 text-sm shadow-lg sm:bottom-4" role="status" aria-label={t('welcome.paused')}>
      <button className="btn btn-primary" onClick={resume}>{t('welcome.resume', { step: step + 1, total: STEPS.length })}</button>
      <button className="text-muted hover:text-fg" aria-label={t('welcome.end')} onClick={finish}>✕</button>
    </div>
  )
}

function Topic({ title, tour, actions, onTry, children }: { title: string; tour: TourName; actions: [string, WelcomeGo][]; onTry: (to: WelcomeGo) => void; children: ReactNode }) {
  const t = useT()
  return (
    <>
      <h2 className="font-display text-xl text-accent">{title}</h2>
      {children}
      <div className="grid gap-2 border-t border-line pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-primary" onClick={() => void beginTour(tour)}>{t('welcome.showAgain')}</button>
          <span className="text-sm text-muted">{t('welcome.tourHelp')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions.map(([label, to]) => <button key={to} className="btn text-sm" onClick={() => onTry(to)}>{label}</button>)}
          <span className="text-sm text-muted">{t('welcome.tryHelp')}</span>
        </div>
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
  const t = useT()
  return (
    <>
      <h2 className="font-display text-xl text-accent">{t('welcome.intro.title')}</h2>
      <LanguagePicker />
      <p>{t('welcome.intro.what')}</p>
      <p className="text-muted">{t('welcome.intro.local')}</p>
      <p className="text-sm text-muted">{t('welcome.intro.how')}</p>
    </>
  )
}

function Games() {
  const t = useT()
  const { catalogues, catalogueJob: job, downloadCatalogue } = useStore()
  const busy = job.phase !== 'idle'
  return (
    <>
      <h2 className="font-display text-xl text-accent">{t('welcome.games.title')}</h2>
      <p className="text-sm text-muted">{t('welcome.games.help')}</p>
      <ul className="grid gap-2">
        {(Object.keys(GAMES) as GameId[]).map((g) => {
          const e = EDITIONS.find((x) => x.game === g)!
          const have = catalogues.some((c) => c.source.repo === e.repo)
          const mine = job.repo === e.repo
          return (
            <li key={g} className="flex flex-wrap items-center gap-2">
              <span className="flex-1">{GAMES[g]} <span className="text-sm text-muted">· {e.label}</span></span>
              {have ? <span className="text-ok">{t('welcome.games.installed')}</span> : <button className="btn text-sm" disabled={busy} onClick={() => void downloadCatalogue(e.repo)}>{t('welcome.games.download')}</button>}
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
  const t = useT()
  const { theme, setTheme, uiScale, setUiScale } = useStore()
  const shown = effectiveScale(uiScale, window.innerWidth)
  return (
    <>
      <h2 className="font-display text-xl text-accent">{t('welcome.look.title')}</h2>
      <label className="flex items-center gap-3">
        {t('settings.theme')}
        <select className="input" value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
          {Object.entries(THEMES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
      <label className="flex flex-wrap items-center gap-3">
        {t('settings.size')}
        <input className="w-40 accent-[var(--accent)]" type="range" min={0} max={UI_SCALES.length - 1} step={1} aria-label={t('settings.size')} value={UI_SCALES.indexOf(shown as (typeof UI_SCALES)[number])} onChange={(e) => setUiScale(UI_SCALES[Number(e.target.value)])} />
        <span className="tabular-nums">{scaleLabel(shown)}{uiScale === AUTO && t('settings.autoSuffix')}</span>
        {uiScale !== AUTO && <button type="button" className="btn px-2 py-0.5 text-sm" onClick={() => setUiScale(AUTO)}>{t('settings.auto')}</button>}
      </label>
      <p className="text-sm text-muted">{t('welcome.look.help')}</p>
    </>
  )
}

function Data({ onTry, onFresh }: { onTry: (to: WelcomeGo) => void; onFresh: () => void }) {
  const t = useT()
  const choices: [string, string, () => void][] = [
    [t('welcome.data.sync'), t('welcome.data.syncHelp'), () => onTry('sync')],
    [t('welcome.data.restore'), t('welcome.data.restoreHelp'), () => onTry('backup')],
    [t('welcome.data.fresh'), t('welcome.data.freshHelp'), onFresh],
  ]
  return (
    <>
      <h2 className="font-display text-xl text-accent">{t('welcome.data.title')}</h2>
      <p className="text-muted">{isDesktopApp() ? t('welcome.data.desktop') : t('welcome.data.browser')}{t('welcome.data.bring')}</p>
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

function FindYourWay({ onTry, onTour }: { onTry: (to: WelcomeGo) => void; onTour: () => void }) {
  const t = useT()
  return (
    <>
      <h2 className="font-display text-xl text-accent">{t('welcome.way.title')}</h2>
      <Points items={t('welcome.way.points', { returnObjects: true }) as unknown as [string, string][]} />
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={onTour}>{t('welcome.showAgain')}</button>
        <button className="btn" onClick={() => onTry('guide')}>{t('welcome.way.fullGuide')}</button>
      </div>
    </>
  )
}
