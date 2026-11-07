import { useState } from 'react'
import { useStore } from '../../app/store'
import { ProgressBar } from '../../ui/Dialog'
import { useTx } from '../../i18n'

const DISMISS_KEY = 'catalogueBannerDismissed'

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/** Shown on the backlog while no unit catalogue is installed. */
export function CatalogueBanner() {
  const tx = useTx()
  const { catalogue, catalogueJob: job, downloadCatalogue } = useStore()
  const [dismissed, setDismissed] = useState(readDismissed)
  if (catalogue || dismissed) return null
  const busy = job.phase !== 'idle'

  return (
    <section className="panel flex flex-wrap items-center gap-3 border-accent/60 p-3" aria-label={tx('Catalogue missing')}>
      <span aria-hidden="true">📜</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{tx('No unit catalogue yet')}</p>
        <p className="text-sm text-muted">
          {tx('Download Warhammer 40,000 data (11th edition, from BSData) to pick units from a list and see their points. 10th edition is available in Settings → Catalogue data.')}
        </p>
        {busy && (
          <div className="mt-2 grid gap-1" role="status">
            <span className="text-xs">
              {job.phase === 'downloading' ? tx('Downloading files {{done}}/{{total}}…', { done: job.done, total: job.total }) : job.phase === 'converting' ? tx('Converting on this device…') : tx('Checking the latest version…')}
            </span>
            <ProgressBar ratio={job.phase === 'downloading' && job.total ? job.done / job.total : job.phase === 'converting' ? 1 : 0} />
          </div>
        )}
        {job.error && <p className="mt-1 text-sm text-danger" role="alert">{job.error}</p>}
      </div>
      <button className="btn btn-primary" disabled={busy} onClick={() => void downloadCatalogue()}>{tx('⬇ Download')}</button>
      <button
        className="btn"
        aria-label={tx('Hide this message')}
        onClick={() => {
          try {
            localStorage.setItem(DISMISS_KEY, '1')
          } catch {
            /* not remembered */
          }
          setDismissed(true)
        }}
      >
        ✕
      </button>
    </section>
  )
}
