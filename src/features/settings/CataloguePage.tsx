import { useState } from 'react'
import { useStore } from '../../app/store'
import { EDITIONS, type Edition } from '../../data/catalogue/fetch'
import { GAMES, type GameId } from '../../domain/catalogue/editions'
import type { Catalogue } from '../../domain/catalogue/types'
import { ProgressBar } from '../../ui/Dialog'
import { buildBundle } from '../../data/catalogue/bundle'
import { useT, useTx } from '../../i18n'
import { formatDate } from '../../i18n/format'

export function CataloguePage() {
  const t = useT()
  const tx = useTx()
  const { catalogues, catalogue: active, catalogueJob: job, importCatalogueFiles } = useStore()
  const busy = job.phase !== 'idle'
  const local = catalogues.filter((c) => c.source.repo === 'local files')

  return (
    <div className="grid gap-4">
      <h2 className="font-display text-xl text-accent">{t('settingsPanels.catalogue.title')}</h2>
      <p className="text-muted">
        {t('settingsPanels.catalogue.intro1')}{' '}
        <a className="text-accent underline" href="https://github.com/BSData" target="_blank" rel="noreferrer">BSData</a> {t('settingsPanels.catalogue.intro2')}{' '}
        <a className="text-accent underline" href="https://github.com/mhollink/mesbg-list-builder-v2024" target="_blank" rel="noreferrer">{t('settingsPanels.catalogue.mesbg')}</a>{t('settingsPanels.catalogue.intro3')}
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

      {job.phase === 'converting' && job.repo === 'local files' && <p className="text-sm" role="status">{t('settingsPanels.catalogue.converting')}</p>}
      {job.error && job.repo === 'local files' && <p className="text-danger" role="alert">{job.error}</p>}

      <section className="panel grid gap-2 p-4">
        <h3 className="font-display text-lg">{t('settingsPanels.catalogue.importTitle')}</h3>
        <p className="text-sm text-muted">
          {t('settingsPanels.catalogue.importHelp')}
        </p>
        <label className={`btn w-fit ${busy ? 'pointer-events-none opacity-50' : ''}`}>
          {t('settingsPanels.catalogue.choose')}
          <input
            type="file"
            multiple
            accept=".gst,.cat,.json,.gz"
            aria-label={t('settingsPanels.catalogue.files')}
            className="sr-only"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])]
              e.target.value = ''
              if (files.length) void importCatalogueFiles(files)
            }}
          />
        </label>
        <p className="text-sm text-muted">{tx('You can also pick a catalogue file exported from MiniTracker on another device or browser.')}</p>
      </section>
      <section className="panel grid gap-2 p-4">
        <h3 className="font-display text-lg">{tx('Save your catalogues')}</h3>
        <p className="text-sm text-muted">{tx('Catalogues live only in this browser or app and are not part of backups or sync. Export them to one file to keep a copy or load them on another device (Import above).')}</p>
        <button
          className="btn w-fit"
          disabled={catalogues.length === 0}
          onClick={async () => {
            const bytes = await buildBundle(catalogues, new Date().toISOString())
            const gz = bytes[0] === 0x1f
            const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: gz ? 'application/gzip' : 'application/json' }))
            const a = document.createElement('a')
            a.href = url
            a.download = `minitracker-catalogues-${new Date().toISOString().slice(0, 10)}.json${gz ? '.gz' : ''}`
            a.click()
            URL.revokeObjectURL(url)
          }}
        >
          {tx('⬇ Export catalogues')}
        </button>
      </section>
      <StratagemImport />
    </div>
  )
}

const WAHA = 'https://wahapedia.ru/wh40k11ed'

/** Stratagems can't be downloaded by the app (Wahapedia sends no CORS headers): you download the CSVs and pick them here. */
function StratagemImport() {
  const t = useT()
  const { stratagemData: data, importStratagems, removeStratagems } = useStore()
  const [error, setError] = useState('')
  return (
    <section className="panel grid gap-2 p-4" aria-label={t('settingsPanels.catalogue.stratagems')}>
      <h3 className="font-semibold">{t('settingsPanels.catalogue.stratTitle')}</h3>
      <p className="text-sm text-muted">
        {t('settingsPanels.catalogue.stratHelp1')}{' '}
        <a className="underline hover:text-accent" href={`${WAHA}/Stratagems.csv`} target="_blank" rel="noreferrer">Stratagems.csv</a> {t('settingsPanels.catalogue.stratHelp2')}{' '}
        <a className="underline hover:text-accent" href={`${WAHA}/Detachment_abilities.csv`} target="_blank" rel="noreferrer">Detachment_abilities.csv</a>{t('settingsPanels.catalogue.stratHelp3')}{' '}
        <a className="underline hover:text-accent" href={`${WAHA}/the-rules/data-export`} target="_blank" rel="noreferrer">Wahapedia</a>.
      </p>
      {data && (
        <p className="text-sm" role="status">
          {t('settingsPanels.catalogue.stratStatus', { stratagems: data.stratagems.length, rules: data.detachmentRules.length, date: formatDate(data.importedAt) })}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="btn w-fit">
          {data ? t('settingsPanels.catalogue.importAgain') : t('settingsPanels.catalogue.chooseCsv')}
          <input
            type="file"
            multiple
            accept=".csv"
            aria-label={t('settingsPanels.catalogue.stratFiles')}
            className="sr-only"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])]
              e.target.value = ''
              setError('')
              if (files.length) importStratagems(files).catch((err: Error) => setError(err.message))
            }}
          />
        </label>
        {data && <button className="btn btn-danger" onClick={() => void removeStratagems()}>{t('settingsPanels.catalogue.remove')}</button>}
      </div>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </section>
  )
}

function EditionCard({ edition, installed, active }: { edition?: Edition; installed?: Catalogue; active: Catalogue | null }) {
  const t = useT()
  const { catalogueJob: job, downloadCatalogue, latestCatalogueCommit, removeCatalogue, setActiveCatalogue } = useStore()
  const [update, setUpdate] = useState<string | null>(null)
  const repo = edition?.repo ?? installed!.source.repo
  const title = edition?.label ?? installed!.gameName
  const mine = job.repo === repo
  const busy = job.phase !== 'idle'
  const isActive = !!installed && active?.gameId === installed.gameId
  const phaseText = {
    idle: '',
    checking: t('settingsPanels.catalogue.checkingLatest'),
    downloading: t('settingsPanels.catalogue.downloading', { done: job.done, total: job.total }),
    converting: t('settingsPanels.catalogue.convertingHere'),
  }[job.phase]

  return (
    <section className={`panel grid gap-2 p-4 ${isActive ? 'border-accent' : ''}`} aria-label={t('settingsPanels.catalogue.card', { title })}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg">
          {title} {isActive && <span className="ml-2 rounded border border-accent px-1.5 text-xs text-accent">{t('settingsPanels.catalogue.active')}</span>}
        </h3>
        {edition && (
          <a className="text-xs text-muted underline" href={`https://github.com/${repo}`} target="_blank" rel="noreferrer">{repo}</a>
        )}
      </div>
      {installed ? (
        <>
          <p className="text-sm">
            {t('settingsPanels.catalogue.counts', { units: installed.datasheets.length, factions: installed.factions.length })}{installed.rules ? t('settingsPanels.catalogue.rules', { count: installed.rules.length }) : ''}
          </p>
          <p className="text-sm text-muted">
            {installed.source.commit !== 'local' && (
              <>
                {t('settingsPanels.catalogue.version')} <code>{installed.source.commit.slice(0, 7)}</code> ·{' '}
              </>
            )}
            {t('settingsPanels.catalogue.downloaded', { date: formatDate(installed.source.fetchedAt, { dateStyle: 'medium', timeStyle: 'short' }) })}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted">{t('settingsPanels.catalogue.notInstalled')}</p>
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
          <button className="btn btn-primary" onClick={() => void setActiveCatalogue(installed.gameId)}>{t('settingsPanels.catalogue.use')}</button>
        )}
        {edition && (
          <button className={`btn ${installed ? '' : 'btn-primary'}`} disabled={busy} onClick={() => void downloadCatalogue(repo).then(() => setUpdate(null))}>
            ⬇ {installed ? t('settingsPanels.catalogue.downloadLatest') : t('settingsPanels.catalogue.download', { title })}
          </button>
        )}
        {installed && edition && (
          <button
            className="btn"
            disabled={busy}
            onClick={async () => {
              try {
                const latest = await latestCatalogueCommit(repo)
                setUpdate(latest === installed.source.commit ? t('settingsPanels.catalogue.latest') : t('settingsPanels.catalogue.newer'))
              } catch (e) {
                setUpdate((e as Error).message)
              }
            }}
          >
            {t('settingsPanels.catalogue.check')}
          </button>
        )}
        {installed && (
          <button className="btn btn-danger" disabled={busy} onClick={() => confirm(t('settingsPanels.catalogue.confirmRemove', { title })) && void removeCatalogue(installed.gameId)}>
            {t('settingsPanels.catalogue.remove')}
          </button>
        )}
      </div>
      {update && <p className="text-sm text-muted" role="status">{update}</p>}
    </section>
  )
}
