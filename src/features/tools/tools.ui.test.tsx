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
  useStore.setState({ ready: false, units: [], tools: [], shopItems: [], shopLists: [], homeLayout: DEFAULT_LAYOUT, pipeline: DEFAULT_PIPELINE })
})

it('adds tools with maintenance jobs, marks them done, and moves the wishlist to shopping', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Workshop pages' }))
  await user.click(screen.getByRole('button', { name: 'Tools' }))
  expect(screen.getByText(/No tools yet/)).toBeInTheDocument()
  const form = screen.getByRole('form', { name: 'New tool' })
  await user.click(within(form).getByRole('button', { name: '+ Add' }))
  expect(within(form).getByRole('alert')).toHaveTextContent('needs a name')
  await user.type(within(form).getByLabelText('Name'), 'Infinity')
  await user.click(within(form).getByRole('button', { name: '+ Add' }))

  const card = within(await screen.findByRole('listitem', { name: 'Tool Infinity' }))
  await user.click(card.getByRole('button', { name: '▸ Infinity' }))
  await user.click(card.getByRole('button', { name: '+ Deep clean (14 d)' }))
  expect(await screen.findByRole('region', { name: 'Maintenance due' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tools ⚠1' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Workshop ⚠1' })).toBeInTheDocument()
  await user.click(within(screen.getByRole('region', { name: 'Maintenance due' })).getByRole('button', { name: 'Done: Infinity Deep clean' }))
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Maintenance due' })).toBeNull())
  expect(card.getByText('in 14 days')).toBeInTheDocument()

  await user.selectOptions(card.getByLabelText('Condition'), 'broken')
  await user.click(card.getByRole('button', { name: '🛒 Buy a replacement' }))
  expect(await card.findByText('✓ On shopping list')).toBeInTheDocument()

  await user.click(screen.getByRole('tab', { name: /Wishlist/ }))
  await user.type(within(form).getByLabelText('Name'), 'Clippers')
  await user.click(within(form).getByRole('button', { name: '+ Add to wishlist' }))
  const wish = within(await screen.findByRole('listitem', { name: 'Tool Clippers' }))
  await user.click(wish.getByRole('button', { name: '🛒 Add to shopping' }))
  await waitFor(() => expect(useStore.getState().shopItems.map((x) => [x.name, x.sources])).toEqual([['Infinity', ['Tools']], ['Clippers', ['Tools']]]))
  await user.click(wish.getByRole('button', { name: '✓ Got it' }))
  await user.click(screen.getByRole('tab', { name: 'Owned (2)' }))
  await user.click(screen.getByRole('button', { name: 'Delete Clippers' }))
  await waitFor(() => expect(useStore.getState().tools.map((t) => t.name)).toEqual(['Infinity']))
  expect((await appDb.settings.get('tools'))?.value).toHaveLength(1)
})
