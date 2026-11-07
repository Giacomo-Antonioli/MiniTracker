import { printHtml } from '../../app/platform'
import { DIFFICULTY_LABEL, difficulty, paintCount, paintingOrder, techniquesUsed } from '../../domain/guides/prepare'
import type { Technique } from '../../domain/guides/techniques'
import type { PaintScheme } from '../../domain/schemes/types'
import { useTx, txr } from '../../i18n'

/** Summary at the top of a scheme: painting order, techniques, paints and difficulty, with a printable version. */
export function BeforeYouStart({ scheme, paintName, onTechnique }: { scheme: PaintScheme; paintName: (id: string) => string; onTechnique: (t: Technique) => void }) {
  const tx = useTx()
  const order = paintingOrder(scheme.sections)
  const techniques = techniquesUsed(scheme)
  const d = difficulty(scheme)
  if (!scheme.sections.length) return null

  return (
    <details className="rounded border border-line p-3 text-sm" open aria-label={tx('Before you start')}>
      <summary className="cursor-pointer font-semibold">{tx('Before you start')}</summary>
      <div className="mt-2 grid gap-3">
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-muted">
          <span>{tx('Difficulty:')} <b className="text-fg">{DIFFICULTY_LABEL[d]}</b>{scheme.difficulty ? '' : ` ${tx('(estimated)')}`}</span>
          <span><b className="text-fg">{paintCount(scheme)}</b> {tx('paints')}</span>
          <span><b className="text-fg">{order.length}</b> {tx('areas')}</span>
        </p>
        {techniques.length > 0 && (
          <div>
            <h4 className="mb-1 font-semibold">{tx("Techniques you'll use")}</h4>
            <div className="flex flex-wrap gap-1">
              {techniques.map((t) =>
                t.guide ? (
                  <button key={t.name} className="rounded border border-line px-2 py-0.5 hover:border-accent hover:text-accent" onClick={() => onTechnique(t.guide!)}>📖 {t.name}</button>
                ) : (
                  <span key={t.name} className="rounded border border-line px-2 py-0.5 text-muted">{t.name}</span>
                ),
              )}
            </div>
          </div>
        )}
        <div>
          <h4 className="mb-1 font-semibold">{tx('Painting order')}</h4>
          <ol className="grid list-decimal gap-0.5 pl-5" aria-label={tx('Painting order')}>
            {order.map(({ section, stage }) => (
              <li key={section.id}>
                <button className="hover:text-accent hover:underline" onClick={() => document.getElementById(`area-${section.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{section.area}</button>
                {stage && <span className="text-muted"> · {stage}</span>}
              </li>
            ))}
          </ol>
        </div>
        <button className="btn justify-self-start" onClick={() => printScheme(scheme, paintName)}>{tx('🖨 Print / PDF')}</button>
      </div>
    </details>
  )
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** The summary and the full recipe, in painting order, as a plain page to print or save as PDF. */
export function schemeSheet(scheme: PaintScheme, paintName: (id: string) => string): string {
  const order = paintingOrder(scheme.sections)
  const paints = [...new Set(scheme.sections.flatMap((s) => s.steps.flatMap((st) => st.paints.map((p) => p.paintId))))].map(paintName).sort()
  const areas = order
    .map(({ section, stage }) => `<h3>${esc(section.area)} ${stage ? `<small>· ${esc(stage)}</small>` : ''}</h3><ol>${section.steps
      .map((st) => `<li><b>${esc(st.technique || txr('step'))}</b> ${st.paints.map((p) => esc(paintName(p.paintId)) + (p.parts ? ` (${p.parts})` : '')).join(' + ')}${st.note ? ` <i>${esc(st.note)}</i>` : ''}</li>`)
      .join('')}</ol>`)
    .join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(scheme.name)}</title><style>
body{font:13px/1.4 system-ui,sans-serif;margin:24px;color:#111}h1{margin:0 0 4px}h3{margin:14px 0 4px}small{color:#666;font-weight:normal}
.meta{color:#444}ul.paints{columns:3;padding-left:18px}ol{margin:0;padding-left:22px}li{margin:1px 0}i{color:#555}.tips{break-before:page}.tech{break-inside:avoid;margin-bottom:8px}.tech p{margin:2px 0}
</style></head><body><h1>${esc(scheme.name)}</h1><p class="meta">${esc(scheme.factionName ?? '')} · ${DIFFICULTY_LABEL[difficulty(scheme)]} · ${txr('{{n}} paints', { n: paints.length })}${scheme.source?.url ? ` · ${esc(scheme.source.url)}` : ''}</p>
<p><b>${txr('Techniques:')}</b> ${techniquesUsed(scheme).map((t) => esc(t.name)).join(', ')}</p><h2>${txr('Paints')}</h2><ul class="paints">${paints.map((p) => `<li>${esc(p)}</li>`).join('')}</ul><h2>${txr('Recipe, in painting order')}</h2>${areas}${techniqueTips(scheme)}</body></html>`
}

/** Tips for each technique the recipe uses, for the printed sheet. */
function techniqueTips(scheme: PaintScheme): string {
  const guides = techniquesUsed(scheme).flatMap((t) => (t.guide ? [t.guide] : []))
  if (!guides.length) return ''
  return `<h2 class="tips">${txr('How to: techniques used')}</h2>${guides
    .map((g) => `<div class="tech"><h3>${esc(g.name)}</h3><p>${esc(g.what)}</p><p><b>${txr('When:')}</b> ${esc(g.when)}</p><p><b>${txr('Brush:')}</b> ${esc(g.brush)} <b>${txr('Thinning:')}</b> ${esc(g.thinning)}</p>${g.detail ? `<p><b>${txr('How to:')}</b></p><ol>${g.detail.how.map((h) => `<li>${esc(h)}</li>`).join('')}</ol><p><b>${txr('Tips:')}</b> ${g.detail.tips.map(esc).join(' ')}</p>` : ''}<p><b>${txr('Avoid:')}</b> ${g.mistakes.map(esc).join(' ')}</p></div>`)
    .join('')}`
}

function printScheme(scheme: PaintScheme, paintName: (id: string) => string) {
  void printHtml(schemeSheet(scheme, paintName) + '<script>onload=()=>print()</script>')
}
