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

it('Workshop shows tools and supplies together, with the same options for both', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Workshop' }))
  expect(screen.getByText(/Your workshop is empty/)).toBeInTheDocument()
  const form = screen.getByRole('form', { name: 'New item' })
  await user.type(within(form).getByLabelText('Name'), 'Sprue cutters')
  await user.click(within(form).getByRole('button', { name: '+ Add' }))
  await user.selectOptions(within(form).getByLabelText('Type'), 'supply')
  expect(within(form).getByLabelText('Category')).toHaveValue('Primer')
  await user.type(within(form).getByLabelText('Name'), 'Plastic glue')
  await user.selectOptions(within(form).getByLabelText('Category'), 'Glue')
  await user.clear(within(form).getByLabelText('Alert at'))
  await user.type(within(form).getByLabelText('Alert at'), '1')
  await user.click(within(form).getByRole('button', { name: '+ Add' }))

  // the supply starts low (1 at alert 1): shopping list and nav alert
  const glue = within(await screen.findByRole('listitem', { name: 'Supply Plastic glue' }))
  expect(glue.getByText('⚠ Low · on shopping list')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Workshop ⚠1' })).toBeInTheDocument()

  // supplies get maintenance and condition; tools get stock
  await user.click(glue.getByRole('button', { name: '▸ 🧴 Plastic glue' }))
  await user.click(glue.getByRole('button', { name: '+ Check it has not dried out (90 d)' }))
  await user.selectOptions(glue.getByLabelText('Condition'), 'worn')
  await waitFor(() => expect(useStore.getState().supplies[0]).toMatchObject({ condition: 'worn', tasks: [{ name: 'Check it has not dried out' }] }))
  expect(screen.getByRole('button', { name: 'Workshop ⚠2' })).toBeInTheDocument()

  const cutters = within(screen.getByRole('listitem', { name: 'Tool Sprue cutters' }))
  await user.click(cutters.getByRole('button', { name: 'One more Sprue cutters' }))
  expect(useStore.getState().tools[0].quantity).toBe(2)

  // the sub-pages show one list each
  await user.click(screen.getByRole('button', { name: 'Workshop pages' }))
  await user.click(screen.getByRole('button', { name: 'Tools' }))
  expect(screen.getByRole('heading', { name: 'Tools' })).toBeInTheDocument()
  expect(screen.queryByRole('listitem', { name: 'Supply Plastic glue' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Supplies ⚠2' }))
  expect(screen.queryByRole('listitem', { name: 'Tool Sprue cutters' })).toBeNull()
  expect(screen.getByRole('listitem', { name: 'Supply Plastic glue' })).toBeInTheDocument()
})
