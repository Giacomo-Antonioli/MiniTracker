import { useEffect, useState } from 'react'
import { ctx, useStore } from '../../app/store'
import { parseSchemeFile } from '../../domain/schemes/scheme'
import { decodeShare } from '../../domain/schemes/share'
import { useTx, txr } from '../../i18n'

/** Shown when the app opens with a share link (#scheme=…): preview the scheme and import it as a copy. */
export function SharedSchemeBanner({ token, onDone }: { token: string; onDone: (importedId?: string) => void }) {
  const tx = useTx()
  const importSchemes = useStore((s) => s.importSchemes)
  const [text, setText] = useState<string | null>(null)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    decodeShare(token)
      .then((t) => {
        const s = parseSchemeFile(t, ctx()).schemes
        setPreview(s.map((x) => `${x.name}${x.factionName ? ` (${x.factionName})` : ''}, ${txr('{{n}} steps', { n: x.sections.reduce((n, sec) => n + sec.steps.length, 0) })}`).join('; '))
        setText(t)
      })
      .catch((e: Error) => setError(e.message))
  }, [token])

  return (
    <div className="panel mb-4 flex flex-wrap items-center gap-3 border-accent/60 p-3" role="region" aria-label={tx('Shared scheme')}>
      <span className="flex-1 text-sm">
        {error ? <span className="text-danger">{error}</span> : text ? <>{tx('Someone shared a paint scheme with you:')} <b>{preview}</b></> : tx('Reading shared scheme…')}
      </span>
      {text && (
        <button
          className="btn btn-primary"
          onClick={async () => {
            try {
              const [first] = await importSchemes(text)
              onDone(first?.id)
            } catch (e) {
              setError((e as Error).message)
            }
          }}
        >
          {tx('Import scheme')}
        </button>
      )}
      <button className="btn" onClick={() => onDone()}>{tx('Dismiss')}</button>
    </div>
  )
}
