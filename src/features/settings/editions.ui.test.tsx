// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../../app/App'
import { appDb, useStore } from '../../app/store'
import { parseBsData } from '../../data/catalogue/bsdata'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'

const raw = import.meta.glob('../../data/catalogue/fixtures/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const base = parseBsData(Object.entries(raw).map(([p, text]) => ({ name: p.split('/').pop()!, text })), { repo: 'x', commit: 'c', fetchedAt: '2026-11-01T00:00:00.000Z' })
const tenth = { ...base, gameId: 'sys-10', source: { ...base.source, repo: 'BSData/wh40k-10e', commit: 'a'.repeat(40) } }
const eleventh = {
  ...base,
  gameId: 'sys-11',
  gameName: 'Test Game 11',
  source: { ...base.source, repo: 'BSData/wh40k-11e', commit: 'b'.repeat(40) },
  datasheets: base.datasheets.map((d) => (d.name === 'Line Troopers' ? { ...d, points: [{ fromModels: 5, points: 95 }] } : d)),
}

describe('Editions', () => {
  it('both editions can be installed; switching changes the catalogue the app uses', async () => {
    await appDb.delete()
    await appDb.open()
    await appDb.catalogues.bulkPut([tenth, eleventh])
    await appDb.settings.put({ key: 'activeCatalogue', value: 'sys-10' })
    useStore.setState({ ready: false, units: [], catalogue: null, catalogues: [], pipeline: DEFAULT_PIPELINE })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText(/Your backlog is empty/)

    await user.click(screen.getByRole('button', { name: /^Catalogue$/ }))
    expect(screen.getByRole('row', { name: /Line Troopers/ })).toHaveTextContent('80')

    await user.click(screen.getByRole('button', { name: /Settings/ }))
    const card11 = screen.getByRole('region', { name: 'Catalogue 11th edition' })
    expect(within(screen.getByRole('region', { name: 'Catalogue 10th edition' })).getByText('active')).toBeInTheDocument()
    await user.click(within(card11).getByRole('button', { name: 'Use this edition' }))
    expect(within(card11).getByText('active')).toBeInTheDocument()
    expect((await appDb.settings.get('activeCatalogue'))?.value).toBe('sys-11')

    await user.click(screen.getByRole('button', { name: /^Catalogue$/ }))
    expect(screen.getByRole('row', { name: /Line Troopers/ })).toHaveTextContent('95')

    await user.click(screen.getByRole('button', { name: /Settings/ }))
    await user.click(within(screen.getByRole('region', { name: 'Catalogue 11th edition' })).getByRole('button', { name: 'Remove' }))
    expect(useStore.getState().catalogue?.gameId).toBe('sys-10')
    expect(useStore.getState().catalogues).toHaveLength(1)
  })
})
