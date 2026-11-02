// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../app/App'
import { appDb, useStore } from '../../app/store'
import { parseBsData } from '../../data/catalogue/bsdata'
import { createUnit } from '../../domain/collection/ownedUnit'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'

const raw = import.meta.glob('../../data/catalogue/fixtures/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const catalogue = parseBsData(Object.entries(raw).map(([p, text]) => ({ name: p.split('/').pop()!, text })), { repo: 'BSData/wh40k-11e', commit: 'c', fetchedAt: '2026-11-01T00:00:00.000Z' })

async function start(cat: object = catalogue) {
  await appDb.delete()
  await appDb.open()
  await appDb.catalogues.put(cat as never)
  let n = 0
  await appDb.units.put(createUnit({ customName: 'My walker', datasheetId: 'u-walker', groups: [{ count: 1, status: 'built' }] }, { now: 't', newId: () => `u${++n}` }))
  useStore.setState({ ready: false, units: [], lists: [], catalogue: null, pipeline: DEFAULT_PIPELINE })
  const user = userEvent.setup()
  render(<App />)
  await screen.findByText('My walker')
  await user.click(screen.getByRole('button', { name: 'Armies' }))
  return user
}

beforeEach(() => localStorage.clear())

describe('Armies', () => {
  it('creates a list, adds owned units, flags rules and ownership, and shows it in the overview', async () => {
    const user = await start()
    expect(screen.getByText(/No army lists yet/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '+ New list' }))
    const form = screen.getByRole('form', { name: 'New list' })
    expect(within(form).getByLabelText('Battle size')).toHaveDisplayValue('Strike Force (2000 pts)')
    await user.type(within(form).getByLabelText('Name'), 'Walkers')
    await user.click(within(form).getByRole('button', { name: 'Create' }))

    // Add panel: only owned units until "Not owned" is ticked.
    const add = await screen.findByRole('region', { name: 'Add units' })
    expect(within(add).getByRole('button', { name: 'Add Big Walker' })).toBeInTheDocument()
    expect(within(add).queryByRole('button', { name: 'Add Line Troopers' })).toBeNull()
    await user.click(within(add).getByLabelText('Not owned'))
    expect(within(add).getByRole('button', { name: 'Add Line Troopers' })).toBeInTheDocument()

    // The first unit sets the faction; a unit in two factions asks which one.
    await user.click(within(add).getByRole('button', { name: 'Add Big Walker' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Choose faction' })).getByRole('button', { name: 'Testers' }))
    expect(screen.getByLabelText('Faction')).toHaveDisplayValue('Testers')
    expect(screen.getByLabelText('Faction')).toBeDisabled()

    const issues = screen.getByRole('region', { name: 'Issues' })
    expect(within(issues).getByText('⚠ Needs at least 1 Character')).toBeInTheDocument()
    expect(within(issues).getByText('⚠ Choose a Warlord')).toBeInTheDocument()

    for (let i = 0; i < 3; i++) await user.click(within(add).getByRole('button', { name: 'Add Big Walker' }))
    expect(within(issues).getByText('⚠ Big Walker: 4, max 3')).toBeInTheDocument()
    const entries = screen.getAllByTestId('entry')
    expect(entries).toHaveLength(4)
    expect(entries[0]).toHaveTextContent('✅')
    expect(entries[1]).toHaveTextContent('✖ 0/1')

    // Incursion lowers the limit to 2 and the points limit to 1000.
    await user.selectOptions(screen.getByLabelText('Battle size'), 'Incursion')
    expect(within(issues).getByText('⚠ Big Walker: 4, max 2')).toBeInTheDocument()
    expect(screen.getByLabelText('Points limit')).toHaveValue(1000)

    await user.click(screen.getAllByRole('button', { name: 'Warlord: Big Walker' })[0])
    expect(within(issues).getByText(/is not a Character/)).toBeInTheDocument()

    const buy = screen.getByRole('region', { name: 'Buy list' })
    expect(buy).toHaveTextContent('3 models to buy')
    expect(within(buy).getByRole('row', { name: /Big Walker×3 3 450/ })).toBeInTheDocument()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await user.click(within(buy).getByRole('button', { name: '📋 Copy as text' }))
    expect(writeText).toHaveBeenCalledWith('Buy list – Walkers\n- Big Walker: 3 models (3 units)\nTotal: 3 models')
    expect(await within(buy).findByText('Copied')).toBeInTheDocument()
    const print = vi.fn()
    window.print = print
    await user.click(within(buy).getByRole('button', { name: '📄 PDF' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Make PDF' })).getByRole('button', { name: '📄 Make PDF' }))
    const sheet = screen.getByLabelText('Buy list sheet')
    expect(sheet).toHaveTextContent('Buy list – Walkers')
    expect(sheet).toHaveTextContent('Testers · 11th edition · Incursion')
    expect(sheet).toHaveTextContent('☐Big Walker (3 units)3450')
    await vi.waitFor(() => expect(print).toHaveBeenCalled())
    window.dispatchEvent(new Event('afterprint'))
    await vi.waitFor(() => expect(screen.queryByLabelText('Buy list sheet')).toBeNull())

    await user.click(screen.getAllByRole('button', { name: 'Remove Big Walker' })[3])
    expect(screen.getAllByTestId('entry')).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: '← Armies' }))
    const row = within(screen.getByRole('list', { name: 'Army lists' })).getByRole('button', { name: /Walkers/ })
    expect(row).toHaveTextContent('450 / 1000 pts')
    expect(row).toHaveTextContent('Testers · 11th edition · Incursion')
    expect(row).toHaveTextContent('🟡 Missing 2 models')
    expect(row).toHaveTextContent('⚠ 4 rule issues')
    await user.click(screen.getByRole('button', { name: 'Complete' }))
    expect(screen.getByText('No lists match this filter.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Rule issues' }))
    expect(screen.getByRole('button', { name: /Walkers/ })).toBeInTheDocument()

    // Saved: still there after a reload.
    expect((await appDb.lists.toArray())[0]).toMatchObject({ name: 'Walkers', factionId: 'cat-testers', pointsLimit: 1000 })
  })

  it('chooses detachments within the detachment points and gives enhancements to Characters', async () => {
    const user = await start()
    await user.click(screen.getByRole('button', { name: '+ New list' }))
    await user.type(screen.getByLabelText('Name'), 'Heroes')
    await user.selectOptions(screen.getByLabelText('Faction'), 'Sub Testers')
    await user.click(screen.getByRole('button', { name: 'Create' }))
    const bar = await screen.findByRole('region', { name: 'Detachments' })

    await user.selectOptions(within(bar).getByLabelText('Add detachment'), 'Line Doctrine (1 DP)')
    expect(within(bar).getByText('1 / 3 detachment points')).toBeInTheDocument()

    const add = screen.getByRole('region', { name: 'Add units' })
    await user.click(within(add).getByLabelText('Not owned'))
    await user.click(within(add).getByLabelText('Legends'))
    await user.click(within(add).getByRole('button', { name: 'Add Old Hero' }))
    await user.selectOptions(screen.getByLabelText('Old Hero enhancement'), 'Lucky Charm (+15)')
    expect(screen.getByTestId('entry')).toHaveTextContent('110')

    await user.selectOptions(within(bar).getByLabelText('Add detachment'), 'Heavy Doctrine (3 DP)')
    expect(within(bar).getByText('4 / 3 detachment points')).toBeInTheDocument()
    const issues = screen.getByRole('region', { name: 'Issues' })
    expect(within(issues).getByText('⚠ Detachments cost 4 detachment points, max 3')).toBeInTheDocument()

    await user.click(within(bar).getByRole('button', { name: 'Remove Line Doctrine' }))
    expect(within(issues).getByText('⚠ Lucky Charm needs its detachment (Line Doctrine)')).toBeInTheDocument()
    expect(screen.getByLabelText('Old Hero enhancement')).toHaveDisplayValue('Lucky Charm (detachment not chosen)')
    expect((await appDb.lists.toArray())[0]).toMatchObject({ detachmentIds: ['det-heavy'], entries: [{ enhancementId: 'enh-charm' }] })
  })

  it('adds units by double-click and by dragging them onto the list', async () => {
    const user = await start()
    await user.click(screen.getByRole('button', { name: '+ New list' }))
    await user.type(screen.getByLabelText('Name'), 'Quick')
    await user.selectOptions(screen.getByLabelText('Faction'), 'Testers')
    await user.click(screen.getByRole('button', { name: 'Create' }))
    const row = (await screen.findAllByTestId('unit-option')).find((r) => r.textContent?.includes('Big Walker'))!
    await user.dblClick(row)
    expect(screen.getAllByTestId('entry')).toHaveLength(1)

    const data = new Map<string, string>()
    const dataTransfer = { setData: (t: string, v: string) => data.set(t, v), getData: (t: string) => data.get(t) ?? '', get types() { return [...data.keys()] }, effectAllowed: '' }
    // Drop on the empty space of the right column, below the list.
    const target = screen.getByTestId('drop-zone')
    fireEvent.dragStart(row, { dataTransfer })
    fireEvent.dragOver(target, { dataTransfer })
    expect(screen.getByRole('region', { name: 'List' })).toHaveClass('border-accent')
    fireEvent.drop(target, { dataTransfer })
    expect(screen.getAllByTestId('entry')).toHaveLength(2)
    expect(screen.getByRole('region', { name: 'List' })).not.toHaveClass('border-accent')
    // Dropping something else does nothing.
    fireEvent.drop(target, { dataTransfer: { ...dataTransfer, getData: () => 'nope' } })
    expect(screen.getAllByTestId('entry')).toHaveLength(2)

    // The unit panel can be resized (arrow keys here), within limits, and the width is remembered.
    const handle = screen.getByRole('separator', { name: 'Resize unit panel' })
    expect(handle).toHaveAttribute('aria-valuenow', '352')
    handle.focus()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(handle).toHaveAttribute('aria-valuenow', '384')
    for (let i = 0; i < 20; i++) await user.keyboard('{ArrowLeft}')
    expect(handle).toHaveAttribute('aria-valuenow', '240')
    expect(localStorage.getItem('builderPanelWidth')).toBe('240')
  })

  it('builds from my collection, links units, shows painting and sets next up', async () => {
    const user = await start()
    let n = 100
    const id = () => `x${++n}`
    await appDb.units.put({ ...createUnit({ customName: 'Second walker', datasheetId: 'u-walker', groups: [{ count: 1, status: 'painted' }] }, { now: 't', newId: id }) })
    await useStore.getState().load()
    await user.click(screen.getByRole('button', { name: '+ New list' }))
    await user.type(screen.getByLabelText('Name'), 'Mine')
    const check = screen.getByLabelText('Start with all the units I own')
    expect(check).toBeDisabled()
    await user.selectOptions(screen.getByLabelText('Faction'), 'Testers')
    await user.click(check)
    await user.click(screen.getByRole('button', { name: 'Create' }))

    const entries = await screen.findAllByTestId('entry')
    expect(entries).toHaveLength(2)
    expect(entries[0]).toHaveTextContent('🎨 0/1')
    expect(entries[1]).toHaveTextContent('🎨 1/1')
    // Each unit can be linked once: the other entry's unit is not offered.
    const pick = screen.getAllByLabelText('Big Walker from my collection')[0]
    expect(within(pick).getAllByRole('option').map((o) => o.textContent)).toEqual(['My models: auto', 'My walker (1)'])

    const mine = screen.getByRole('region', { name: 'From my collection' })
    expect(mine).toHaveTextContent('1 model not painted yet')
    await user.click(within(mine).getByRole('button', { name: 'Next up: My walker' }))
    await vi.waitFor(() => expect(within(mine).getByRole('button', { name: 'Next up: My walker' })).toHaveAttribute('aria-pressed', 'true'))
    expect((await appDb.units.toArray()).find((u) => u.customName === 'My walker')!.nextUp).toBe(true)

    // "Add all my units" skips what is already in.
    await user.click(screen.getByRole('button', { name: '⤵ Add all my units' }))
    expect(screen.getAllByTestId('entry')).toHaveLength(2)
  })

  it('imports a .rosz file and pasted text, and exports text and JSON', async () => {
    const user = await start()
    const ros = (import.meta.glob('../../data/lists/fixtures/walkers.ros', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['../../data/lists/fixtures/walkers.ros']
    const { strToU8, zipSync } = await import('fflate')
    await user.click(screen.getByRole('button', { name: '⬆ Import' }))
    await user.upload(screen.getByLabelText('List file'), new File([zipSync({ 'w.ros': strToU8(ros) })], 'walkers.rosz'))
    const result = await screen.findByRole('region', { name: 'Import result' })
    expect(result).toHaveTextContent('Imported “Walker Strike” with 2 units')
    expect(result).toHaveTextContent('Not in the catalogue: Mystery Unit')
    await user.click(within(result).getByRole('button', { name: 'Open list' }))
    expect(await screen.findAllByTestId('entry')).toHaveLength(2)

    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await user.click(screen.getByText('⬇ Export'))
    await user.click(screen.getByRole('button', { name: '📋 Copy list as text' }))
    expect(writeText.mock.calls[0][0]).toContain('Detachment: Line Doctrine')
    const created: Blob[] = []
    URL.createObjectURL = vi.fn((b: Blob) => (created.push(b), 'blob:x'))
    URL.revokeObjectURL = vi.fn()
    await user.click(screen.getByRole('button', { name: '🗂 MiniTracker file (.json)' }))
    expect(JSON.parse(await created[0].text())).toMatchObject({ format: 'minitracker-list', list: { name: 'Walker Strike' } })
    await user.click(screen.getByRole('button', { name: '📄 Text file (.txt)' }))
    expect(await created[1].text()).toContain('Big Walker')

    // Pasted text with nothing to warn about opens the new list directly.
    await user.click(screen.getByRole('button', { name: '← Armies' }))
    await user.click(screen.getByRole('button', { name: '⬆ Import' }))
    await user.type(screen.getByRole('textbox'), 'Pasted (165 points){enter}Testers{enter}Strike Force{enter}Big Walker (150 points){enter}')
    await user.click(screen.getByRole('button', { name: 'Import text' }))
    expect(await screen.findByLabelText('List name')).toHaveValue('Pasted')

    // A bad file shows an error.
    await user.click(screen.getByRole('button', { name: '← Armies' }))
    await user.click(screen.getByRole('button', { name: '⬆ Import' }))
    await user.upload(screen.getByLabelText('List file'), new File(['{}'], 'x.json'))
    expect(await screen.findByRole('alert')).toHaveTextContent('not a MiniTracker list')
  })

  it('puts paints missing for the units\' schemes on the buy list, text and PDF', async () => {
    const user = await start()
    await appDb.schemes.put({ id: 'sc1', name: 'Sept', description: '', origin: 'personal', stage: 'final', tags: [], tips: '', tutorials: [], createdAt: 't', updatedAt: 't', sections: [{ id: 's', area: 'Armour', steps: [{ id: 'p', technique: 'Basecoat', paints: [{ paintId: 'ak_interactive/3b-au-zb-au' }], notes: '' }] }] } as never)
    const [u] = await appDb.units.toArray()
    await appDb.units.put({ ...u, schemeId: 'sc1' })
    await useStore.getState().load()
    await user.click(screen.getByRole('button', { name: '+ New list' }))
    await user.type(screen.getByLabelText('Name'), 'Painted')
    await user.selectOptions(screen.getByLabelText('Faction'), 'Testers')
    await user.click(screen.getByLabelText('Start with all the units I own'))
    await user.click(screen.getByRole('button', { name: 'Create' }))

    const buy = await screen.findByRole('region', { name: 'Buy list' })
    expect(buy).toHaveTextContent('You own every model · 1 paint')
    expect(await within(buy).findByRole('table', { name: 'Paints to buy' })).toHaveTextContent('AK Interactive 3B Au/Zb AuSept')
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await user.click(within(buy).getByRole('button', { name: '📋 Copy as text' }))
    expect(writeText).toHaveBeenCalledWith('Buy list – Painted\n\nPaints (1):\n- AK Interactive 3B Au/Zb Au (Sept)')
    window.print = vi.fn()
    await user.click(within(buy).getByRole('button', { name: '📄 PDF' }))
    const dialog = screen.getByRole('dialog', { name: 'Make PDF' })
    await user.click(within(dialog).getByLabelText('Choose a scheme per unit'))
    expect(within(dialog).getByLabelText('Big Walker scheme')).toHaveDisplayValue('Auto: Sept (from my model)')
    await user.click(within(dialog).getByRole('button', { name: '📄 Make PDF' }))
    const sheet = screen.getByLabelText('Buy list sheet')
    expect(sheet).toHaveTextContent('Scheme: SeptBig Walker (to paint)')
    expect(sheet).toHaveTextContent('☐AK Interactive 3B Au/Zb Aubuy')
    expect(within(screen.getByRole('region', { name: 'From my collection' })).getByText('AK Interactive 3B Au/Zb Au')).toBeInTheDocument()
  })

  it('chooses an army scheme, shows it per unit, and applies it to my models', async () => {
    const user = await start()
    const base = { description: '', stage: 'final', tags: [], tips: '', tutorials: [], createdAt: 't', updatedAt: 't', sections: [] }
    await appDb.schemes.bulkPut([
      { ...base, id: 'army', name: 'Blue Army', origin: 'personal', factionName: 'Testers' },
      { ...base, id: 'walkers', name: 'Walker Red', origin: 'community', factionName: 'Testers', appliesTo: ['Walker'] },
      { ...base, id: 'other', name: 'Other Faction', origin: 'personal', factionName: 'Someone' },
    ] as never)
    await useStore.getState().load()
    await user.click(screen.getByRole('button', { name: '+ New list' }))
    await user.type(screen.getByLabelText('Name'), 'Blue')
    await user.selectOptions(screen.getByLabelText('Faction'), 'Testers')
    await user.click(screen.getByLabelText('Start with all the units I own'))
    await user.click(screen.getByRole('button', { name: 'Create' }))

    const army = await screen.findByLabelText('Army scheme')
    expect(within(army).getAllByRole('option').map((o) => o.textContent)).toEqual(['Army scheme: none', '🎨 Blue Army'])
    await user.selectOptions(army, '🎨 Blue Army')
    await user.click(screen.getByRole('button', { name: 'Details: Big Walker' }))
    const pick = screen.getByLabelText('Big Walker scheme')
    expect(pick).toHaveDisplayValue('Auto: Blue Army (army scheme)')
    expect(within(pick).getAllByRole('option').map((o) => o.textContent)).toEqual(['Auto: Blue Army (army scheme)', 'Walker Red', 'Blue Army'])

    await user.click(screen.getByRole('button', { name: '🎨 Use these schemes on my models (1)' }))
    await vi.waitFor(async () => expect((await appDb.units.toArray())[0].schemeId).toBe('army'))
    expect(await screen.findByLabelText('Big Walker scheme')).toHaveDisplayValue('Auto: Blue Army (from my model)')
    expect((await appDb.lists.toArray())[0].schemeId).toBe('army')
  })

  it('edits a unit loadout in its details: counts, choices, checks and reset', async () => {
    const user = await start()
    await user.click(screen.getByRole('button', { name: '+ New list' }))
    await user.type(screen.getByLabelText('Name'), 'Troops')
    await user.selectOptions(screen.getByLabelText('Faction'), 'Testers')
    await user.click(screen.getByRole('button', { name: 'Create' }))
    const add = await screen.findByRole('region', { name: 'Add units' })
    await user.click(within(add).getByLabelText('Not owned'))
    await user.click(within(add).getByRole('button', { name: 'Add Line Troopers' }))
    await user.click(screen.getByRole('button', { name: 'Details: Line Troopers' }))

    const lo = screen.getByLabelText('Line Troopers loadout')
    expect(lo).toHaveTextContent('Loadout · default')
    expect(within(lo).getAllByTestId('loadout-row').map((r) => (within(r).getAllByRole('spinbutton')[0] as HTMLInputElement).value)).toEqual(['1', '4'])
    await user.selectOptions(within(lo).getByLabelText('Sergeant: Rifle'), 'Rifle')
    expect(screen.getByLabelText('Line Troopers loadout')).toHaveTextContent('Loadout · set in this list')
    const troopers = within(screen.getByLabelText('Line Troopers loadout')).getByLabelText('Trooper count')
    await user.clear(troopers)
    await user.type(troopers, '9')
    expect(screen.getByLabelText('Line Troopers models')).toHaveValue('10')
    let saved = (await appDb.lists.toArray())[0].entries[0]
    expect(saved.loadout).toEqual([{ modelId: 'm-sgt', count: 1, picks: ['el1'] }, { modelId: 'm-trooper', count: 9, picks: [] }])

    const sgt = within(screen.getByLabelText('Line Troopers loadout')).getByLabelText('Sergeant count')
    await user.clear(sgt)
    await user.type(sgt, '2')
    expect(within(screen.getByRole('region', { name: 'Issues' })).getByText('⚠ Line Troopers: 2 × Sergeant, allowed 1')).toBeInTheDocument()

    await user.click(within(screen.getByLabelText('Line Troopers loadout')).getByRole('button', { name: 'Reset' }))
    saved = (await appDb.lists.toArray())[0].entries[0]
    expect(saved.loadout).toBeUndefined()
    expect(screen.getByLabelText('Line Troopers loadout')).toHaveTextContent('Loadout · default')
  })

  it('asks to download again when the catalogue has no rule data', async () => {
    const { muster: _, ...old } = catalogue
    const user = await start({ ...old, formatVersion: 2 })
    await user.click(screen.getByRole('button', { name: '+ New list' }))
    await user.type(screen.getByLabelText('Name'), 'Old')
    await user.click(screen.getByRole('button', { name: 'Create' }))
    expect(await screen.findByRole('region', { name: 'Rule checks unavailable' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Issues' })).toBeNull()
    await user.click(screen.getByRole('button', { name: '← Armies' }))
    expect(screen.getByRole('button', { name: /Old/ })).toHaveTextContent('Rules not checked')
  })

  it('deletes a list', async () => {
    const user = await start()
    await user.click(screen.getByRole('button', { name: '+ New list' }))
    await user.type(screen.getByLabelText('Name'), 'Gone')
    await user.click(screen.getByRole('button', { name: 'Create' }))
    window.confirm = () => true
    await user.click(await screen.findByRole('button', { name: 'Delete list' }))
    expect(screen.getByText(/No army lists yet/)).toBeInTheDocument()
    expect(await appDb.lists.count()).toBe(0)
  })
})
