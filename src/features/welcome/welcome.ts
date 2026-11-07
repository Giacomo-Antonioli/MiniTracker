import { create } from 'zustand'

const KEY = 'welcomeDone'

function readDone(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

interface WelcomeState {
  /** The guide has been finished or skipped on this device. */
  done: boolean
  /** The guide is running (first start, or opened again from Settings). */
  open: boolean
  /** Hidden while the user tries a step on its page; a "Back to the guide" button brings it back. */
  paused: boolean
  /** Current step, kept while paused. */
  step: number
  /** Guided tour running over the demo collection (steps 5–8), or null. */
  touring: string | null
  /** First start: open the guide when nothing has been set up yet. */
  startIfNew: (hasData: boolean) => void
  setStep: (step: number) => void
  pause: () => void
  resume: () => void
  finish: () => void
  reopen: () => void
}

/** First-start welcome guide (#168): shown once per device; can be skipped, paused to try things, and opened again. */
export const useWelcome = create<WelcomeState>((set, get) => ({
  done: readDone(),
  open: false,
  paused: false,
  step: 0,
  touring: null,
  startIfNew(hasData) {
    if (!get().done && !hasData && !get().open) set({ open: true, paused: false, step: 0 })
  },
  setStep: (step) => set({ step }),
  pause: () => set({ paused: true }),
  resume: () => set({ paused: false }),
  finish() {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* not remembered: it shows again next start */
    }
    set({ done: true, open: false, paused: false, step: 0, touring: null })
  },
  reopen: () => set({ open: true, paused: false, step: 0 }),
}))
