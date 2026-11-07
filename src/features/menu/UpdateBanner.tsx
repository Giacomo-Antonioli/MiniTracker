import { useEffect, useState } from 'react'
import { isDesktopApp } from '../../app/platform'

type Update = { version: string; downloadAndInstall: (onEvent?: (e: { event: string; data?: { contentLength?: number; chunkLength?: number } }) => void) => Promise<void> }

/**
 * Desktop app auto-update (#168): on start, asks GitHub releases for a newer signed version and offers to install it.
 * The web app updates itself (service worker), so this shows only in the desktop app.
 */
export function UpdateBanner() {
  const [update, setUpdate] = useState<Update | null>(null)
  const [progress, setProgress] = useState<string>()
  const [error, setError] = useState('')
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!isDesktopApp()) return
    let live = true
    void import('@tauri-apps/plugin-updater')
      .then(({ check }) => check())
      .then((u) => live && u && setUpdate(u as unknown as Update))
      .catch(() => {
        /* offline or no release yet: try again next start */
      })
    return () => {
      live = false
    }
  }, [])

  if (!update || hidden) return null
  const install = async () => {
    setError('')
    let total = 0
    let done = 0
    try {
      await update.downloadAndInstall((e) => {
        if (e.event === 'Started') total = e.data?.contentLength ?? 0
        if (e.event === 'Progress') done += e.data?.chunkLength ?? 0
        setProgress(e.event === 'Finished' ? 'Installing…' : total ? `Downloading… ${Math.round((done / total) * 100)}%` : 'Downloading…')
      })
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
    } catch (e) {
      setProgress(undefined)
      setError((e as Error).message || String(e))
    }
  }
  return (
    <div className="panel mb-3 flex flex-wrap items-center gap-2 border-accent p-3 text-sm" role="status" aria-label="App update">
      <span className="flex-1">MiniTracker {update.version} is available.{progress && ` ${progress}`}</span>
      {error && <span className="text-danger" role="alert">{error}</span>}
      {!progress && (
        <>
          <button className="btn btn-primary" onClick={() => void install()}>Install and restart</button>
          <button className="btn" onClick={() => setHidden(true)}>Later</button>
        </>
      )}
    </div>
  )
}
