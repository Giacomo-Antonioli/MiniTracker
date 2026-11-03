import { useState } from 'react'
import { GETTING_STARTED, TECHNIQUES_GUIDE, videoSearch, type Technique } from '../../domain/guides/techniques'

type Tab = 'techniques' | 'bases' | 'start'
const TABS: [Tab, string][] = [['techniques', 'Techniques'], ['bases', 'Bases'], ['start', 'Getting started']]

/** Painting guides: techniques, bases and the basics. Used as its own page and as a tab in Schemes. */
export function Guides({ initialTab = 'techniques' }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [text, setText] = useState('')
  const words = text.toLowerCase().split(/\s+/).filter(Boolean)
  const shown = TECHNIQUES_GUIDE.filter((t) => words.every((w) => `${t.name} ${t.aliases.join(' ')} ${t.what}`.toLowerCase().includes(w)))

  return (
    <div className="grid gap-4">
      <div role="tablist" aria-label="Guides" className="flex flex-wrap gap-2">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`btn ${tab === id ? 'btn-primary' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'techniques' && (
        <>
          <input className="input max-w-sm" aria-label="Search techniques" placeholder="Search techniques…" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((t) => <TechniqueCard key={t.id} technique={t} />)}
          </div>
        </>
      )}
      {tab === 'bases' && <p className="panel p-4 text-sm text-muted">Basing recipes are coming soon.</p>}
      {tab === 'start' && (
        <div className="grid gap-3 md:grid-cols-2">
          {GETTING_STARTED.map((s) => (
            <section key={s.title} className="panel p-4" aria-label={s.title}>
              <h2 className="mb-2 font-semibold">{s.title}</h2>
              <ul className="grid list-disc gap-1 pl-5 text-sm">{s.points.map((p) => <li key={p}>{p}</li>)}</ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

export function TechniqueCard({ technique: t }: { technique: Technique }) {
  return (
    <article className="panel grid gap-2 p-4 text-sm" aria-label={t.name}>
      <h2 className="font-semibold text-accent">{t.name}</h2>
      <p>{t.what}</p>
      <p><b>When:</b> {t.when}</p>
      <p><b>Brush:</b> {t.brush}</p>
      <p><b>Thinning:</b> {t.thinning}</p>
      <div>
        <b>Avoid:</b>
        <ul className="list-disc pl-5">{t.mistakes.map((m) => <li key={m}>{m}</li>)}</ul>
      </div>
      <a className="text-accent hover:underline" href={videoSearch(t)} target="_blank" rel="noreferrer">▶ Find videos</a>
    </article>
  )
}

/** A technique guide in a side panel, opened from a recipe step. */
export function TechniquePanel({ technique, onClose }: { technique: Technique; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-label={`Technique ${technique.name}`} onClick={onClose}>
      <div className="h-full w-[380px] max-w-full overflow-y-auto bg-bg p-3" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex justify-end">
          <button className="btn" aria-label="Close technique" onClick={onClose}>✕</button>
        </div>
        <TechniqueCard technique={technique} />
      </div>
    </div>
  )
}

export function GuidesPage() {
  return (
    <div className="grid gap-4">
      <h1 className="font-display text-2xl text-accent">Guides</h1>
      <Guides />
    </div>
  )
}
