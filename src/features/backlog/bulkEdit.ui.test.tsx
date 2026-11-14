// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it } from 'vitest'
import App from '../../app/App'
import { appDb, ctx, useStore } from '../../app/store'
import { createUnit } from '../../domain/collection/ownedUnit'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'
import { DEFAULT_LAYOUT } from '../../domain/home/layout'

beforeEach(async () => {
  await appDb.delete()
  await appDb.open()
  useStore.setState({ ready: false, units: [], tools: [], supplies: [], shopItems: [], shopLists: [], homeLayout: DEFAULT_LAYOUT, pipeline: DEFAULT_PIPELINE })
})

it('bulk edit moves ticked units from one stage to another and tags them', async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('button', { name: '+ Add unit' })
  for (const [name, status] of [['Farseer', 'sprue'], ['Kahl', 'sprue'], ['Magus', 'built']] as const) await useStore.getState().saveUnit(createUnit({ customName: name, groups: [{ count: 2, status }] }, ctx()))
  await user.click(await screen.findByRole('button', { name: /Bulk edit/ }))
  const dialog = await screen.findByRole('dialog', { name: 'Bulk edit' })
  await user.click(within(dialog).getByRole('checkbox', { name: /Kahl/ }))
  await user.selectOptions(within(dialog).getByLabelText('To'), 'built')
  await user.click(within(dialog).getByRole('button', { name: 'Move 2 models' }))
  await waitFor(() => expect(within(dialog).getByRole('status')).toHaveTextContent('Moved 2 models in 1 units.'))
  const byName = (n: string) => useStore.getState().units.find((u) => u.customName === n)!
  expect(byName('Farseer').groups.map((g) => [g.status, g.count])).toEqual([['built', 2]])
  expect(byName('Kahl').groups.map((g) => g.status)).toEqual(['sprue'])

  await user.type(within(dialog).getByLabelText('Tag'), 'hachette')
  await user.click(within(dialog).getByRole('button', { name: 'Add tag' }))
  await waitFor(() => expect(within(dialog).getByRole('status')).toHaveTextContent('Tag added to 2 units.'))
  expect(byName('Farseer').tags).toEqual(['hachette'])
  expect(byName('Kahl').tags).toEqual([])
})
