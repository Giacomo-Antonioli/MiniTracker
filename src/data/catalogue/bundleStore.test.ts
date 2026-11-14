// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { appDb, useStore } from '../../app/store'
import { parseBsData } from './bsdata'
import { buildBundle } from './bundle'

const raw = import.meta.glob('./fixtures/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const base = parseBsData(Object.entries(raw).map(([p, text]) => ({ name: p.split('/').pop()!, text })), { repo: 'BSData/wh40k-10e', commit: 'a'.repeat(40), fetchedAt: '2026-11-01T00:00:00.000Z' })

it('an exported catalogue file installs on a device that has none', async () => {
  await appDb.delete()
  await appDb.open()
  useStore.setState({ catalogue: null, catalogues: [] })
  const bytes = await buildBundle([base], '2026-11-14T00:00:00.000Z')
  const file = new File([bytes as BlobPart], 'minitracker-catalogues.json.gz')
  await useStore.getState().importCatalogueFiles([file])
  expect(useStore.getState().catalogueJob.error).toBeUndefined()
  expect(useStore.getState().catalogues.map((c) => c.gameId)).toEqual([base.gameId])
  expect((await appDb.catalogues.toArray())[0].datasheets.length).toBe(base.datasheets.length)
  expect(useStore.getState().catalogue?.gameId).toBe(base.gameId)
})
