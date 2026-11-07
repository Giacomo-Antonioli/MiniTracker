import { create } from 'zustand'
import { canAutoUpdate } from '../../app/platform'

/** A newer signed release found by the desktop app's updater (#168). */
export interface AppUpdate {
  version: string
  /** Release notes, as published with the release. */
  body?: string
  downloadAndInstall: (onEvent?: (e: { event: string; data?: { contentLength?: number; chunkLength?: number } }) => void) => Promise<void>
}

interface UpdateState {
  update: AppUpdate | null
  /** idle → checking → found / none / failed */
  status: 'idle' | 'checking' | 'found' | 'none' | 'failed'
  error?: string
  /** Banner hidden with "Later" (until the next check). */
  dismissed: boolean
  check: () => Promise<void>
  dismiss: () => void
}

/** Shared by the start-up banner and Settings › Check for updates. Desktop app only; the web app updates itself. */
export const useUpdates = create<UpdateState>((set) => ({
  update: null,
  status: 'idle',
  dismissed: false,
  async check() {
    if (!canAutoUpdate()) return
    set({ status: 'checking', error: undefined, dismissed: false })
    try {
      const { check } = await import('@tauri-apps/plugin-updater')
      const u = (await check()) as unknown as AppUpdate | null
      set({ update: u, status: u ? 'found' : 'none' })
    } catch (e) {
      set({ status: 'failed', error: (e as Error).message || String(e) })
    }
  },
  dismiss: () => set({ dismissed: true }),
}))

/** Download, install and restart into the new version; reports progress as text. */
export async function installUpdate(u: AppUpdate, onProgress: (text: string) => void): Promise<void> {
  let total = 0
  let done = 0
  await u.downloadAndInstall((e) => {
    if (e.event === 'Started') total = e.data?.contentLength ?? 0
    if (e.event === 'Progress') done += e.data?.chunkLength ?? 0
    onProgress(e.event === 'Finished' ? 'Installing…' : total ? `Downloading… ${Math.round((done / total) * 100)}%` : 'Downloading…')
  })
  const { relaunch } = await import('@tauri-apps/plugin-process')
  await relaunch()
}

export const releaseUrl = (version: string) => `https://github.com/Giacomo-Antonioli/MiniTracker/releases/tag/v${version}`
