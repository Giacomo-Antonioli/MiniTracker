import { useEffect, useMemo, useRef, useState } from 'react'
import { ctx, useStore } from '../../app/store'
import { blocksFromText, draftFromPage, type SourceBlock } from '../../domain/schemes/extract'
import { createScheme } from '../../domain/schemes/scheme'
import { Dialog } from '../../ui/Dialog'
import { bookmarkletCode, type RecipePayload } from './recipeImport'
import { appUrl } from '../../app/platform'
import { useTx } from '../../i18n'

const APP_URL = appUrl()

/** Paste a link (always remembered) and optionally its text, or receive a page from the bookmarklet. */
export function AddFromLinkDialog({ payload, onClose, onCreated }: { payload?: RecipePayload; onClose: () => void; onCreated: (id: string) => void }) {
  const tx = useTx()
  const { paints, loadPaints, pipelines, saveScheme, saveCustomPaint, recipeLinks, rememberLink, forgetLink } = useStore()
  const [url, setUrl] = useState(payload?.url ?? '')
  const [title, setTitle] = useState(payload?.title ?? '')
  const [author, setAuthor] = useState(payload?.author ?? '')
  const [faction, setFaction] = useState('')
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const linkRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (!paints.length) void loadPaints()
  }, [paints.length, loadPaints])
  useEffect(() => {
    // React refuses javascript: URLs in JSX, so the bookmarklet href is set directly.
    linkRef.current?.setAttribute('href', bookmarkletCode(APP_URL))
  }, [])
  useEffect(() => {
    if (payload) void rememberLink({ url: payload.url, title: payload.title })
  }, [payload, rememberLink])

  const blocks: SourceBlock[] = useMemo(() => (text.trim() ? blocksFromText(text) : (payload?.blocks ?? [])), [text, payload])
  const draft = useMemo(() => (paints.length && blocks.length ? draftFromPage(blocks, paints) : null), [blocks, paints])
  const validUrl = /^https?:\/\/\S+\.\S+/.test(url.trim())

  async function create(close: () => void) {
    try {
      if (!validUrl) throw new Error(tx('Paste the link of the recipe page'))
      let host = ''
      try {
        host = new URL(url).hostname.replace(/^www\./, '')
      } catch {
        /* checked above */
      }
      const c = ctx()
      let s = createScheme(
        {
          name: title.trim() || tx('Recipe from {{host}}', { host }),
          stage: pipelines.scheme.stages[0].id,
          origin: 'community',
          factionName: faction.trim() || undefined,
          source: { url: url.trim(), title: title.trim() || undefined, author: author.trim() || undefined },
          description: tx('Imported from {{site}}. Check the steps against the source.', { site: payload?.site ?? host }),
        },
        c,
      )
      if (draft) {
        for (const p of draft.newPaints) await saveCustomPaint(p)
        let n = 0
        s = { ...s, sections: draft.sections.map((sec) => ({ id: `${s.id}-a${++n}`, area: sec.area, steps: sec.steps.map((st) => ({ ...st, id: `${s.id}-s${++n}` })) })) }
      }
      await saveScheme(s)
      await rememberLink({ url: url.trim(), title: s.name, schemeId: s.id })
      onCreated(s.id)
      close()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Dialog title={payload ? tx('Recipe from page') : tx('Add from link')} onClose={onClose} wide>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          const d = (e.target as HTMLElement).closest('dialog')
          void create(() => d?.close())
        }}
      >
        <label className="grid gap-1">
          <span className="text-sm text-muted">{tx('Link *')}</span>
          <input
            className="input"
            type="url"
            placeholder={tx('https://… (Goonhammer, Paint Pad, a blog, YouTube…)')}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => validUrl && void rememberLink({ url: url.trim(), title: title.trim() || undefined })}
            autoFocus={!payload}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <input className="input flex-1" placeholder={tx('Title')} aria-label={tx('Title')} value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="input w-40" placeholder={tx('Author')} aria-label={tx('Author')} value={author} onChange={(e) => setAuthor(e.target.value)} />
          <input className="input w-44" placeholder={tx('Faction / army')} aria-label={tx('Faction')} value={faction} onChange={(e) => setFaction(e.target.value)} />
        </div>
        {!payload && (
          <label className="grid gap-1">
            <span className="text-sm text-muted">{tx('Recipe text (optional): copy the steps from the page and paste them here')}</span>
            <textarea className="input min-h-28" aria-label={tx('Recipe text')} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
        )}

        <section className="panel p-3 text-sm" aria-label={tx('Draft preview')}>
          {!draft || draft.stats.steps === 0 ? (
            <p className="text-muted">
              {blocks.length ? tx('No paints recognised in this text yet.') : tx('No steps yet: the scheme will be created empty with the link as its source, ready to fill in.')}
            </p>
          ) : (
            <>
              <p>
                {tx('{{steps}} steps in {{areas}} areas, {{paints}} paints', { steps: draft.stats.steps, areas: draft.sections.length, paints: draft.stats.paints })}
                {draft.newPaints.length > 0 && <> ({tx('{{n}} not in the paint list, will be added', { n: draft.newPaints.length })})</>}
              </p>
              <ul className="mt-1 text-muted">
                {draft.sections.slice(0, 8).map((s, i) => (
                  <li key={i}>
                    <b>{s.area}</b>: {s.steps.map((st) => `${st.technique || tx('step')} (${st.paints.map((p) => paints.find((x) => x.id === p.paintId)?.name ?? draft.newPaints.find((x) => x.id === p.paintId)?.name).join(' + ')})`).join(' → ')}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-muted">{tx('You can fix everything in the editor after creating it.')}</p>
            </>
          )}
        </section>

        {error && <p className="text-danger" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={(e) => (e.target as HTMLElement).closest('dialog')?.close()}>{tx('Close')}</button>
          <button type="submit" className="btn btn-primary">{tx('Create scheme')}</button>
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer text-muted">{tx('Send recipes from any site with one click (bookmarklet)')}</summary>
          <div className="mt-2 grid gap-2">
            <p className="text-muted">
              {tx("Drag this button to your browser's bookmarks bar. On a recipe page (Goonhammer, a blog, Paint Pad…), click it: MiniTracker opens with the steps read from the page you are viewing. Nothing goes through a server.")}
            </p>
            <a ref={linkRef} className="btn btn-primary w-fit" onClick={(e) => e.preventDefault()} title={tx('Drag me to your bookmarks bar')}>
              {tx('📜 Send to MiniTracker')}
            </a>
          </div>
        </details>

        {recipeLinks.length > 0 && (
          <details className="text-sm" open={!payload}>
            <summary className="cursor-pointer text-muted">{tx('Saved links ({{n}})', { n: recipeLinks.length })}</summary>
            <ul className="mt-2 grid gap-1" aria-label={tx('Saved links')}>
              {recipeLinks.map((l) => (
                <li key={l.url} className="flex items-center gap-2">
                  <a className="min-w-0 flex-1 truncate text-accent underline" href={l.url} target="_blank" rel="noreferrer">{l.title || l.url}</a>
                  {l.schemeId ? <span className="text-xs text-ok">{tx('scheme made')}</span> : <button type="button" className="text-xs underline" onClick={() => { setUrl(l.url); setTitle(l.title ?? '') }}>{tx('use')}</button>}
                  <button type="button" className="text-muted hover:text-danger" aria-label={tx('Forget {{url}}', { url: l.url })} onClick={() => void forgetLink(l.url)}>×</button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </form>
    </Dialog>
  )
}
