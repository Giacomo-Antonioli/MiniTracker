import { printPage } from '../../app/platform'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MissingPaint } from '../../domain/paints/missing'

/** One printable row per paint: tick box, swatch, brand, name, and what uses it. Shared with the buy list. */
export function PaintRows({ rows }: { rows: { paintId: string; paint?: { brand: string; name: string; hex: string }; have?: boolean; usedBy?: string }[] }) {
  return (
    <table className="mt-2 w-full border-collapse text-sm">
      <tbody>
        {rows.map((r) => (
          <tr key={r.paintId} className="border-b border-black/30">
            <td className="w-8 py-1">{r.have ? '☑' : '☐'}</td>
            <td className="w-6 py-1">
              <span className="inline-block h-4 w-4 rounded-sm border border-black/40" style={{ background: r.paint?.hex ?? 'transparent', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }} />
            </td>
            <td className="py-1 text-xs">{r.paint?.brand ?? ''}</td>
            <td className="py-1">{r.paint?.name ?? r.paintId}</td>
            {r.usedBy !== undefined && <td className="py-1 text-right text-xs">{r.usedBy}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Printable list of paints to buy for chosen schemes (#86). */
export function MissingPaintsSheet({ rows, schemes, onDone }: { rows: MissingPaint[]; schemes: string[]; onDone: () => void }) {
  const [date] = useState(() => new Date().toLocaleDateString())
  useEffect(() => {
    const done = () => onDone()
    window.addEventListener('afterprint', done)
    const t = setTimeout(() => void printPage(), 50)
    return () => {
      clearTimeout(t)
      window.removeEventListener('afterprint', done)
    }
  }, [onDone])

  return createPortal(
    <div className="print-only" aria-label="Missing paints sheet">
      <h1 className="text-2xl font-bold">Paints to buy ({rows.length})</h1>
      <p className="text-sm">For: {schemes.join(', ')}</p>
      {rows.length ? <PaintRows rows={rows.map((r) => ({ ...r, usedBy: r.schemes.join(', ') }))} /> : <p className="mt-4">You own every paint these schemes use.</p>}
      <p className="mt-6 text-xs">MiniTracker · {date}</p>
    </div>,
    document.body,
  )
}
