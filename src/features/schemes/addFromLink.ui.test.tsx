// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../app/App'
import { appDb, useStore } from '../../app/store'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'
import { DEFAULT_PIPELINES } from '../../domain/pipelines'

beforeEach(async () => {
  await appDb.delete()
  await appDb.open()
  useStore.setState({
    ready: false, units: [], events: {}, photos: {}, pipeline: DEFAULT_PIPELINE, pipelines: DEFAULT_PIPELINES,
    catalogue: null, paints: [], paintStock: new Map(), schemes: [], library: [], schemeDefaults: {}, recipeLinks: [],
  })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  history.replaceState(null, '', '/')
})

async function openDialog() {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByText(/Your backlog is empty/)
  await user.click(screen.getByRole('button', { name: 'Schemes' }))
  await user.click(screen.getByRole('button', { name: /Add from link/ }))
  await waitFor(() => expect(useStore.getState().paints.length).toBeGreaterThan(0))
  return { user, d: screen.getByRole('dialog', { name: 'Add from link' }) }
}

describe('Add from link', () => {
  it('remembers a pasted link even without making a scheme', async () => {
    const { user, d } = await openDialog()
    await user.type(within(d).getByPlaceholderText(/https:\/\//), 'https://www.goonhammer.com/how-to-paint-everything-tau')
    await user.tab()
    await waitFor(() => expect(useStore.getState().recipeLinks.map((l) => l.url)).toEqual(['https://www.goonhammer.com/how-to-paint-everything-tau']))
    expect(await appDb.settings.get('recipeLinks')).toBeDefined()
  })

  it('turns pasted text into a draft and creates a community scheme with the link as source', async () => {
    const { user, d } = await openDialog()
    await user.type(within(d).getByPlaceholderText(/https:\/\//), 'https://example.com/tau-guide')
    await user.type(within(d).getByLabelText('Title'), 'Vior\'la quick')
    await user.type(within(d).getByLabelText('Author'), 'Jane')
    await user.type(within(d).getByLabelText('Faction'), "T'au Empire")
    await user.click(within(d).getByLabelText('Recipe text'))
    await user.paste('Armour\n1. Basecoat with Grey Seer\n2. Wash with Nuln Oil\nIntro text that should vanish.\nRed markings\n- Layer Mephiston Red')
    const preview = within(d).getByRole('region', { name: 'Draft preview' })
    await waitFor(() => expect(preview).toHaveTextContent('3 steps in 2 areas, 3 paints'))
    await user.click(within(d).getByRole('button', { name: 'Create scheme' }))

    await waitFor(() => expect(useStore.getState().schemes).toHaveLength(1))
    const s = useStore.getState().schemes[0]
    expect(s).toMatchObject({ name: "Vior'la quick", origin: 'community', factionName: "T'au Empire", source: { url: 'https://example.com/tau-guide', author: 'Jane' } })
    expect(s.sections.map((x) => [x.area, x.steps.map((st) => st.technique)])).toEqual([['Armour', ['basecoat', 'shade']], ['Red markings', ['layer']]])
    expect(useStore.getState().recipeLinks[0]).toMatchObject({ url: 'https://example.com/tau-guide', schemeId: s.id })
  })

  it('creates an empty scheme from a bare link, and needs a link', async () => {
    const { user, d } = await openDialog()
    await user.click(within(d).getByRole('button', { name: 'Create scheme' }))
    expect(within(d).getByRole('alert')).toHaveTextContent(/link/)
    await user.type(within(d).getByPlaceholderText(/https:\/\//), 'https://www.youtube.com/watch?v=abc')
    await user.click(within(d).getByRole('button', { name: 'Create scheme' }))
    await waitFor(() => expect(useStore.getState().schemes[0]).toMatchObject({ name: 'Recipe from youtube.com', sections: [] }))
  })

  it('opens with a recipe sent by the bookmarklet', async () => {
    const payload = {
      v: 1, url: 'https://www.goonhammer.com/x', title: 'Farsight red', site: 'Goonhammer',
      blocks: [{ type: 'heading', text: 'Armour' }, { type: 'step', text: 'Basecoat Mephiston Red' }, { type: 'step', text: 'Shade with Agrax Earthshade' }],
    }
    history.replaceState(null, '', '/#recipe=' + encodeURIComponent(JSON.stringify(payload)))
    render(<App />)
    const d = await screen.findByRole('dialog', { name: 'Recipe from page' })
    await waitFor(() => expect(within(d).getByRole('region', { name: 'Draft preview' })).toHaveTextContent('2 steps in 1 areas'))
    expect(location.hash).toBe('')
    expect(within(d).getByLabelText('Title')).toHaveValue('Farsight red')
  })
})
