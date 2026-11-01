import { useState } from 'react'
import { useStore } from '../../app/store'
import { BSDATA_40K } from '../../data/catalogue/fetch'
import { ProgressBar } from '../../ui/Dialog'

export function CataloguePage() {
  const { catalogue, catalogueJob: job, downloadCatalogue, latestCatalogueCommit, importCatalogueFiles, removeCatalogue } = useStore()
  const [update, setUpdate] = useState<string | null>(null)
  const busy = job.phase !== 'idle'

  async function check() {
    try {
      const latest = await latestCatalogueCommit()
      setUpdate(latest === catalogue?.source.commit ? 'You have the latest data.' : 'A newer version is available.')
    } catch (e) {
      setUpdate((e as Error).message)
    }
  }

  const phaseText = {
    idle: '',
    checking: 'Checking the latest version…',
    downloading: `Downloading files ${job.done}/${job.total}…`,
    converting: 'Converting on this device…',
  }[job.phase]

  return (
    <div className="grid gap-4">
      <h2 className="font-display text-xl text-accent">Unit catalogue</h2>
      <p className="text-muted">
        Unit, points and wargear data comes from the community{' '}
        <a className="text-accent underline" href={`https://github.com/${BSDATA_40K.repo}`} target="_blank" rel="noreferrer">BSData</a>{' '}
        project. Your browser downloads it directly from BSData and converts it here; MiniTracker never hosts this data.
      </p>

      <section className="panel grid gap-2 p-4" aria-label="Catalogue status">
        {catalogue ? (
          <>
            <h3 className="font-display text-lg">{catalogue.gameName}</h3>
            <p className="text-sm">
              {catalogue.datasheets.length} units in {catalogue.factions.length} factions
            </p>
            <p className="text-sm text-muted">
              Source: {catalogue.source.repo}
              {catalogue.source.commit !== 'local' && <> @ <code>{catalogue.source.commit.slice(0, 7)}</code></>} · downloaded{' '}
              {new Date(catalogue.source.fetchedAt).toLocaleString()}
            </p>
          </>
        ) : (
          <p>No catalogue installed yet. Download it to pick units from a list and see points.</p>
        )}
        {busy && (
          <div className="grid gap-1" role="status">
            <span className="text-sm">{phaseText}</span>
            <ProgressBar ratio={job.phase === 'downloading' && job.total ? job.done / job.total : job.phase === 'converting' ? 1 : 0} />
          </div>
        )}
        {job.error && <p className="text-danger" role="alert">{job.error}</p>}
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={busy} onClick={() => void downloadCatalogue().then(() => setUpdate(null))}>
            ⬇ {catalogue ? 'Download latest' : 'Download Warhammer 40,000 data'}
          </button>
          {catalogue && (
            <button className="btn" disabled={busy} onClick={() => void check()}>Check for updates</button>
          )}
          {catalogue && (
            <button className="btn btn-danger" disabled={busy} onClick={() => confirm('Remove the catalogue? Your units are kept.') && void removeCatalogue()}>
              Remove
            </button>
          )}
        </div>
        {update && <p className="text-sm text-muted" role="status">{update}</p>}
      </section>

      <section className="panel grid gap-2 p-4">
        <h3 className="font-display text-lg">Import from files</h3>
        <p className="text-sm text-muted">
          If GitHub can't be reached, download the repository as a zip elsewhere, unzip it, and pick all its <code>.gst</code> and <code>.cat</code> files.
        </p>
        <label className={`btn w-fit ${busy ? 'pointer-events-none opacity-50' : ''}`}>
          Choose files…
          <input
            type="file"
            multiple
            accept=".gst,.cat"
            aria-label="Catalogue files"
            className="sr-only"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])]
              e.target.value = ''
              if (files.length) void importCatalogueFiles(files)
            }}
          />
        </label>
      </section>
    </div>
  )
}
