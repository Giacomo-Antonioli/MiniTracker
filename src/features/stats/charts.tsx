import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

const MONTH = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' })
const LONG = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
const DAYM = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' })
const isWeek = (k: string) => k.length === 10
/** Axis label of a bucket: 'Mar' for a month, '9 Mar' for a week (its Monday). */
export const monthLabel = (k: string) => (isWeek(k) ? DAYM.format(new Date(`${k}T00:00:00Z`)) : MONTH.format(new Date(`${k}-01T00:00:00Z`)))
const longLabel = (k: string) => (isWeek(k) ? `Week of ${DAYM.format(new Date(`${k}T00:00:00Z`))}` : LONG.format(new Date(`${k}-01T00:00:00Z`)))

const H = 180
const PAD = { top: 16, right: 12, bottom: 24, left: 32 }

/** Width of the chart box, so the SVG is drawn at real size (no stretched text). */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(600)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/** About 4 round tick values from 0 to at least `max`. */
export function ticks(max: number): number[] {
  if (max <= 0) return [0, 1]
  const raw = max / 4
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((k) => k * mag).find((s) => s >= raw)!
  const top = Math.ceil(max / step) * step
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
}

/** Bar with a 4px rounded top, flat on the baseline. */
const barPath = (x: number, y: number, w: number, h: number) => {
  if (h <= 0) return ''
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

function Frame({ label, w, top, children, tip, legend }: { label: string; w: number; top: number; children: ReactNode; tip?: ReactNode; legend?: ReactNode }) {
  const y = (v: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - v / top)
  return (
    <figure className="relative grid gap-2">
      {legend}
      <svg role="img" aria-label={label} width={w} height={H} className="block overflow-visible">
        {ticks(top).map((t) => (
          <g key={t} className="text-muted">
            <line x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} className="stroke-line" strokeDasharray={t === 0 ? undefined : '2 4'} />
            <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-current text-[10px] tabular-nums">{t}</text>
          </g>
        ))}
        {children}
      </svg>
      {tip}
    </figure>
  )
}

function Tip({ x, w, month, rows, format = String }: { x: number; w: number; month: string; rows: { name: string; value: number; swatch?: string; color?: string }[]; format?: (v: number) => string }) {
  const left = Math.min(Math.max(x - 70, 0), w - 140)
  return (
    <div role="tooltip" className="pointer-events-none absolute top-6 z-10 w-36 rounded-md border border-line bg-panel-2 px-2.5 py-1.5 text-xs shadow-lg" style={{ left }}>
      <div className="mb-1 text-muted">{longLabel(month)}</div>
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-1.5">
          <Swatch s={r} />
          <span className="flex-1">{r.name}</span>
          <span className="font-semibold tabular-nums">{format(r.value)}</span>
        </div>
      ))}
    </div>
  )
}

export interface Series {
  name: string
  values: number[]
  /** Tailwind fill class for the bars, and bg class for the swatch; or a CSS colour for both. */
  fill?: string
  swatch?: string
  color?: string
}

const Swatch = ({ s }: { s: Pick<Series, 'swatch' | 'color'> }) => <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-sm ${s.swatch ?? ''}`} style={s.color ? { background: s.color } : undefined} />

/** Monthly bars (grouped, or stacked) with gridlines, a hover tooltip and the highest bar labelled. */
export function MonthBars({ months, series, label, stacked = false, format }: { months: string[]; series: Series[]; label: string; stacked?: boolean; format?: (v: number) => string }) {
  const [ref, w] = useWidth()
  const [hover, setHover] = useState<number | null>(null)
  const sums = months.map((_, i) => series.reduce((t, s) => t + Math.max(0, s.values[i]), 0))
  const top = ticks(Math.max(0, ...(stacked ? sums : series.flatMap((s) => s.values)))).at(-1)!
  const plotW = w - PAD.left - PAD.right
  const slot = plotW / months.length
  const gap = 2
  const cols = stacked ? 1 : series.length
  const bw = Math.min(28, (slot * 0.7 - gap * (cols - 1)) / cols)
  const groupW = bw * cols + gap * (cols - 1)
  const y = (v: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - Math.max(0, v) / top)
  const x0 = (i: number) => PAD.left + i * slot + (slot - groupW) / 2
  const peak = series.length === 1 ? series[0].values.indexOf(Math.max(...series[0].values)) : -1
  const every = Math.ceil(months.length / Math.max(1, Math.floor(plotW / 44)))
  const legend = series.length > 1 && (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {series.map((s) => <span key={s.name} className="flex items-center gap-1.5"><Swatch s={s} />{s.name}</span>)}
    </div>
  )
  return (
    <div ref={ref} onMouseLeave={() => setHover(null)}>
      <Frame label={label} w={w} top={top} legend={legend} tip={hover !== null && <Tip x={x0(hover) + groupW / 2} w={w} month={months[hover]} format={format} rows={series.filter((s) => !stacked || s.values[hover]).map((s) => ({ name: s.name, value: s.values[hover], swatch: s.swatch, color: s.color }))} />}>
        {months.map((m, i) => (
          <g key={m} opacity={hover === null || hover === i ? 1 : 0.45}>
            {stacked
              ? (() => {
                  // Segments stack from the baseline with a 2px gap; only the top one is rounded.
                  let base = 0
                  const shown = series.filter((s) => s.values[i] > 0)
                  return shown.map((s, j) => {
                    const v = s.values[i]
                    const y1 = y(base + v)
                    const h = y(base) - y1
                    base += v
                    const d = j === shown.length - 1 ? barPath(x0(i), y1, bw, h) : `M${x0(i)},${y1}h${bw}v${Math.max(0, h - 2)}h${-bw}Z`
                    return <path key={s.name} data-bar d={d} className={s.fill} style={s.color ? { fill: s.color } : undefined} />
                  })
                })()
              : series.map((s, j) => {
                  const v = Math.max(0, s.values[i])
                  return <path key={s.name} data-bar d={barPath(x0(i) + j * (bw + gap), y(v), bw, y(0) - y(v))} className={s.fill} style={s.color ? { fill: s.color } : undefined} />
                })}
            {i === peak && series[0].values[i] > 0 && (
              <text x={x0(i) + bw / 2} y={y(series[0].values[i]) - 5} textAnchor="middle" className="fill-current text-[10px] font-semibold tabular-nums">{(format ?? String)(series[0].values[i])}</text>
            )}
            {i % every === 0 && <text x={PAD.left + i * slot + slot / 2} y={H - 6} textAnchor="middle" className="fill-current text-[10px] text-muted">{monthLabel(m)}</text>}
            <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={H - PAD.top - PAD.bottom} fill="transparent" onMouseEnter={() => setHover(i)} />
          </g>
        ))}
      </Frame>
    </div>
  )
}

/** One series over months as a line with a soft area, a crosshair tooltip and the last value labelled. */
export function MonthArea({ months, values, name, label }: { months: string[]; values: number[]; name: string; label: string }) {
  const [ref, w] = useWidth()
  const [hover, setHover] = useState<number | null>(null)
  const gid = useId().replace(/:/g, '')
  const top = ticks(Math.max(0, ...values)).at(-1)!
  const plotW = w - PAD.left - PAD.right
  const step = months.length > 1 ? plotW / (months.length - 1) : 0
  const x = (i: number) => PAD.left + i * step
  const y = (v: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - Math.max(0, v) / top)
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('')
  const last = values.length - 1
  const every = Math.ceil(months.length / Math.max(1, Math.floor(plotW / 44)))
  return (
    <div ref={ref} onMouseLeave={() => setHover(null)}>
      <Frame label={label} w={w} top={top} tip={hover !== null && <Tip x={x(hover)} w={w} month={months[hover]} rows={[{ name, value: values[hover], swatch: 'bg-accent' }]} />}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line}L${x(last)},${y(0)}L${x(0)},${y(0)}Z`} fill={`url(#${gid})`} />
        <path d={line} fill="none" strokeWidth={2} strokeLinejoin="round" className="stroke-accent" />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={y(0)} className="stroke-muted" strokeDasharray="2 3" />}
        {[hover ?? last].map((i) => <circle key="dot" cx={x(i)} cy={y(values[i])} r={4} className="fill-accent stroke-panel" strokeWidth={2} />)}
        <text x={x(last)} y={y(values[last]) - 10} textAnchor="end" className="fill-current text-[10px] font-semibold tabular-nums">{values[last]}</text>
        {months.map((m, i) => (
          <g key={m}>
            {i % every === 0 && <text x={x(i)} y={H - 6} textAnchor="middle" className="fill-current text-[10px] text-muted">{monthLabel(m)}</text>}
            <rect x={x(i) - step / 2} y={PAD.top} width={Math.max(step, 1)} height={H - PAD.top - PAD.bottom} fill="transparent" onMouseEnter={() => setHover(i)} />
          </g>
        ))}
      </Frame>
    </div>
  )
}

/** A year of days as a GitHub-style grid: one column per week (Monday on top), shaded by models moved. */
export function ActivityCalendar({ counts, now, weeks = 53 }: { counts: Record<string, number>; now: string; weeks?: number }) {
  const today = new Date(`${now.slice(0, 10)}T00:00:00Z`)
  const monday = today.getTime() - ((today.getUTCDay() + 6) % 7) * 86_400_000
  const start = monday - (weeks - 1) * 7 * 86_400_000
  const max = Math.max(1, ...Object.values(counts))
  const level = (n: number) => (n <= 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)))
  const OPACITY = [0, 0.3, 0.5, 0.75, 1]
  const cell = 11
  const step = cell + 3
  const days = Array.from({ length: weeks * 7 }, (_, i) => new Date(start + i * 86_400_000).toISOString().slice(0, 10)).filter((d) => d <= now.slice(0, 10))
  const total = days.reduce((t, d) => t + (counts[d] ?? 0), 0)
  const active = days.filter((d) => counts[d]).length
  return (
    <figure className="mx-auto grid w-fit max-w-full gap-2">
      <div className="overflow-x-auto">
        <svg role="img" aria-label="Models moved per day over the last year" className="mx-auto block" width={weeks * step + 24} height={7 * step + 16}>
          {['Mon', 'Wed', 'Fri'].map((d, i) => <text key={d} x={0} y={16 + i * 2 * step + cell - 2} className="fill-current text-[9px] text-muted">{d}</text>)}
          {days.map((d, i) => {
            const col = Math.floor(i / 7)
            const n = counts[d] ?? 0
            const first = d.endsWith('-01') || i === 0
            return (
              <g key={d}>
                {first && <text x={24 + col * step} y={9} className="fill-current text-[9px] text-muted">{monthLabel(d.slice(0, 7))}</text>}
                <rect data-day={d} x={24 + col * step} y={14 + (i % 7) * step} width={cell} height={cell} rx={2} className={n ? 'fill-accent' : 'fill-panel-2'} fillOpacity={n ? OPACITY[level(n)] : 1}>
                  <title>{`${d}: ${n} model${n === 1 ? '' : 's'} moved`}</title>
                </rect>
              </g>
            )
          })}
        </svg>
      </div>
      <figcaption className="flex items-center justify-between text-xs text-muted">
        <span>{total} models moved on {active} days</span>
        <span className="flex items-center gap-1">Less{OPACITY.map((o, i) => <span key={i} className={`inline-block h-2.5 w-2.5 rounded-sm ${i ? 'bg-accent' : 'bg-panel-2'}`} style={{ opacity: i ? o : 1 }} />)}More</span>
      </figcaption>
    </figure>
  )
}

/** Labelled horizontal bars, for short ranked lists. */
export function HBars({ rows, format = String, label }: { rows: { name: ReactNode; key: string; value: number; of?: number; hint?: string }[]; format?: (v: number) => string; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.of ?? r.value))
  return (
    <ul className="grid gap-2" aria-label={label}>
      {rows.map((r) => (
        <li key={r.key} className="grid gap-1" title={r.hint}>
          <div className="flex justify-between gap-2 text-sm"><span className="truncate">{r.name}</span><span className="shrink-0 tabular-nums text-muted">{format(r.value)}{r.of !== undefined ? ` / ${format(r.of)}` : ''}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-panel-2">
            <div className="h-full rounded-full bg-accent" style={{ width: `${((r.value) / (r.of ?? max)) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
