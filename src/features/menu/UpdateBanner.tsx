import { useEffect, useState } from 'react'
import { canAutoUpdate } from '../../app/platform'
import { installUpdate, releaseUrl, useUpdates } from './updates'

/** Desktop app (#168): on start, looks for a newer release and offers to install it, with its release notes. */
export function UpdateBanner() {
  const { update, status, dismissed, check, dismiss } = useUpdates()
  const [progress, setProgress] = useState<string>()
  const [error, setError] = useState('')

  useEffect(() => {
    if (canAutoUpdate() && useUpdates.getState().status === 'idle') void check()
  }, [check])

  if (!update || status !== 'found' || dismissed) return null
  return (
    <div className="panel mb-3 grid gap-2 border-accent p-3 text-sm" role="status" aria-label="App update">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1">MiniTracker {update.version} is available.{progress && ` ${progress}`}</span>
        {error && <span className="text-danger" role="alert">{error}</span>}
        {!progress && (
          <>
            <button
              className="btn btn-primary"
              onClick={() => {
                setError('')
                installUpdate(update, setProgress).catch((e: Error) => {
                  setProgress(undefined)
                  setError(e.message || String(e))
                })
              }}
            >
              Install and restart
            </button>
            <button className="btn" onClick={dismiss}>Later</button>
          </>
        )}
      </div>
      <details>
        <summary className="cursor-pointer text-muted">What's new</summary>
        {update.body?.trim() ? <div className="mt-1 whitespace-pre-wrap">{update.body.trim()}</div> : null}
        <a className="text-accent underline" href={releaseUrl(update.version)} target="_blank" rel="noreferrer">Release notes on GitHub</a>
      </details>
    </div>
  )
}
