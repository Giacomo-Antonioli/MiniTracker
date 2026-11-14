// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it } from 'vitest'
import App from '../../app/App'
import { appDb, ctx, useStore } from '../../app/store'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'
import { DEFAULT_LAYOUT } from '../../domain/home/layout'
import { newItem } from '../../domain/workshop/item'

beforeEach(async () => {
  await appDb.delete()
  await appDb.open()
  useStore.setState({ ready: false, units: [], tools: [], supplies: [], shopItems: [], shopLists: [], homeLayout: DEFAULT_LAYOUT, pipeline: DEFAULT_PIPELINE })
})

it('sets properties of one copy of a supply, picks the copy the card shows, and adds a new category inline', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Workshop' }))
  await useStore.getState().saveSupply(newItem({ name: 'Extra Thin Cement', category: 'Glue', quantity: 2 }, ctx()))

  // a category that is not in the list: add it from the dropdown of the add form
  const form = screen.getByRole('form', { name: 'New item' })
  await user.selectOptions(within(form).getByLabelText('Type'), 'supply')
  await user.selectOptions(within(form).getByLabelText('Category'), '＋ New category…')
  await user.type(within(form).getByLabelText('New category name'), 'Cement{Enter}')
  expect(within(form).getByLabelText('Category')).toHaveValue('Cement')
  expect(useStore.getState().workshopCategories.supplies).toContain('Cement')

  const card = within(await screen.findByRole('listitem', { name: 'Supply Extra Thin Cement' }))
  await user.click(card.getByRole('button', { name: /▸.*Extra Thin Cement/ }))
  await user.selectOptions(card.getByRole('combobox', { name: 'Editing' }), 'Copy 2')
  await user.selectOptions(card.getByLabelText('Level'), 'Half')
  await user.type(card.getByLabelText('Notes'), 'opened')
  await waitFor(() => expect(useStore.getState().supplies[0].copies?.[1]).toMatchObject({ level: 'half', notes: 'opened' }))
  expect(useStore.getState().supplies[0].copies?.[0].level).toBeUndefined()

  await user.selectOptions(card.getByRole('combobox', { name: 'Card shows' }), 'Copy 2')
  await waitFor(() => expect(useStore.getState().supplies[0]).toMatchObject({ rep: 1, level: 'half', notes: 'opened' }))
})

it('adds the AK wet palette set once: the tray as a tool, paper and sponges as supplies', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Workshop' }))
  await user.click(screen.getByRole('button', { name: '＋ AK wet palette set' }))
  await waitFor(() => expect(useStore.getState().supplies).toHaveLength(2))
  expect(useStore.getState().tools.map((t) => t.name)).toEqual(['AK Interactive Wet Palette'])
  expect(useStore.getState().tools[0].category).toBe('Palette')
  expect(useStore.getState().supplies.map((s) => [s.name, s.quantity, s.lowAt])).toEqual([['Wet palette paper sheets', 40, 10], ['Wet palette sponges', 2, 1]])
  expect(useStore.getState().workshopCategories.tools).toContain('Palette')
  await user.click(screen.getByRole('button', { name: '＋ AK wet palette set' }))
  expect(await screen.findByText('The wet palette set is already in your workshop.')).toBeInTheDocument()
  expect(useStore.getState().supplies).toHaveLength(2)
})
