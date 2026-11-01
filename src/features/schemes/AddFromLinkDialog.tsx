import { useEffect, useMemo, useRef, useState } from 'react'
import { ctx, useStore } from '../../app/store'
import { blocksFromText, draftFromPage, type SourceBlock } from '../../domain/schemes/extract'
import { createScheme } from '../../domain/schemes/scheme'
import { Dialog } from '../../ui/Dialog'
import { bookmarkletCode, type RecipePayload } from './recipeImport'

const APP_URL = `${location.origin}${import.meta.env.BASE_URL}`

/** Paste a link (always remembered) and optionally its text, or receive a page from the bookmarklet. */
export function AddFromLinkDialog({ payload, onClose, onCreated }: { payload?: RecipePayload; onClose: () => void; onCreated: (id: string) => void }) {
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
      if (!validUrl) throw new Error('Paste the link of the recipe page')
      let host = ''
      try {
        host = new URL(url).hostname.replace(/^www\./, '')
      } catch {
        /* checked above */
      }
      const c = ctx()
      let s = createScheme(
        {
          name: title.trim() || `Recipe from ${host}`,
          stage: pipelines.scheme.stages[0].id,
          origin: 'community',
          factionName: faction.trim() || undefined,
          source: { url: url.trim(), title: title.trim() || undefined, author: author.trim() || undefined },
          description: `Imported from ${payload?.site ?? host}. Check the steps against the source.`,
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
    <Dialog title={payload ? 'Recipe from page' : 'Add from link'} onClose={onClose} wide>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          const d = (e.target as HTMLElement).closest('dialog')
          void create(() => d?.close())
        }}
      >
        <label className="grid gap-1">
          <span className="text-sm text-muted">Link *</span>
          <input
            className="input"
            type="url"
            placeholder="https://… (Goonhammer, Paint Pad, a blog, YouTube…)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => validUrl && void rememberLink({ url: url.trim(), title: title.trim() || undefined })}
            autoFocus={!payload}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <input className="input flex-1" placeholder="Title" aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="input w-40" placeholder="Author" aria-label="Author" value={author} onChange={(e) => setAuthor(e.target.value)} />
          <input className="input w-44" placeholder="Faction / army" aria-label="Faction" value={faction} onChange={(e) => setFaction(e.target.value)} />
        </div>
        {!payload && (
          <label className="grid gap-1">
            <span className="text-sm text-muted">Recipe text (optional): copy the steps from the page and paste them here</span>
            <textarea className="input min-h-28" aria-label="Recipe text" value={text} onChange={(e) => setText(e.target.value)} />
          </label>
        )}

        <section className="panel p-3 text-sm" aria-label="Draft preview">
          {!draft || draft.stats.steps === 0 ? (
            <p className="text-muted">
              {blocks.length ? 'No paints recognised in this text yet.' : 'No steps yet: the scheme will be created empty with the link as its source, ready to fill in.'}
            </p>
          ) : (
            <>
              <p>
                <b>{draft.stats.steps}</b> steps in <b>{draft.sections.length}</b> areas, <b>{draft.stats.paints}</b> paints
                {draft.newPaints.length > 0 && <> ({draft.newPaints.length} not in the paint list, will be added)</>}
              </p>
              <ul className="mt-1 text-muted">
                {draft.sections.slice(0, 8).map((s, i) => (
                  <li key={i}>
                    <b>{s.area}</b>: {s.steps.map((st) => `${st.technique || 'step'} (${st.paints.map((p) => paints.find((x) => x.id === p.paintId)?.name ?? draft.newPaints.find((x) => x.id === p.paintId)?.name).join(' + ')})`).join(' → ')}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-muted">You can fix everything in the editor after creating it.</p>
            </>
          )}
        </section>

        {error && <p className="text-danger" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={(e) => (e.target as HTMLElement).closest('dialog')?.close()}>Close</button>
          <button type="submit" className="btn btn-primary">Create scheme</button>
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer text-muted">Send recipes from any site with one click (bookmarklet)</summary>
          <div className="mt-2 grid gap-2">
            <p className="text-muted">
              Drag this button to your browser's bookmarks bar. On a recipe page (Goonhammer, a blog, Paint Pad…), click it: MiniTracker opens with
              the steps read from the page you are viewing. Nothing goes through a server.
            </p>
            <a ref={linkRef} className="btn btn-primary w-fit" onClick={(e) => e.preventDefault()} title="Drag me to your bookmarks bar">
              📜 Send to MiniTracker
            </a>
          </div>
        </details>

        {recipeLinks.length > 0 && (
          <details className="text-sm" open={!payload}>
            <summary className="cursor-pointer text-muted">Saved links ({recipeLinks.length})</summary>
            <ul className="mt-2 grid gap-1" aria-label="Saved links">
              {recipeLinks.map((l) => (
                <li key={l.url} className="flex items-center gap-2">
                  <a className="min-w-0 flex-1 truncate text-accent underline" href={l.url} target="_blank" rel="noreferrer">{l.title || l.url}</a>
                  {l.schemeId ? <span className="text-xs text-ok">scheme made</span> : <button type="button" className="text-xs underline" onClick={() => { setUrl(l.url); setTitle(l.title ?? '') }}>use</button>}
                  <button type="button" className="text-muted hover:text-danger" aria-label={`Forget ${l.url}`} onClick={() => void forgetLink(l.url)}>×</button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </form>
    </Dialog>
  )
}
