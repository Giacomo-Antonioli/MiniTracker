import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useEffect, useRef } from 'react'
import type { WelcomeGo } from './WelcomeGuide'
import { findTarget, type TourStep } from './tourTarget'

/** Waits until a step's element is on the page (pages render after navigation), up to about two seconds. */
async function waitFor(step: TourStep): Promise<Element | undefined> {
  for (let i = 0; i < 20; i++) {
    const el = findTarget(step.target)
    if (el || !step.target) return el ?? undefined
    await new Promise((r) => setTimeout(r, 100))
  }
  return undefined
}

/**
 * Guided tour over the real pages (#168), drawn by driver.js: it dims the screen, highlights the element of each
 * step and explains it in a popover. Steps can be on different pages; the tour opens each page before moving on.
 * The highlighted element can't be clicked (disableActiveInteraction) and clicks on the dimmed page do nothing,
 * so the demo data is never changed.
 */
export function Tour({ name, steps, onGo, onEnd }: { name: string; steps: TourStep[]; onGo: (to: WelcomeGo) => void; onEnd: (completed: boolean) => void }) {
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
    /** Open the step's page, wait for its element, then show it. */
    const show = async (i: number) => {
      const s = steps[i]
      go.current(s.page)
      await waitFor(s)
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
        element: s.target ? () => findTarget(s.target) ?? document.body : undefined,
        popover: { title: s.title, description: `${s.text}<p class="mt-tour-note">Demo data · nothing is saved</p>` },
      })),
      onNextClick: () => {
        const i = d!.getActiveIndex() ?? 0
        if (i >= steps.length - 1) finish(true)
        else void show(i + 1)
      },
      onPrevClick: () => {
        const i = d!.getActiveIndex() ?? 0
        if (i > 0) void show(i - 1)
      },
      // × and Escape ask to close here; Done ends through finish(true) above.
      onDestroyStarted: () => finish(false),
    })
    void show(0)
    return () => {
      live = false
      over = true
      d?.destroy()
    }
    // The tour runs once per mount; App remounts it for another tour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
