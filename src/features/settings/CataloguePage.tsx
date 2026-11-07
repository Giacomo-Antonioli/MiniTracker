import { useState } from 'react'
import { useStore } from '../../app/store'
import { EDITIONS, type Edition } from '../../data/catalogue/fetch'
import { GAMES, type GameId } from '../../domain/catalogue/editions'
import type { Catalogue } from '../../domain/catalogue/types'
import { ProgressBar } from '../../ui/Dialog'

export function CataloguePage() {
  const { catalogues, catalogue: active, catalogueJob: job, importCatalogueFiles } = useStore()
  const busy = job.phase !== 'idle'
  const local = catalogues.filter((c) => c.source.repo === 'local files')

  return (
    <div className="grid gap-4">
      <h2 className="font-display text-xl text-accent">Unit catalogue</h2>
      <p className="text-muted">
        Unit, points, rules and wargear data comes from the community{' '}
        <a className="text-accent underline" href="https://github.com/BSData" target="_blank" rel="noreferrer">BSData</a> project (Middle-earth from the community{' '}
        <a className="text-accent underline" href="https://github.com/mhollink/mesbg-list-builder-v2024" target="_blank" rel="noreferrer">MESBG list builder</a>). Your browser downloads it
        directly from GitHub and converts it here; MiniTracker never hosts this data. You can install several games and editions and switch between them; the active one is used by the catalogue, the backlog and new lists.
      </p>

      {(Object.keys(GAMES) as GameId[]).map((g) => (
        <div key={g} className="grid gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{GAMES[g]}</h3>
          {EDITIONS.filter((e) => e.game === g).map((e) => (
            <EditionCard key={e.key} edition={e} installed={catalogues.find((c) => c.source.repo === e.repo)} active={active} />
          ))}
        </div>
      ))}
      {local.map((c) => (
        <EditionCard key={c.gameId} installed={c} active={active} />
      ))}

      {job.phase === 'converting' && job.repo === 'local files' && <p className="text-sm" role="status">Converting files…</p>}
      {job.error && job.repo === 'local files' && <p className="text-danger" role="alert">{job.error}</p>}

      <section className="panel grid gap-2 p-4">
        <h3 className="font-display text-lg">Import from files</h3>
        <p className="text-sm text-muted">
          If GitHub can't be reached, download a BSData repository as a zip elsewhere, unzip it, and pick all its <code>.gst</code>/<code>.cat</code> (10th)
          or <code>.json</code> (11th) files.
        </p>
        <label className={`btn w-fit ${busy ? 'pointer-events-none opacity-50' : ''}`}>
          Choose files…
          <input
            type="file"
            multiple
            accept=".gst,.cat,.json"
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
      <StratagemImport />
    </div>
  )
}

const WAHA = 'https://wahapedia.ru/wh40k11ed'

/** Stratagems can't be downloaded by the app (Wahapedia sends no CORS headers): you download the CSVs and pick them here. */
function StratagemImport() {
  const { stratagemData: data, importStratagems, removeStratagems } = useStore()
  const [error, setError] = useState('')
  return (
    <section className="panel grid gap-2 p-4" aria-label="Stratagems">
      <h3 className="font-semibold">Stratagems (Wahapedia)</h3>
      <p className="text-sm text-muted">
        For stratagem cards in the army PDF. Download{' '}
        <a className="underline hover:text-accent" href={`${WAHA}/Stratagems.csv`} target="_blank" rel="noreferrer">Stratagems.csv</a> and, for detachment rules,{' '}
        <a className="underline hover:text-accent" href={`${WAHA}/Detachment_abilities.csv`} target="_blank" rel="noreferrer">Detachment_abilities.csv</a>, then choose them here. Data powered by{' '}
        <a className="underline hover:text-accent" href={`${WAHA}/the-rules/data-export`} target="_blank" rel="noreferrer">Wahapedia</a>.
      </p>
      {data && (
        <p className="text-sm" role="status">
          {data.stratagems.length} stratagems, {data.detachmentRules.length} detachment rules · imported {new Date(data.importedAt).toLocaleDateString()}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="btn w-fit">
          {data ? 'Import again…' : 'Choose CSV files…'}
          <input
            type="file"
            multiple
            accept=".csv"
            aria-label="Stratagem files"
            className="sr-only"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])]
              e.target.value = ''
              setError('')
              if (files.length) importStratagems(files).catch((err: Error) => setError(err.message))
            }}
          />
        </label>
        {data && <button className="btn btn-danger" onClick={() => void removeStratagems()}>Remove</button>}
      </div>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </section>
  )
}

function EditionCard({ edition, installed, active }: { edition?: Edition; installed?: Catalogue; active: Catalogue | null }) {
  const { catalogueJob: job, downloadCatalogue, latestCatalogueCommit, removeCatalogue, setActiveCatalogue } = useStore()
  const [update, setUpdate] = useState<string | null>(null)
  const repo = edition?.repo ?? installed!.source.repo
  const title = edition?.label ?? installed!.gameName
  const mine = job.repo === repo
  const busy = job.phase !== 'idle'
  const isActive = !!installed && active?.gameId === installed.gameId
  const phaseText = {
    idle: '',
    checking: 'Checking the latest version…',
    downloading: `Downloading files ${job.done}/${job.total}…`,
    converting: 'Converting on this device…',
  }[job.phase]

  return (
    <section className={`panel grid gap-2 p-4 ${isActive ? 'border-accent' : ''}`} aria-label={`Catalogue ${title}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg">
          {title} {isActive && <span className="ml-2 rounded border border-accent px-1.5 text-xs text-accent">active</span>}
        </h3>
        {edition && (
          <a className="text-xs text-muted underline" href={`https://github.com/${repo}`} target="_blank" rel="noreferrer">{repo}</a>
        )}
      </div>
      {installed ? (
        <>
          <p className="text-sm">
            {installed.datasheets.length} units in {installed.factions.length} factions{installed.rules ? `, ${installed.rules.length} rules` : ''}
          </p>
          <p className="text-sm text-muted">
            {installed.source.commit !== 'local' && (
              <>
                Version <code>{installed.source.commit.slice(0, 7)}</code> ·{' '}
              </>
            )}
            downloaded {new Date(installed.source.fetchedAt).toLocaleString()}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted">Not installed.</p>
      )}
      {mine && busy && (
        <div className="grid gap-1" role="status">
          <span className="text-sm">{phaseText}</span>
          <ProgressBar ratio={job.phase === 'downloading' && job.total ? job.done / job.total : job.phase === 'converting' ? 1 : 0} />
        </div>
      )}
      {mine && job.error && <p className="text-danger" role="alert">{job.error}</p>}
      <div className="flex flex-wrap gap-2">
        {installed && !isActive && (
          <button className="btn btn-primary" onClick={() => void setActiveCatalogue(installed.gameId)}>Use this edition</button>
        )}
        {edition && (
          <button className={`btn ${installed ? '' : 'btn-primary'}`} disabled={busy} onClick={() => void downloadCatalogue(repo).then(() => setUpdate(null))}>
            ⬇ {installed ? 'Download latest' : `Download ${title}`}
          </button>
        )}
        {installed && edition && (
          <button
            className="btn"
            disabled={busy}
            onClick={async () => {
              try {
                const latest = await latestCatalogueCommit(repo)
                setUpdate(latest === installed.source.commit ? 'You have the latest data.' : 'A newer version is available.')
              } catch (e) {
                setUpdate((e as Error).message)
              }
            }}
          >
            Check for updates
          </button>
        )}
        {installed && (
          <button className="btn btn-danger" disabled={busy} onClick={() => confirm(`Remove ${title}? Your units are kept.`) && void removeCatalogue(installed.gameId)}>
            Remove
          </button>
        )}
      </div>
      {update && <p className="text-sm text-muted" role="status">{update}</p>}
    </section>
  )
}
