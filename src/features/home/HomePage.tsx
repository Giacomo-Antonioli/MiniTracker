import { goalProgress, goalTitle } from '../../domain/goals/goals'
import { ScanBoxButton } from '../barcodes/BoxScan'
import { GoalBar } from '../goals/GoalBar'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useShownUnits, useStore } from '../../app/store'
import { isDesktopApp } from '../../app/platform'
import { GAMES } from '../../domain/catalogue/editions'
import { modelsByStatus } from '../../domain/collection/ownedUnit'
import { WISHLISTED } from '../../domain/collection/pipeline'
import { TimerPanel } from '../paintTime/PaintTime'
import { addCard, CARDS, DEFAULT_LAYOUT, hiddenCards, moveCard, optionOf, removeCard, setOption, setSize, type CardLayout, type CardSize } from '../../domain/home/layout'
import { missingForSchemes } from '../../domain/paints/missing'
import { totals } from '../../domain/shopping/shopping'
import { gameStats, result, totals as scoreOf } from '../../domain/games/games'
import { isLow, lowPaints } from '../../domain/supplies/supplies'
import { activityByDay, byRole, paintUsage, pileAge, pointsOverTime, records, spending, stageFlow } from '../../domain/stats/more'
import { byFaction, byMonth, finishMonths, lastMonths, netThisYear, pace, paintedPerMonth, pileLevel, pileNow, recentMoves, recentUnits, streakWeeks } from '../../domain/stats/stats'
import { QuickMove } from '../backlog/QuickMove'
import { StageBar, stageColour } from '../backlog/BacklogTable'
import { ActivityCalendar, HBars, MonthArea, MonthBars } from '../stats/charts'
import { forecast, Tile, useAllEvents, usePointsOf } from '../stats/StatsPage'
import { tr, useT } from '../../i18n'
import { formatMoney, locale } from '../../i18n/format'

type Go = 'backlog' | 'stats' | 'shopping' | 'paints' | 'supplies' | 'games' | 'goals' | 'sync' | 'settings'

/** "today", "yesterday", "3 days ago", "2 months ago". */
export function ago(date: string, now: string): string {
  const AGO = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' })
  const days = Math.round((Date.parse(now.slice(0, 10)) - Date.parse(date.slice(0, 10))) / 86_400_000)
  return days < 45 ? AGO.format(-days, 'day') : AGO.format(-Math.round(days / 30), 'month')
}

const SPAN: Record<CardSize, string> = { S: 'lg:col-span-2', M: 'lg:col-span-3', L: 'lg:col-span-6' }
const age = (months: number) => (months < 1 ? tr('home.thisMonth') : months < 24 ? tr('home.mo', { count: months }) : tr('home.yr', { count: Math.floor(months / 12) }))

const Link = ({ onClick, children }: { onClick?: () => void; children: ReactNode }) =>
  onClick ? <button className="text-sm text-muted hover:text-accent" onClick={onClick}>{children}</button> : null

export function HomePage({ onOpenUnit, onGo, onAddUnit }: { onOpenUnit?: (id: string) => void; onGo?: (p: Go) => void; onAddUnit?: () => void }) {
  const t = useT()
  const currency = useStore((s) => s.currency)
  const euro = (v: number) => formatMoney(v, currency)
  const units = useShownUnits()
  const anyUnits = useStore((s) => s.units.length > 0)
  const game = useStore((s) => s.gameFilter)
  const { pipeline, shopItems, schemes, paints, paintStock, loadPaints, homeLayout, saveHomeLayout, supplies, games, goals, pipelines } = useStore()
  const events = useAllEvents()
  const { pointsOf, roleOf, factionName } = usePointsOf()
  const [editing, setEditing] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  useEffect(() => {
    void loadPaints()
  }, [loadPaints])
  const now = new Date().toISOString()
  const layout = homeLayout
  const save = (l: CardLayout[]) => void saveHomeLayout(l)

  const usedSchemes = useMemo(() => schemes.filter((s) => units.some((u) => u.schemeId === s.id)), [schemes, units])
  const names = new Map(units.map((u) => [u.id, u.customName]))
  const stageName = (id: string) => pipeline.stages.find((s) => s.id === id)?.name ?? id
  const stats = () => onGo && (() => onGo('stats'))

  if (units.length === 0 && anyUnits) {
    return (
      <div className="grid h-full place-items-center">
        <div className="panel grid max-w-md gap-3 p-6 text-center">
          <h1 className="font-display text-2xl text-accent">{game === 'all' ? t('home.noUnits') : t('home.noGameUnits', { game: GAMES[game] })}</h1>
          <p className="text-muted">{t('home.noGameHelp')}</p>
          {onAddUnit && <button className="btn btn-primary justify-self-center" onClick={onAddUnit}>{t('home.addUnit')}</button>}
        </div>
      </div>
    )
  }

  if (units.length === 0) {
    return (
      <div className="grid h-full place-items-center">
        <div className="panel grid max-w-md gap-3 p-6 text-center">
          <h1 className="font-display text-2xl text-accent">{t('home.welcome')}</h1>
          <p className="text-muted">{t('home.welcomeHelp')}</p>
          {onAddUnit && <button className="btn btn-primary justify-self-center" onClick={onAddUnit}>{t('home.addFirst')}</button>}
          {isDesktopApp() && onGo && (
            <div className="grid gap-2 border-t border-line pt-3" aria-label={t('home.bring')}>
              <p className="text-sm text-muted">{t('home.bringHelp')}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <button className="btn" onClick={() => onGo('sync')}>{t('home.syncFrom')}</button>
                <button className="btn" onClick={() => onGo('settings')}>{t('home.restore')}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  /** Each card's body and header link; null when it has nothing to show yet. */
  const body = (card: CardLayout): { content: ReactNode; action?: ReactNode } | null => {
    const opt = (k: string) => optionOf(card, k)
    switch (card.id) {
      case 'tiles': {
        const pile = pileNow(units, pipeline)
        const net = netThisYear(units, events, pipeline, now)
        return {
          content: (
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Tile label={t('home.paintedMonth')} value={paintedPerMonth(events, pipeline, lastMonths(now, 1))[0]} hint={t('home.streak', { weeks: streakWeeks(events, pipeline, now) })} />
              <Tile label={t('home.pile')} value={pile} hint={pileLevel(pile)} />
              <Tile label={t('home.netYear')} value={net > 0 ? `−${net}` : net < 0 ? `+${-net}` : '0'} hint={t('home.netHint')} tone={net > 0 ? 'good' : net < 0 ? 'bad' : undefined} />
              <Tile label={t('home.finish')} value={forecast(finishMonths(pile, pace(events, pipeline, now)))} hint={t('home.finishHint')} />
            </div>
          ),
        }
      }
      case 'activity':
        return events.length ? { content: <ActivityCalendar counts={activityByDay(events)} now={now} />, action: <Link onClick={stats()}>{t('home.stats')}</Link> } : null
      case 'continue': {
        const list = recentUnits(units, events, pipeline, opt('count'))
        if (!list.length) return null
        const at = (id: string) => pipeline.stages.findIndex((s) => s.id === id)
        return {
          action: <Link onClick={onGo && (() => onGo('backlog'))}>{t('home.backlog')}</Link>,
          content: (
            <ul className="grid gap-3">
              {list.map((u) => {
                const by = modelsByStatus(u)
                const stages = pipeline.stages.filter((s) => by[s.id]).map((s) => ({ id: s.id, name: s.name, count: by[s.id] }))
                const group = u.groups.filter((g) => g.status !== WISHLISTED).sort((a, b) => at(a.status) - at(b.status))[0]
                return (
                  <li key={u.id} className="grid gap-1.5 rounded border border-line p-2">
                    <div className="flex items-center justify-between gap-2">
                      <button className="truncate text-left font-semibold hover:text-accent" onClick={() => onOpenUnit?.(u.id)}>{u.customName}</button>
                      <span className="text-xs text-muted">{u.factionName}</span>
                    </div>
                    <StageBar stages={stages} pipeline={pipeline} />
                    {group && <div className="flex flex-wrap items-center gap-2 text-xs text-muted"><span>{group.count} {stageName(group.status)}</span><QuickMove unit={u} group={group} /></div>}
                  </li>
                )
              })}
            </ul>
          ),
        }
      }
      case 'painted': {
        const months = lastMonths(now, opt('months'))
        const values = paintedPerMonth(events, pipeline, months)
        return values.some((v) => v) ? { action: <Link onClick={stats()}>{t('home.stats')}</Link>, content: <MonthBars label={t('home.paintedLast', { months: opt('months') })} months={months} series={[{ name: t('home.paintedSeries'), values, fill: 'fill-accent', swatch: 'bg-accent' }]} /> } : null
      }
      case 'records': {
        const best = records(events, pipeline)
        if (!best.bestMonth) return null
        return {
          content: (
            <div className="grid grid-cols-2 gap-2">
              <Tile label={t('home.bestMonth')} value={best.bestMonth.count} hint={best.bestMonth.key} />
              <Tile label={t('home.bestWeek')} value={best.bestWeek!.count} hint={t('home.weekOf', { date: best.bestWeek!.key })} />
              <Tile label={t('home.bestDay')} value={best.bestDay!.count} hint={best.bestDay!.key} />
              <Tile label={t('home.longest')} value={t('home.weeks', { count: best.longestStreak })} />
            </div>
          ),
        }
      }
      case 'oldest': {
        const oldest = pileAge(units, pipeline, now, opt('count')).oldest
        return oldest.length ? {
          content: (
            <ul className="grid gap-1.5 text-sm">
              {oldest.map((o) => (
                <li key={o.unit.id} className="flex justify-between gap-2">
                  <button className="truncate text-left hover:text-accent" onClick={() => onOpenUnit?.(o.unit.id)}>{o.unit.customName}</button>
                  <span className="shrink-0 text-muted">{t('home.models', { count: o.models })} · {age(o.months)}</span>
                </li>
              ))}
            </ul>
          ),
        } : null
      }
      case 'closest': {
        const rows = byFaction(units, events, pipeline, now, pointsOf, factionName)
          .filter((f) => f.painted < f.models)
          .map((f) => ({ ...f, pct: f.points ? f.pointsPainted / f.points : f.painted / f.models }))
          .sort((a, b) => b.pct - a.pct)
          .slice(0, opt('count'))
        return rows.length ? {
          action: <Link onClick={stats()}>{t('home.stats')}</Link>,
          content: (
            <ul className="grid gap-2.5">
              {rows.map((f) => (
                <li key={f.faction} className="grid gap-1">
                  <div className="flex justify-between text-sm"><span>{f.faction}</span><span className="text-muted">{Math.round(f.pct * 100)}% · {forecast(f.finishMonths)}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-panel-2"><div className="h-full rounded-full bg-accent" style={{ width: `${f.pct * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          ),
        } : null
      }
      case 'recent': {
        const moves = recentMoves(events, opt('count'))
        return moves.length ? {
          content: (
            <ul className="grid gap-1.5 text-sm">
              {moves.map((e) => (
                <li key={e.id} className="flex justify-between gap-2">
                  <button className="truncate text-left hover:text-accent" onClick={() => onOpenUnit?.(e.unitId)}>{e.count} × {names.get(e.unitId) ?? t('home.deleted')} → {stageName(e.to)}</button>
                  <span className="shrink-0 text-muted">{ago(e.date, now)}</span>
                </li>
              ))}
            </ul>
          ),
        } : null
      }
      case 'shopping': {
        const shop = totals(shopItems)
        const missing = paints.length ? missingForSchemes(usedSchemes, paints, paintStock).length : 0
        return shop.toBuy || missing ? {
          action: <Link onClick={onGo && (() => onGo('shopping'))}>{t('home.shoppingLink')}</Link>,
          content: (
            <div className="grid grid-cols-3 gap-2">
              <Tile label={t('home.toBuy')} value={shop.toBuy} />
              <Tile label={t('home.total')} value={formatMoney(shop.price, currency)} hint={shop.unpriced ? t('home.noPrice', { count: shop.unpriced }) : undefined} />
              <Tile label={t('home.missing')} value={missing} hint={t('home.missingHint')} />
            </div>
          ),
        } : null
      }
      case 'timers':
        return { action: <Link onClick={stats()}>{t('home.stats')}</Link>, content: <TimerPanel /> }
      case 'goals': {
        if (!goals.length) return null
        const rows = goals.map((g) => ({ g, p: goalProgress(g, units, events, pipeline, now) }))
        // Unfinished goals first, so the card shows what still needs work.
        rows.sort((a, b) => Number(a.p.done) - Number(b.p.done))
        return {
          action: <Link onClick={onGo && (() => onGo('goals'))}>{t('home.goalsLink')}</Link>,
          content: (
            <ul className="grid gap-3 text-sm" aria-label={t('home.goalProgress')}>
              {rows.slice(0, opt('count')).map(({ g, p }) => (
                <li key={g.id} className="grid gap-1">
                  <span className={p.overdue ? 'text-danger' : undefined}>{p.done ? '✅ ' : ''}{goalTitle(g)}{p.when ? <span className="text-muted"> · {p.when}</span> : null}</span>
                  <GoalBar p={p} />
                </li>
              ))}
            </ul>
          ),
        }
      }
      case 'games': {
        const live = games.find((g) => g.status === 'live')
        const done = games.filter((g) => g.status === 'done').sort((a, b) => b.date.localeCompare(a.date))
        if (!live && !done.length) return null
        const all = gameStats(games, () => undefined).overall
        return {
          action: <Link onClick={onGo && (() => onGo('games'))}>{live ? t('home.continueLink') : t('home.gamesLink')}</Link>,
          content: (
            <div className="grid gap-2 text-sm">
              {live && <p className="font-semibold text-accent">{t('home.live', { name: live.them.name, round: live.round, me: scoreOf(live.me).total, them: scoreOf(live.them).total })}</p>}
              {done.length > 0 && <p className="text-muted">{t('home.record', { played: all.played, wins: all.wins, losses: all.losses, draws: all.draws, pct: Math.round((all.wins / all.played) * 100) })}</p>}
              <ul className="grid gap-1">
                {done.slice(0, 3).map((g) => {
                  const r = result(g)
                  return (
                    <li key={g.id} className="flex justify-between gap-2">
                      <span className="truncate">{t('home.vs', { name: g.them.name })}{g.them.faction ? ` (${g.them.faction})` : ''}</span>
                      <span className="shrink-0 tabular-nums">{scoreOf(g.me).total}–{scoreOf(g.them).total} <b className={r === 'win' ? 'text-ok' : r === 'loss' ? 'text-danger' : 'text-muted'}>{r === 'win' ? t('home.win') : r === 'loss' ? t('home.loss') : t('home.draw')}</b></span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ),
        }
      }
      case 'low': {
        const paintsLow = lowPaints(paintStock, paints)
        const suppliesLow = supplies.filter((s) => isLow(s, pipelines.level))
        if (!paintsLow.length && !suppliesLow.length) return null
        const onList = (ref?: string) => shopItems.some((x) => !x.bought && x.refId === ref)
        return {
          action: <Link onClick={onGo && (() => onGo('supplies'))}>{t('home.suppliesLink')}</Link>,
          content: (
            <ul className="grid gap-1 text-sm">
              {[...paintsLow.map((p) => ({ key: p.refId!, name: p.name, kind: t('home.paint') })), ...suppliesLow.map((s) => ({ key: `supply:${s.id}`, name: t('home.left', { name: s.name, count: s.quantity }), kind: s.category }))].map((x) => (
                <li key={x.key} className="flex justify-between gap-2">
                  <span className="truncate">⚠ {x.name}</span>
                  <span className="shrink-0 text-xs text-muted">{x.kind}{onList(x.key) ? t('home.onList') : ''}</span>
                </li>
              ))}
            </ul>
          ),
        }
      }
      case 'points': {
        const months = lastMonths(now, opt('months'))
        const values = pointsOverTime(units, events, pipeline, months, byMonth, pointsOf)
        return values.some((v) => v) ? { content: <MonthArea label={t('home.pointsOver')} name={t('home.points')} months={months} values={values} /> } : null
      }
      case 'pile-age': {
        const b = pileAge(units, pipeline, now).buckets
        return b.some((x) => x.models) ? { content: <HBars label={t('home.byAge')} rows={b.map((x) => ({ key: x.label, name: x.label, value: x.models }))} /> } : null
      }
      case 'stage-flow': {
        const months = lastMonths(now, opt('months'))
        const flow = stageFlow(events, pipeline, months, byMonth).filter((x) => x.values.some((v) => v))
        return flow.length ? { content: <MonthBars stacked label={t('home.moved')} months={months} series={flow.map((x) => ({ name: x.stage.name, values: x.values, color: stageColour(pipeline, x.stage.id) }))} /> } : null
      }
      case 'spending': {
        const months = lastMonths(now, opt('months'))
        const spent = spending(shopItems, months, byMonth)
        return spent.total ? { action: <span className="text-sm text-muted">{euro(spent.total)}</span>, content: <MonthBars label={t('home.spent')} months={months} format={euro} series={[{ name: t('home.spentSeries'), values: spent.values, fill: 'fill-accent', swatch: 'bg-accent' }]} /> } : null
      }
      case 'paints': {
        const usage = paintUsage(usedSchemes, units, paintStock, 5)
        const byId = new Map(paints.map((x) => [x.id, x]))
        return usage.top.length ? {
          content: (
            <HBars label={t('home.usedBy')} format={(v) => t('home.unitCount', { count: v })} rows={usage.top.map((x) => ({
              key: x.paintId,
              value: x.units,
              name: <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 shrink-0 rounded-full border border-line" style={{ background: byId.get(x.paintId)?.hex }} />{byId.get(x.paintId)?.name ?? x.paintId}</span>,
            }))} />
          ),
        } : null
      }
      case 'roles': {
        const roles = byRole(units, pipeline, roleOf)
        return roles.length ? { content: <HBars label={t('home.byRole')} rows={roles.map((r) => ({ key: r.role, name: r.role, value: r.painted, of: r.models }))} /> } : null
      }
    }
    return null
  }

  const hidden = hiddenCards(layout)

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl text-accent" data-tour="home-title">{t('home.title')}</h1>
        <span className="flex-1" />
        <ScanBoxButton onOpenUnit={onOpenUnit} />
        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            {hidden.length > 0 && (
              <select className="input" aria-label={t('home.addCard')} value="" onChange={(e) => save(addCard(layout, e.target.value))}>
                <option value="">{t('home.addCardOption')}</option>
                {hidden.map((c) => <option key={c.id} value={c.id}>{t(`home.cards.${c.id}`)}</option>)}
              </select>
            )}
            <button className="btn" onClick={() => save(DEFAULT_LAYOUT)}>{t('home.reset')}</button>
            <button className="btn btn-primary" onClick={() => setEditing(false)}>{t('home.done')}</button>
          </div>
        ) : (
          <button className="btn" onClick={() => setEditing(true)}>{t('home.customise')}</button>
        )}
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
        {layout.map((card, i) => {
          const def = CARDS.find((c) => c.id === card.id)!
          const title = t(`home.cards.${card.id}`)
          const b = body(card)
          if (!b && !editing) return null
          const bare = card.id === 'tiles' && !editing
          return (
            <section
              key={card.id}
              aria-label={title}
              className={`${SPAN[card.size]} ${bare ? '' : 'panel p-4'} grid content-start gap-3 ${dragging === card.id ? 'opacity-50' : ''}`}
              draggable={editing}
              onDragStart={(e) => {
                setDragging(card.id)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragEnd={() => setDragging(null)}
              onDragOver={(e) => editing && dragging && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (dragging) save(moveCard(layout, dragging, i))
                setDragging(null)
              }}
            >
              {!bare && (
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 font-display text-lg">
                    {editing && <span className="cursor-grab text-muted" title={t('home.drag')}>⠿</span>}
                    {title}
                  </h2>
                  {editing ? (
                    <div className="flex flex-wrap items-center gap-1 text-sm">
                      {Object.entries(def.options ?? {}).map(([k, o]) => (
                        <select key={k} className="input py-0.5" aria-label={`${title}: ${t(`home.options.${o.label.toLowerCase()}`)}`} value={optionOf(card, k)} onChange={(e) => save(setOption(layout, card.id, k, Number(e.target.value)))}>
                          {o.values.map((v) => <option key={v} value={v}>{v} {t(`home.options.${o.label.toLowerCase()}`).toLowerCase()}</option>)}
                        </select>
                      ))}
                      <div className="flex overflow-hidden rounded border border-line" role="group" aria-label={t('home.size', { title })}>
                        {(['S', 'M', 'L'] as const).map((z) => (
                          <button key={z} aria-pressed={card.size === z} className={`px-2 py-0.5 ${card.size === z ? 'bg-accent text-accent-fg' : 'hover:bg-panel-2'}`} onClick={() => save(setSize(layout, card.id, z))}>{z}</button>
                        ))}
                      </div>
                      <button className="btn px-2 py-0.5" aria-label={t('home.up', { title })} disabled={i === 0} onClick={() => save(moveCard(layout, card.id, i - 1))}>↑</button>
                      <button className="btn px-2 py-0.5" aria-label={t('home.down', { title })} disabled={i === layout.length - 1} onClick={() => save(moveCard(layout, card.id, i + 1))}>↓</button>
                      <button className="btn px-2 py-0.5" aria-label={t('home.remove', { title })} onClick={() => save(removeCard(layout, card.id))}>✕</button>
                    </div>
                  ) : b?.action}
                </header>
              )}
              {b ? b.content : <p className="text-sm text-muted">{t('home.empty')}</p>}
            </section>
          )
        })}
      </div>
    </div>
  )
}
