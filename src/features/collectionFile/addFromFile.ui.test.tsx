// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it } from 'vitest'
import App from '../../app/App'
import { appDb, useStore } from '../../app/store'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'
import { DEFAULT_LAYOUT } from '../../domain/home/layout'

beforeEach(async () => {
  await appDb.delete()
  await appDb.open()
  useStore.setState({ ready: false, units: [], tools: [], supplies: [], shopItems: [], shopLists: [], homeLayout: DEFAULT_LAYOUT, pipeline: DEFAULT_PIPELINE })
})

const data = {
  format: 'minitracker-collection',
  version: 1,
  units: [{ name: 'Farseer', status: 'On sprue', tags: ['hachette'] }, { name: 'Kahl', status: 'wishlist', tags: ['hachette'] }],
  tools: [{ name: 'Starter Brush', category: 'Brushes' }],
}
const file = () => new File([JSON.stringify(data)], 'h.json', { type: 'application/json' })

it('reviews a file from the empty backlog: untick an entry, add the rest, and a second load flags what is there', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.upload((await screen.findAllByLabelText('Collection file'))[0], file())
  const dialog = await screen.findByRole('dialog', { name: 'Review the file' })
  expect(within(dialog).getAllByRole('checkbox').every((c) => (c as HTMLInputElement).checked)).toBe(true)
  await user.click(within(dialog).getByRole('checkbox', { name: /Kahl/ }))
  await user.click(within(dialog).getByRole('button', { name: 'Add 2 selected' }))
  await waitFor(() => expect(useStore.getState().units.map((u) => u.customName)).toEqual(['Farseer']))
  expect(useStore.getState().tools.map((t) => t.name)).toEqual(['Starter Brush'])
  expect(useStore.getState().units[0].tags).toEqual(['hachette'])

  // loading again: entries already there are flagged (and still ticked)
  await user.upload(screen.getAllByLabelText('Collection file')[0], file())
  const again = await screen.findByRole('dialog', { name: 'Review the file' })
  const boxes = within(again).getAllByRole('checkbox') as HTMLInputElement[]
  expect(boxes.map((b) => b.checked)).toEqual([true, true, true])
  expect(within(again).getAllByText('Already in your tracker')).toHaveLength(2)
})
