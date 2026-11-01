import { useStore } from '../../app/store'
import { colourStrip, missingPaints } from '../../domain/schemes/scheme'
import type { PaintScheme } from '../../domain/schemes/types'
import { usePhotoUrl } from '../photos/usePhotoUrl'
import { ColourStrip } from './ColourStrip'
import { ORIGIN_LABEL, ORIGIN_STYLE } from './origin'

/** Compact scheme card shown on a unit; clicking it opens the scheme. */
export function SchemeCardLink({ scheme, onOpen, large }: { scheme: PaintScheme; onOpen?: () => void; large?: boolean }) {
  const { paints, paintStock } = useStore()
  const cover = usePhotoUrl(scheme.coverPhotoId)
  const missing = missingPaints(scheme, paintStock).length
  const body = (
    <>
      {cover && <img src={cover} alt="" className={`${large ? 'h-24 w-24' : 'h-14 w-14'} shrink-0 rounded object-cover`} />}
      <span className="grid min-w-0 flex-1 gap-1">
        <ColourStrip colours={colourStrip(scheme, paints)} />
        <span className="flex flex-wrap items-center gap-2 text-sm">
          🎨 <b className="truncate">{scheme.name}</b>
          <span className={`rounded border px-1.5 text-xs ${ORIGIN_STYLE[scheme.origin]}`}>{ORIGIN_LABEL[scheme.origin]}</span>
        </span>
        <span className="text-xs">
          {missing ? <span className="text-danger">{missing} paint{missing > 1 ? 's' : ''} missing</span> : <span className="text-ok">all paints owned</span>}
          {onOpen && <span className="text-muted"> · open scheme →</span>}
        </span>
      </span>
    </>
  )
  return onOpen ? (
    <button className="panel flex w-full items-center gap-3 p-2 text-left hover:border-accent" onClick={onOpen} aria-label={`Open scheme ${scheme.name}`}>
      {body}
    </button>
  ) : (
    <div className="panel flex items-center gap-3 p-2">{body}</div>
  )
}
