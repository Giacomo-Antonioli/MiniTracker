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
  /** Open again from Settings, even when done. */
  reopened: boolean
  finish: () => void
  reopen: () => void
}

/** First-start welcome guide (#168): shown once per device; can be skipped and opened again from Settings. */
export const useWelcome = create<WelcomeState>((set) => ({
  done: readDone(),
  reopened: false,
  finish() {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* not remembered: it shows again next start */
    }
    set({ done: true, reopened: false })
  },
  reopen: () => set({ reopened: true }),
}))

/** Show it on a first start (nothing in the collection yet) or when reopened. */
export const shouldShowWelcome = (s: { done: boolean; reopened: boolean }, hasData: boolean) => s.reopened || (!s.done && !hasData)
