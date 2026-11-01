// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../app/App'
import { appDb, useStore } from '../../app/store'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'
import { DEFAULT_PIPELINES } from '../../domain/pipelines'

vi.mock('../../data/photos/compress', async (orig) => ({
  ...(await orig<typeof import('../../data/photos/compress')>()),
  makeDisplayCopy: async () => ({ blob: new Blob(['s'], { type: 'image/webp' }), width: 800, height: 600 }),
}))

beforeEach(async () => {
  await appDb.delete()
  await appDb.open()
  useStore.setState({
    ready: false, units: [], events: {}, photos: {}, pipeline: DEFAULT_PIPELINE, pipelines: DEFAULT_PIPELINES,
    catalogue: null, paints: [], paintStock: new Map(), schemes: [], library: [], schemeDefaults: {}, recipeLinks: [],
  })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
})

const jpg = (n: string) => new File(['x'.repeat(100)], n, { type: 'image/jpeg' })

async function newScheme() {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByText(/Your backlog is empty/)
  await user.click(screen.getByRole('button', { name: 'Schemes' }))
  await waitFor(() => expect(useStore.getState().paints.length).toBeGreaterThan(0))
  await user.click(screen.getByRole('button', { name: '+ New scheme' }))
  const ed = await screen.findByRole('region', { name: 'Scheme editor' })
  return { user, ed }
}

describe('Scheme photos and recipe cards', () => {
  it('adds photos, the first becomes the cover, names use the scheme tag', async () => {
    const { user, ed } = await newScheme()
    const s = useStore.getState().schemes[0]
    await user.upload(within(ed).getByLabelText('Add scheme photos'), [jpg('a.jpg'), jpg('b.jpg')])
    const gallery = within(ed).getByRole('region', { name: 'Scheme photos' })
    await within(gallery).findByText('Photos (2)')
    const photos = useStore.getState().photos[s.id]
    expect(photos[0].fileName).toMatch(new RegExp(`^scheme_new-scheme_sc-${s.id.replace(/-/g, '').slice(0, 8)}_\\d{8}_01\\.jpg$`))
    expect(await within(gallery).findByRole('button', { name: '★ cover' })).toBeInTheDocument()
    await user.click(within(ed).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(useStore.getState().schemes[0].coverPhotoId).toBe(photos[0].id))
    await user.click(within(gallery).getAllByRole('button', { name: 'set cover' })[0])
    expect(within(ed).getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('attaches a photo to a step', async () => {
    const { user, ed } = await newScheme()
    await user.click(within(ed).getByRole('button', { name: '+ Area' }))
    await user.click(within(ed).getByRole('button', { name: '+ Step' }))
    await user.click(within(ed).getByRole('button', { name: 'Save' }))
    const step = within(ed).getByRole('listitem', { name: 'Step 1' })
    await user.upload(within(step).getByLabelText('Photo for step 1'), jpg('step.jpg'))
    await waitFor(() => expect(within(step).getByRole('button', { name: /Open photo/ })).toBeInTheDocument())
    const photo = Object.values(useStore.getState().photos).flat()[0]
    expect(photo.owner).toMatchObject({ kind: 'scheme', stepId: useStore.getState().schemes[0].sections[0].steps[0].id })
  })

  it('prints a recipe card with paints and steps', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    const { user, ed } = await newScheme()
    await user.click(within(ed).getByRole('button', { name: '+ Area' }))
    await user.click(within(ed).getByRole('button', { name: '+ Step' }))
    const step = within(ed).getByRole('listitem', { name: 'Step 1' })
    await user.type(within(step).getByLabelText('Technique'), 'basecoat')
    await user.type(within(step).getByRole('combobox', { name: 'Paint' }), 'macragge blue')
    await user.click(within(step).getByRole('option', { name: /Macragge Blue/ }))
    await user.click(within(ed).getByRole('button', { name: /Recipe card/ }))
    const card = await screen.findByLabelText('Recipe card')
    expect(card).toHaveTextContent('New scheme')
    expect(card).toHaveTextContent('Macragge Blue (Citadel) ☐')
    expect(card).toHaveTextContent('basecoat: Macragge Blue')
    await waitFor(() => expect(print).toHaveBeenCalled())
    window.dispatchEvent(new Event('afterprint'))
    await waitFor(() => expect(screen.queryByLabelText('Recipe card')).not.toBeInTheDocument())
  })

  it('the library has official T\'au studio schemes with the official link', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText(/Your backlog is empty/)
    await user.click(screen.getByRole('button', { name: 'Schemes' }))
    await waitFor(() => expect(useStore.getState().library.length).toBeGreaterThan(40))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Origin' }), 'official')
    const names = screen.getAllByRole('button', { name: /^Scheme / }).map((b) => b.getAttribute('aria-label'))
    expect(names).toEqual(['Scheme Farsight Enclaves (studio colours)', "Scheme T'au Sept (studio colours)", "Scheme Vior'la (studio colours)"])
    await user.click(screen.getByRole('button', { name: "Scheme Vior'la (studio colours)" }))
    const view = screen.getByRole('region', { name: 'Library scheme' })
    expect(within(view).getByRole('link', { name: /Warhammer Community/ })).toHaveAttribute('href', expect.stringContaining('warhammer-community.com'))
    expect(view).toHaveTextContent('written by MiniTracker')
  })
})
