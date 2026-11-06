// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SHOWCASE_FORMAT } from '../../domain/share/showcase'
import { ShowcaseView } from './ShowcaseView'

// jsdom has no compression streams: the link token is the JSON itself here (e2e/share-collection.spec.ts covers the real one).
vi.mock('../../domain/schemes/share', () => ({
  decodeShare: async (t: string) => {
    if (t.startsWith('{')) return t
    throw new Error('This share link is broken or incomplete')
  },
}))

const snap = { format: SHOWCASE_FORMAT, v: 1, owner: 'Ana', at: '2026-11-06T10:00:00Z', stages: ['On sprue', 'Painted'], painted: 1, units: [['Intercessors', 'Ultramarines', [5, 5]], ['Termagants', 'Tyranids', [10, 0]]] }

describe('ShowcaseView', () => {
  it('shows a shared collection read-only, with progress and search', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ShowcaseView token={JSON.stringify(snap)} onClose={onClose} />)
    expect(await screen.findByRole('heading', { name: "Ana's collection" })).toBeInTheDocument()
    expect(screen.getByLabelText('Progress')).toHaveTextContent('25% painted · 5 of 20 models')
    expect(screen.getByRole('img', { name: 'Ultramarines: 50% painted' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Search units'), 'term')
    expect(screen.queryByText('Intercessors')).toBeNull()
    expect(screen.getByText('Termagants')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open my MiniTracker' }))
    expect(onClose).toHaveBeenCalled()
  })
  it('explains a broken link', async () => {
    render(<ShowcaseView token="!!!" onClose={() => {}} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('broken or incomplete')
  })
})
