// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../app/App'
import { appDb, useStore } from '../../app/store'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'

// jsdom cannot decode images: replace the compressor with a small fake.
vi.mock('../../data/photos/compress', async (orig) => ({
  ...(await orig<typeof import('../../data/photos/compress')>()),
  makeDisplayCopy: async () => ({ blob: new Blob(['small'], { type: 'image/webp' }), width: 1600, height: 1200 }),
}))

beforeEach(async () => {
  await appDb.delete()
  await appDb.open()
  useStore.setState({ ready: false, units: [], events: {}, photos: {}, pipeline: DEFAULT_PIPELINE, catalogue: null })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  URL.createObjectURL = vi.fn(() => 'blob:fake')
  URL.revokeObjectURL = vi.fn()
})

const jpg = (name: string) => new File(['x'.repeat(5000)], name, { type: 'image/jpeg', lastModified: Date.parse('2026-10-30T10:00:00Z') })

async function unitWithPanel() {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByText(/Your backlog is empty/)
  await user.click(screen.getByRole('button', { name: '+ Add unit' }))
  const d = screen.getByRole('dialog', { name: 'Add unit' })
  await user.type(within(d).getByLabelText('Faction'), 'Ultramarines')
  await user.type(within(d).getByLabelText('Name *'), 'Intercessor Squad')
  await user.clear(within(d).getByLabelText('Models'))
  await user.type(within(d).getByLabelText('Models'), '5')
  await user.click(within(d).getByRole('button', { name: 'Save' }))
  await user.click(await screen.findByRole('cell', { name: /Intercessor Squad/ }))
  return { user, panel: await screen.findByRole('complementary', { name: 'Unit details' }) }
}

describe('Photos', () => {
  it('adds photos to a unit with meaningful names, keeps the original, shows the gallery', async () => {
    const { user, panel } = await unitWithPanel()
    await user.upload(within(panel).getByLabelText('Add photos'), [jpg('IMG_001.JPG'), jpg('IMG_002.jpg')])
    const gallery = within(panel).getByRole('region', { name: 'Photos' })
    await within(gallery).findByText('Photos (2)')

    const unit = useStore.getState().units[0]
    const tag = `mt-${unit.id.replace(/-/g, '').slice(0, 8)}`
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const photos = useStore.getState().photos[unit.id]
    expect(photos.map((p) => p.fileName)).toEqual([
      `ultramarines_intercessor-squad_${tag}_sprue_${day}_01.jpg`,
      `ultramarines_intercessor-squad_${tag}_sprue_${day}_02.jpg`,
    ])
    expect(photos[0]).toMatchObject({ takenAt: '2026-10-30T10:00:00.000Z', originalBytes: 5000, displayBytes: 5, hasOriginal: true })
    // Blob contents are checked in a real browser (e2e/photos.spec.ts); fake IndexedDB doesn't keep them.
    expect(await appDb.photoFiles.get(photos[0].id)).toBeDefined()
  })

  it('opens the viewer: caption, next/previous, delete', async () => {
    const { user, panel } = await unitWithPanel()
    await user.upload(within(panel).getByLabelText('Add photos'), [jpg('a.jpg'), jpg('b.jpg')])
    const gallery = within(panel).getByRole('region', { name: 'Photos' })
    await within(gallery).findByText('Photos (2)')
    await user.click(within(gallery).getAllByRole('button', { name: /Open photo/ })[0])

    const viewer = screen.getByRole('dialog', { name: 'Photo 1 of 2' })
    expect(within(viewer).getByRole('button', { name: /Download original/ })).toBeInTheDocument()
    await user.type(within(viewer).getByLabelText('Caption'), 'Sergeant')
    await user.click(within(viewer).getByRole('button', { name: 'Next photo' }))
    expect(screen.getByRole('dialog', { name: 'Photo 2 of 2' })).toBeInTheDocument()
    const unitId = useStore.getState().units[0].id
    await waitFor(() => expect(useStore.getState().photos[unitId][0].caption).toBe('Sergeant'))

    await user.click(within(screen.getByRole('dialog', { name: 'Photo 2 of 2' })).getByRole('button', { name: 'Delete' }))
    await within(gallery).findByText('Photos (1)')
  })

  it('attaches a photo to a painting step and shows it in the history', async () => {
    const { user, panel } = await unitWithPanel()
    await user.click(within(panel).getByRole('button', { name: 'Move with date, note or photo…' }))
    const d = screen.getByRole('dialog', { name: 'Move models' })
    await user.upload(within(d).getByLabelText('Photo for this step'), jpg('step.jpg'))
    expect(within(d).getByText('step.jpg')).toBeInTheDocument()
    await user.click(within(d).getByRole('button', { name: 'Move' }))

    const unitId = useStore.getState().units[0].id
    await waitFor(() => expect(useStore.getState().photos[unitId]).toHaveLength(1))
    await waitFor(() => expect(useStore.getState().events[unitId]?.length).toBe(1))
    const photo = useStore.getState().photos[unitId][0]
    const event = useStore.getState().events[unitId][0]
    expect(event.photoId).toBe(photo.id)
    expect(photo.owner).toEqual({ kind: 'event', unitId, eventId: event.id })
    expect(photo.fileName).toMatch(/_built_\d{8}_01\.jpg$/)
    expect(within(panel).getAllByRole('button', { name: /Open photo/ }).length).toBe(2) // gallery + history

    // Timeline: photos by date with the stage each shows; the choice is remembered.
    await user.upload(within(panel).getByLabelText('Add photos'), jpg('before.jpg'))
    const gallery = within(panel).getByRole('region', { name: 'Photos' })
    await within(gallery).findByText('Photos (2)')
    await user.click(within(gallery).getByRole('button', { name: 'Timeline' }))
    const items = within(within(gallery).getByRole('list', { name: 'Photo timeline' })).getAllByRole('listitem')
    expect(items.map((li) => li.textContent?.replace(/^[^A-Za-z]*/, '').split(/(?=[A-Z])/).at(-1))).toEqual(['Built', 'Before tracking'])
    expect(localStorage.getItem('photos.view')).toBe('timeline')
    await user.click(within(gallery).getByRole('button', { name: 'Grid' }))
    expect(within(gallery).queryByRole('list', { name: 'Photo timeline' })).toBeNull()
  })

  it('deleting the unit deletes its photos', async () => {
    const { user, panel } = await unitWithPanel()
    await user.upload(within(panel).getByLabelText('Add photos'), jpg('a.jpg'))
    await within(panel).findByText('Photos (1)')
    await user.click(within(panel).getByRole('button', { name: 'Delete' }))
    await screen.findByText(/Your backlog is empty/)
    expect(await appDb.photos.count()).toBe(0)
    expect(await appDb.photoFiles.count()).toBe(0)
  })
})
