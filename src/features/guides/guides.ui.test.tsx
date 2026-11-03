// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it } from 'vitest'
import App from '../../app/App'
import { appDb, useStore } from '../../app/store'

beforeEach(async () => {
  await appDb.delete()
  await appDb.open()
  useStore.setState({ ready: false, schemes: [] })
})

it('shows technique guides, search, and getting started', async () => {
  const user = userEvent.setup()
  render(<App />)
  await waitFor(() => expect(useStore.getState().ready).toBe(true))
  await user.click(screen.getByRole('button', { name: 'Guides' }))
  expect(screen.getByRole('article', { name: 'Drybrushing' })).toBeTruthy()
  await user.type(screen.getByLabelText('Search techniques'), 'glaze')
  expect(screen.queryByRole('article', { name: 'Drybrushing' })).toBeNull()
  expect(within(screen.getByRole('article', { name: 'Glazing' })).getByRole('link', { name: /Find videos/ }).getAttribute('href')).toContain('youtube.com')
  await user.click(screen.getByRole('tab', { name: 'Getting started' }))
  expect(screen.getByRole('region', { name: 'The order of work' })).toBeTruthy()
  await user.click(screen.getByRole('tab', { name: 'Bases' }))
  expect(screen.getByText(/coming soon/)).toBeTruthy()
})

it('opens Guides from the Schemes page and a technique from a recipe step', async () => {
  const user = userEvent.setup()
  render(<App />)
  await waitFor(() => expect(useStore.getState().ready).toBe(true))
  await user.click(screen.getByRole('button', { name: 'Schemes' }))
  await user.click(screen.getByRole('tab', { name: '📖 Guides' }))
  expect(await screen.findByRole('article', { name: 'Priming' })).toBeTruthy()
  await user.click(screen.getByRole('tab', { name: 'Schemes' }))
  await user.click(await screen.findByText('Black Templars'))
  const view = await screen.findByRole('region', { name: 'Library scheme' })
  await user.click(within(view).getAllByRole('button', { name: 'basecoat' })[0])
  const panel = screen.getByRole('dialog', { name: 'Technique Basecoat' })
  expect(within(panel).getByText(/main flat colour/)).toBeTruthy()
  await user.click(within(panel).getByRole('button', { name: 'Close technique' }))
  expect(screen.queryByRole('dialog', { name: 'Technique Basecoat' })).toBeNull()
})
