import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../app/store'
import type { WelcomeGo } from './WelcomeGuide'
import { findTarget, runActions, waitForTarget, type TourStep } from './tourTarget'

/** A 1-pixel element in the middle of the screen, for steps whose element isn't on the page. */
function anchor(): Element {
  let a = document.getElementById('tour-anchor')
  if (!a) {
    a = document.createElement('div')
    a.id = 'tour-anchor'
    a.setAttribute('aria-hidden', 'true')
    a.style.cssText = 'position:fixed;left:50%;top:40%;width:1px;height:1px;pointer-events:none'
    document.body.appendChild(a)
  }
  return a
}

/**
 * Guided tour over the real pages (#168), drawn by driver.js: it dims the screen, highlights the element of each
 * step and explains it in a popover. Steps can be on different pages; the tour opens each page before moving on.
 * The highlighted element can't be clicked (disableActiveInteraction) and clicks on the dimmed page do nothing,
 * so the demo data is never changed.
 */
export function Tour({ name, steps: allSteps, onGo, onEnd }: { name: string; steps: TourStep[]; onGo: (to: WelcomeGo) => void; onEnd: (completed: boolean) => void }) {
  // Steps for pages built from a catalogue only when one is installed.
  const [steps] = useState(() => allSteps.filter((s) => !s.needsCatalogue || useStore.getState().catalogues.length > 0))
  const ended = useRef(onEnd)
  ended.current = onEnd
  const go = useRef(onGo)
  go.current = onGo

  useEffect(() => {
    let d: Driver | undefined
    let live = true
    let over = false
    /** End once, whichever way: Done, ×, Escape. (driver.js skips onDestroyed in some states, so not relied on.) */
    const finish = (completed: boolean) => {
      if (over) return
      over = true
      d?.destroy()
      if (live) ended.current(completed)
    }
    /** Steps whose mock actions already ran (going Back doesn't redo them). */
    const acted = new Set<number>()
    let busy = false
    /** Open the step's page, act out its mock (once), wait for its element, then show it. */
    const show = async (i: number) => {
      if (busy) return
      busy = true
      const s = steps[i]
      go.current(s.page)
      if (s.before && !acted.has(i)) {
        acted.add(i)
        // The popover steps aside while the mock acts, so the user sees it happen.
        if (d?.isActive()) (document.querySelector('.driver-popover') as HTMLElement | null)?.style.setProperty('visibility', 'hidden')
        await runActions(s.before)
      }
      if (s.target && !(await waitForTarget(s))) console.warn(`Tour step without its element: ${name} › ${s.title}`)
      busy = false
      if (!live || !d) return
      if (d.isActive()) d.moveTo(i)
      else d.drive(i)
    }
    d = driver({
      popoverClass: 'mt-tour',
      showProgress: true,
      progressText: `${name} · {{current}} / {{total}}`,
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Done',
      allowClose: true,
      overlayClickBehavior: 'none',
      disableActiveInteraction: true,
      smoothScroll: true,
      stagePadding: 6,
      stageRadius: 6,
      steps: steps.map((s) => ({
        // Looked up when the step is shown, on the page the tour just opened.
        // Not found: a centred invisible anchor (never the body: driver.js would make the whole page, popover
        // included, unclickable).
        element: s.target ? () => findTarget(s.target) ?? anchor() : undefined,
        popover: { title: s.title, description: `${s.text}<p class="mt-tour-note">Demo data · nothing is saved</p>` },
      })),
      onNextClick: () => next(),
      onPrevClick: () => {
        const i = d!.getActiveIndex() ?? 0
        if (i > 0) void show(i - 1)
      },
      // × and Escape ask to close here; Done ends through finish(true) above.
      onDestroyStarted: () => finish(false),
    })
    /** One step on (Done on the last one). */
    function next() {
      const i = d!.getActiveIndex() ?? 0
      if (i >= steps.length - 1) finish(true)
      else void show(i + 1)
    }
    // Enter or Space: the next step, one at a time (never the popover's × button, which would end the tour).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]')) return
      e.preventDefault()
      e.stopPropagation()
      if (!busy) next()
    }
    window.addEventListener('keydown', onKey, true)
    void show(0)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      live = false
      over = true
      d?.destroy()
      document.getElementById('tour-anchor')?.remove()
    }
    // The tour runs once per mount; App remounts it for another tour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
