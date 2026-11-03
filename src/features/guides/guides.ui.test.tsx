// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
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

it('shows "Before you start" with painting order, techniques and a printable sheet', async () => {
  const user = userEvent.setup()
  const written: string[] = []
  const fake = { document: { write: (h: string) => written.push(h), close: () => {} }, focus: () => {}, print: vi.fn() }
  vi.spyOn(window, 'open').mockReturnValue(fake as unknown as Window)
  render(<App />)
  await waitFor(() => expect(useStore.getState().ready).toBe(true))
  await user.click(screen.getByRole('button', { name: 'Schemes' }))
  await user.click(await screen.findByText('Black Templars'))
  const box = within(await screen.findByRole('region', { name: 'Library scheme' })).getByRole('group', { name: 'Before you start' })
  expect(within(box).getByText(/Difficulty:/)).toBeTruthy()
  const order = within(within(box).getByRole('list', { name: 'Painting order' })).getAllByRole('listitem').map((li) => li.textContent)
  expect(order.length).toBeGreaterThan(1)
  await user.click(within(box).getByRole('button', { name: '📖 Basecoat' }))
  expect(screen.getByRole('dialog', { name: 'Technique Basecoat' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Close technique' }))
  await user.click(within(box).getByRole('button', { name: '🖨 Print / PDF' }))
  expect(fake.print).toHaveBeenCalled()
  expect(written[0]).toContain('Recipe, in painting order')
  expect(written[0]).toContain('Black Templars')
})

it('shows "Before you start" in the editor for your own schemes, updating as you edit', async () => {
  const user = userEvent.setup()
  render(<App />)
  await waitFor(() => expect(useStore.getState().ready).toBe(true))
  await user.click(screen.getByRole('button', { name: 'Schemes' }))
  await user.click(screen.getByRole('button', { name: '+ New scheme' }))
  const editor = await screen.findByRole('region', { name: 'Scheme editor' })
  expect(within(editor).queryByRole('group', { name: 'Before you start' })).toBeNull()
  await user.click(within(editor).getByRole('button', { name: /\+ Area/ }))
  const box = within(editor).getByRole('group', { name: 'Before you start' })
  expect(within(box).getByRole('list', { name: 'Painting order' })).toBeTruthy()
})
