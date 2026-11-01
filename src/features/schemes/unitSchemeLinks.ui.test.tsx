// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../app/App'
import { appDb, ctx, useStore } from '../../app/store'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'
import { DEFAULT_PIPELINES } from '../../domain/pipelines'
import { createScheme } from '../../domain/schemes/scheme'

beforeEach(async () => {
  await appDb.delete()
  await appDb.open()
  await appDb.schemes.put(createScheme({ name: 'Vior\'la white', stage: 'final', factionName: "T'au Empire" }, ctx()))
  useStore.setState({
    ready: false, units: [], events: {}, photos: {}, pipeline: DEFAULT_PIPELINE, pipelines: DEFAULT_PIPELINES,
    catalogue: null, paints: [], paintStock: new Map(), schemes: [], library: [], schemeDefaults: {}, backlogFilter: {},
  })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

async function unitOpen() {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByText(/Your backlog is empty/)
  await user.click(screen.getByRole('button', { name: '+ Add unit' }))
  const d = screen.getByRole('dialog', { name: 'Add unit' })
  await user.type(within(d).getByLabelText('Faction'), "T'au Empire")
  await user.type(within(d).getByLabelText('Name *'), 'Fire Warriors')
  await user.click(within(d).getByRole('button', { name: 'Save' }))
  await user.click(await screen.findByRole('cell', { name: /Fire Warriors/ }))
  return { user, panel: await screen.findByRole('complementary', { name: 'Unit details' }) }
}

describe('Unit ↔ scheme links', () => {
  it('picks a scheme from the unit panel and opens it from the scheme card', async () => {
    const { user, panel } = await unitOpen()
    const section = within(panel).getByRole('region', { name: 'Scheme' })
    expect(section).toHaveTextContent('No scheme yet')
    await user.selectOptions(within(section).getByLabelText('Choose scheme'), within(section).getByRole('option', { name: /Vior'la white/ }))
    await waitFor(() => expect(useStore.getState().units[0].schemeId).toBe(useStore.getState().schemes[0].id))

    await user.click(await within(section).findByRole('button', { name: "Open scheme Vior'la white" }))
    const ed = await screen.findByRole('region', { name: 'Scheme editor' })
    expect(within(ed).getByLabelText('Scheme name')).toHaveValue("Vior'la white")
    // …and back: "used by" links to the unit page
    await user.click(within(ed).getByRole('button', { name: 'Fire Warriors' }))
    expect(screen.getByRole('article', { name: 'Unit page' })).toHaveTextContent("Vior'la white")
  })
})
