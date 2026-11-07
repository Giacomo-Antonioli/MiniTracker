import { ctx, switchDatabase, useStore } from '../../app/store'
import { MiniTrackerDb } from '../../data/db'
import { createUnit, type NewUnit } from '../../domain/collection/ownedUnit'
import { createList } from '../../domain/lists/list'
import { newStock } from '../../domain/paints/inventory'
import { newSupply } from '../../domain/supplies/supplies'
import { newTool } from '../../domain/tools/tools'

/**
 * Demo collection for the guided tours (#168). While a tour runs the app uses a separate demo database seeded
 * with this collection: every read and write goes there, so the mocks can save units, start games… for real,
 * and the user's own database is never touched (not even if the app closes mid-tour). endDemo() switches back
 * and puts the whole app state back exactly as it was.
 */
type Saved = ReturnType<typeof useStore.getState>
let saved: Saved | null = null
let demoDb: MiniTrackerDb | null = null
const DEMO_DB = 'minitracker-tour-demo'

export const demoRunning = () => saved !== null

const DEMO_PAINTS = ['Macragge Blue', 'Abaddon Black', 'Leadbelcher', 'Retributor Armour', 'Nuln Oil', 'Agrax Earthshade', 'Wraithbone', 'Mephiston Red']

export async function startDemo(): Promise<void> {
  if (saved) return
  const s = useStore.getState()
  saved = { ...s }
  await s.loadPaints().catch(() => undefined)
  const paints = useStore.getState().paints
  const c = ctx()

  // A fresh demo database every time.
  await new MiniTrackerDb(DEMO_DB).delete().catch(() => undefined)
  demoDb = new MiniTrackerDb(DEMO_DB)
  await demoDb.open()

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
  const stock = DEMO_PAINTS.map((name, i) => {
    const p = paints.find((x) => x.name === name)
    return p ? newStock(p.id, i === 4 ? 'low' : 'in-use', c) : null
  }).filter((x) => x !== null)
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
  await demoDb.units.bulkPut(units)
  await demoDb.paintStock.bulkPut(stock)
  await demoDb.lists.bulkPut(lists)
  await demoDb.settings.bulkPut([{ key: 'tools', value: tools }, { key: 'supplies', value: supplies }])

  switchDatabase(demoDb)
  await useStore.getState().load()
  // Keep the installed catalogues and loaded paints (big, and not part of the demo).
  useStore.setState({ catalogues: s.catalogues, catalogue: s.catalogue, paints: useStore.getState().paints.length ? useStore.getState().paints : paints, backlogFilter: {} })
}

export function endDemo(): void {
  if (!saved) return
  switchDatabase(null)
  useStore.setState(saved)
  saved = null
  const old = demoDb
  demoDb = null
  void old?.delete().catch(() => undefined)
}
