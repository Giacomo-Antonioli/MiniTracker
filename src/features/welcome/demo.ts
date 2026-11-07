import { ctx, useStore } from '../../app/store'
import { createUnit, type NewUnit } from '../../domain/collection/ownedUnit'
import { newStock } from '../../domain/paints/inventory'
import type { PaintStock } from '../../domain/paints/types'
import { createList } from '../../domain/lists/list'
import { newSupply } from '../../domain/supplies/supplies'
import { newTool } from '../../domain/tools/tools'

/**
 * Demo collection for the guided tour (#168). It replaces what the pages show, in memory only: nothing is written
 * to the database, the tour blocks clicks on the page, and endDemo() puts the user's own data back exactly.
 */
type Saved = Pick<ReturnType<typeof useStore.getState>, 'units' | 'paintStock' | 'tools' | 'supplies' | 'lists' | 'backlogFilter'>
let saved: Saved | null = null

export const demoRunning = () => saved !== null

const DEMO_PAINTS = ['Macragge Blue', 'Abaddon Black', 'Leadbelcher', 'Retributor Armour', 'Nuln Oil', 'Agrax Earthshade', 'Wraithbone', 'Mephiston Red']

export async function startDemo(): Promise<void> {
  if (saved) return
  const s = useStore.getState()
  saved = { units: s.units, paintStock: s.paintStock, tools: s.tools, supplies: s.supplies, lists: s.lists, backlogFilter: s.backlogFilter }
  await s.loadPaints().catch(() => undefined)
  const c = ctx()
  const stages = s.pipeline.stages.map((x) => x.id)
  const at = (i: number) => stages[Math.min(i, stages.length - 1)]
  const unit = (name: string, faction: string, groups: [number, number][]): NewUnit => ({ customName: name, factionName: faction, tags: ['Demo'], groups: groups.map(([count, stage]) => ({ count, status: at(stage) })) })
  const units = [
    unit('Intercessor Squad', 'Space Marines', [[5, 5], [5, 2]]),
    unit('Captain in Terminator Armour', 'Space Marines', [[1, 3]]),
    unit('Redemptor Dreadnought', 'Space Marines', [[1, 1]]),
    unit('Assault Intercessors', 'Space Marines', [[10, 0]]),
    unit('Liberators', 'Stormcast Eternals', [[5, 6]]),
    unit('Kurnoth Hunters', 'Sylvaneth', [[3, 4]]),
  ].map((u) => createUnit(u, c))
  const paintStock = new Map<string, PaintStock>()
  const paints = useStore.getState().paints
  DEMO_PAINTS.forEach((name, i) => {
    const p = paints.find((x) => x.name === name)
    if (p) paintStock.set(p.id, newStock(p.id, i === 4 ? 'low' : 'in-use', c))
  })
  const tools = [
    newTool({ name: 'Sprue clippers', category: 'Cutting' }, c),
    newTool({ name: 'Size 1 detail brush', category: 'Brushes', quantity: 2 }, c),
    newTool({ name: 'Airbrush', category: 'Airbrush', status: 'wishlist' }, c),
  ]
  const supplies = [
    newSupply({ name: 'Plastic glue', category: 'Glue', quantity: 1, lowAt: 1 }, c),
    newSupply({ name: 'Black spray primer', category: 'Primer', quantity: 2, lowAt: 1 }, c),
    newSupply({ name: 'Basing sand', category: 'Basing', quantity: 1, lowAt: 0 }, c),
  ]
  const lists = [createList({ name: 'Demo strike force', edition: '11e', battleSize: 'strike-force', pointsLimit: 2000 }, c)]
  useStore.setState({ units, paintStock, tools, supplies, lists, backlogFilter: {} })
}

export function endDemo(): void {
  if (!saved) return
  useStore.setState(saved)
  saved = null
}
