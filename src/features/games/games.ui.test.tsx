// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../app/App'
import { appDb, useStore } from '../../app/store'
import { parseBsData } from '../../data/catalogue/bsdata'
import { createUnit } from '../../domain/collection/ownedUnit'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'
import { DEFAULT_LAYOUT } from '../../domain/home/layout'

const raw = import.meta.glob('../../data/catalogue/fixtures/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const catalogue = parseBsData(Object.entries(raw).map(([p, text]) => ({ name: p.split('/').pop()!, text })), { repo: 'BSData/wh40k-11e', commit: 'c', fetchedAt: 'f' })

beforeEach(async () => {
  await appDb.delete()
  await appDb.open()
  useStore.setState({ ready: false, units: [], lists: [], games: [], catalogue: null, homeLayout: DEFAULT_LAYOUT, pipeline: DEFAULT_PIPELINE })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('Games', () => {
  it('plays a game live with both lists, saves it to the history and shows it on Home and on the unit', async () => {
    await appDb.catalogues.put(catalogue as never)
    await appDb.units.put(createUnit({ customName: 'My walker', datasheetId: 'u-walker', factionId: 'cat-testers', groups: [{ count: 1, status: 'painted' }] }, { now: '2026-11-01T00:00:00Z', newId: () => 'u1' }))
    await appDb.lists.put({ id: 'L', name: 'Walkers', edition: '11e', factionId: 'cat-testers', battleSize: 'bs-sf', pointsLimit: 2000, status: 'planned', detachmentIds: [], entries: [{ id: 'e1', datasheetId: 'u-walker', models: 1, wargear: [] }], createdAt: 't', updatedAt: 't' } as never)
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Games' }))
    expect(screen.getByText('No finished games yet.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '▶ New game' }))
    const form = screen.getByRole('form', { name: 'New game' })
    await user.click(within(form).getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: '▶ New game' }))
    const f = screen.getByRole('form', { name: 'New game' })
    expect(within(f).getByLabelText('My army list')).toHaveDisplayValue('Walkers')
    await user.type(within(f).getByLabelText('Opponent'), 'Bob')
    await user.upload(within(f).getByLabelText('Their list file'), new File(['Their walkers\n2x Big Walker (300 points)'], 'theirs.txt'))
    expect(await within(f).findByText('Their walkers: 2 units')).toBeInTheDocument()
    expect(within(f).getByLabelText('Their faction')).toHaveValue('Sub Testers')
    await user.type(within(f).getByLabelText('Mission'), 'Take and Hold')
    await user.click(within(f).getByRole('button', { name: '▶ Start game' }))

    const live = await screen.findByLabelText('Live game')
    expect(screen.getByRole('button', { name: 'Games ●' })).toBeInTheDocument()
    expect(within(live).getByRole('status')).toHaveTextContent('Your turn')
    await user.click(within(live).getByRole('button', { name: 'Me primary +5' }))
    await user.click(within(live).getByRole('button', { name: 'Me secondary +1' }))
    await user.click(within(live).getByRole('button', { name: 'Me secondary +1' }))
    await user.click(within(live).getByRole('button', { name: 'Me secondary −1' }))
    expect(within(live).getByLabelText('Me total')).toHaveTextContent('6')
    await user.click(within(live).getByRole('button', { name: 'Next turn ▶' }))
    expect(within(live).getByRole('status')).toHaveTextContent("Bob's turn")
    expect(within(live).getByLabelText('Bob CP')).toHaveTextContent('1')
    await user.click(within(live).getByRole('button', { name: 'Bob CP −1' }))
    await user.click(within(live).getByRole('button', { name: 'Me CP +1' }))
    await user.click(within(live).getByRole('button', { name: 'Bob primary +1' }))
    const mine = within(within(live).getByRole('region', { name: 'My side' }))
    await user.click(mine.getByLabelText(/Big Walker/))
    const theirs = within(within(live).getByRole('region', { name: 'Their side' }))
    expect(theirs.getByText('Units destroyed: 0 / 2')).toBeInTheDocument()
    await user.click(theirs.getAllByLabelText(/Big Walker/)[0])
    await user.click(within(live).getByRole('button', { name: 'Next turn ▶' }))
    expect(within(live).getByText('Round 2 / 5')).toBeInTheDocument()
    expect(within(screen.getByRole('table', { name: 'Score by round' })).getAllByRole('row')[1]).toHaveTextContent('Me60000')

    await user.click(within(live).getByRole('button', { name: 'End game' }))
    const end = screen.getByRole('dialog', { name: 'End game' })
    expect(end).toHaveTextContent('Final score 6–1: win')
    await user.type(within(end).getByLabelText('Notes'), 'Close one')
    await user.click(within(end).getByRole('button', { name: 'Save game' }))

    const history = await screen.findByRole('region', { name: 'Game history' })
    expect(history).toHaveTextContent('WalkersBob · Sub TestersTake and Hold6–1W')
    await user.click(within(history).getByText('Bob · Sub Testers'))
    expect(history).toHaveTextContent('Lost: Big Walker')
    expect(history).toHaveTextContent('Destroyed: Big Walker')
    expect(history).toHaveTextContent('Close one')
    expect(within(screen.getByRole('table', { name: 'By list' }))).toBeTruthy()
    expect(screen.getByRole('table', { name: 'Overall' })).toHaveTextContent('All games11-0-0100%6–1')
    expect((await appDb.settings.get('games'))!.value).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(await screen.findByRole('region', { name: 'Games' })).toHaveTextContent('1 played · 1-0-0 · 100% wins')
    await user.click(screen.getByRole('button', { name: 'Backlog' }))
    await user.click(await screen.findByRole('cell', { name: /My walker/ }))
    expect(await screen.findByLabelText('Games played')).toHaveTextContent('⚔ Played in 1 game · destroyed in 1')

    await user.click(screen.getByRole('button', { name: 'Games' }))
    await user.click(within(screen.getByRole('region', { name: 'Game history' })).getByText('Bob · Sub Testers'))
    await user.click(screen.getByRole('button', { name: 'Delete game' }))
    await waitFor(() => expect(useStore.getState().games).toEqual([]))
  })

  it('keeps an ad hoc game without lists: counts destroyed units, deletes a live game', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Games' }))
    await user.click(screen.getByRole('button', { name: '▶ New game' }))
    const f = screen.getByRole('form', { name: 'New game' })
    await user.upload(within(f).getByLabelText('Their list file'), new File(['x'], 'theirs.txt'))
    expect(await within(f).findByRole('alert')).toHaveTextContent('Install a catalogue first')
    await user.selectOptions(within(f).getByLabelText('Who goes first'), 'Opponent')
    await user.click(within(f).getByRole('button', { name: '▶ Start game' }))
    const live = await screen.findByLabelText('Live game')
    expect(within(live).getByRole('status')).toHaveTextContent("Opponent's turn")
    await user.click(within(live).getByRole('button', { name: 'Opponent: one more unit destroyed' }))
    await user.click(within(live).getByRole('button', { name: 'Opponent: one more unit destroyed' }))
    await user.click(within(live).getByRole('button', { name: 'Opponent: one less unit destroyed' }))
    expect(within(live).getByText('Units destroyed: 1')).toBeInTheDocument()
    await user.click(within(live).getByRole('button', { name: 'End game' }))
    await user.click(within(screen.getByRole('dialog', { name: 'End game' })).getByRole('button', { name: 'Back' }))
    await user.click(within(live).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(useStore.getState().games).toEqual([]))
  })
})
