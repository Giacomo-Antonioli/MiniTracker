// @vitest-environment jsdom
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react'
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

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('startPage', 'backlog')
})

describe('Armies', () => {
  it('creates a list, adds owned units, flags rules and ownership, and shows it in the overview', async () => {
    // Big Walker made a Character here, so it can be the Warlord.
    const user = await start({ ...catalogue, datasheets: catalogue.datasheets.map((d) => (d.name === 'Big Walker' ? { ...d, keywords: [...d.keywords, 'Character'] } : d)) })
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
    // Characters (possible Warlords) are starred, owned or not.
    expect(within(add).getByRole('button', { name: 'Add Big Walker' }).parentElement!.querySelector('[aria-label="Can be Warlord"]')).not.toBeNull()
    expect(within(add).getByRole('button', { name: 'Add Line Troopers' }).parentElement!.querySelector('[aria-label="Can be Warlord"]')).toBeNull()

    // The first unit sets the faction; a unit in two factions asks which one.
    await user.click(within(add).getByRole('button', { name: 'Add Big Walker' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Choose faction' })).getByRole('button', { name: 'Testers' }))
    expect(screen.getByLabelText('Faction')).toHaveDisplayValue('Testers')
    expect(screen.getByLabelText('Faction')).toBeDisabled()

    const issues = screen.getByRole('region', { name: 'Issues' })
    expect(within(issues).queryByText('⚠ Needs at least 1 Character')).toBeNull()
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

    // Only Characters can be the Warlord; until one is chosen they are highlighted.
    expect(within(issues).getByText('⚠ Choose a Warlord').closest('button')).toHaveAttribute('title', expect.stringContaining('exactly one Warlord'))
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('★ Choose your Warlord: click the star of a highlighted Character.')
    // One Warlord: choosing another unit moves the star; clicking it again clears it.
    const stars = () => screen.getAllByRole('button', { name: 'Warlord: Big Walker' })
    await user.click(stars()[1])
    expect(stars().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false', 'false'])
    await user.click(stars()[1])
    expect(within(issues).getByText('⚠ Choose a Warlord')).toBeInTheDocument()
    await user.click(stars()[0])
    expect(stars()[0]).toHaveAttribute('title', 'Warlord (click to clear)')

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
    const card = within(sheet).getByLabelText('Big Walker card')
    expect(card).toHaveTextContent('Big Walker ×4')
    expect(card).toHaveTextContent('Warlord, 1 model, 150 pts · 3 × 1 model, 150 pts')
    expect(card).toHaveTextContent('MTSvWLDOC8"93+107+3')
    expect(card).toHaveTextContent('Keywords:')
    await vi.waitFor(() => expect(print).toHaveBeenCalled())
    window.dispatchEvent(new Event('afterprint'))
    await vi.waitFor(() => expect(screen.queryByLabelText('Buy list sheet')).toBeNull())

    // The whole army, without owned/painted counts unless asked for.
    await user.click(screen.getByRole('button', { name: '📄 Army PDF' }))
    const ask = screen.getByRole('dialog', { name: 'Print army' })
    expect(within(ask).getByLabelText('Datasheet cards')).toBeChecked()
    expect(within(ask).getByLabelText('Owned and painted models')).not.toBeChecked()
    await user.click(within(ask).getByRole('button', { name: '🖨 Print' }))
    const army = screen.getByLabelText('Army sheet')
    expect(army).toHaveTextContent('Walkers600 / 1000 pts')
    expect(army).toHaveTextContent('Testers · 11th edition · Incursion')
    expect(army).toHaveTextContent('Big Walker1Warlord150')
    expect(army).not.toHaveTextContent('Owned')
    expect(within(army).getByLabelText('Big Walker card')).toBeInTheDocument()
    window.dispatchEvent(new Event('afterprint'))
    await vi.waitFor(() => expect(screen.queryByLabelText('Army sheet')).toBeNull())
    await user.click(screen.getByRole('button', { name: '📄 Army PDF' }))
    const ask2 = screen.getByRole('dialog', { name: 'Print army' })
    await user.click(within(ask2).getByLabelText('Datasheet cards'))
    await user.click(within(ask2).getByLabelText('Owned and painted models'))
    await user.click(within(ask2).getByRole('button', { name: '🖨 Print' }))
    expect(screen.getByLabelText('Army sheet')).toHaveTextContent('Owned')
    expect(screen.getByLabelText('Army sheet')).toHaveTextContent('3 models missing')
    expect(within(screen.getByLabelText('Army sheet')).queryByLabelText('Datasheet cards')).toBeNull()
    window.dispatchEvent(new Event('afterprint'))
    await vi.waitFor(() => expect(screen.queryByLabelText('Army sheet')).toBeNull())
    await user.click(screen.getByRole('button', { name: '📄 Army PDF' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Print army' })).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog', { name: 'Print army' })).toBeNull()

    await user.click(screen.getAllByRole('button', { name: 'Remove Big Walker' })[3])
    expect(screen.getAllByTestId('entry')).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: '← Armies' }))
    const row = within(screen.getByRole('list', { name: 'Army lists' })).getByRole('button', { name: /Walkers/ })
    expect(row).toHaveTextContent('450 / 1000 pts')
    expect(row).toHaveTextContent('Testers · 11th edition · Incursion')
    expect(row).toHaveTextContent('🟡 Missing 2 models')
    expect(row).toHaveTextContent('⚠ 2 rule issues')
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
    const paintTable = await within(buy).findByRole('table', { name: 'Paints to buy' })
    await waitFor(() => expect(paintTable).toHaveTextContent('AK Interactive 3B Au/Zb AuSept'))
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await user.click(within(buy).getByRole('button', { name: '📋 Copy as text' }))
    expect(writeText).toHaveBeenCalledWith('Buy list – Painted\n\nPaints (1):\n- AK Interactive 3B Au/Zb Au (Sept)')
    window.print = vi.fn()
    await user.click(within(buy).getByRole('button', { name: '📄 PDF' }))
    const dialog = screen.getByRole('dialog', { name: 'Make PDF' })
    await user.click(within(dialog).getByLabelText('Include datasheet cards'))
    await user.click(within(dialog).getByLabelText('Choose a scheme per unit'))
    expect(within(dialog).getByLabelText('Big Walker scheme')).toHaveDisplayValue('Auto: Sept (from my model)')
    await user.click(within(dialog).getByRole('button', { name: '📄 Make PDF' }))
    const sheet = screen.getByLabelText('Buy list sheet')
    expect(sheet).toHaveTextContent('Scheme: SeptBig Walker (to paint)')
    expect(within(sheet).queryByLabelText('Datasheet cards')).toBeNull()
    window.dispatchEvent(new Event('afterprint'))
    await vi.waitFor(() => expect(screen.queryByLabelText('Buy list sheet')).toBeNull())
    await user.click(within(buy).getByRole('button', { name: '📄 PDF' }))
    const again = screen.getByRole('dialog', { name: 'Make PDF' })
    expect(within(again).getByLabelText('Include datasheet cards')).not.toBeChecked()
    await user.click(within(again).getByLabelText('Include paints for the schemes'))
    await user.click(within(again).getByLabelText('Include the models to buy'))
    await user.click(within(again).getByRole('button', { name: '📄 Make PDF' }))
    expect(screen.getByLabelText('Buy list sheet')).not.toHaveTextContent('Scheme: Sept')
    expect(screen.getByLabelText('Buy list sheet')).not.toHaveTextContent('Models to buy')
    expect(sheet).toHaveTextContent('☐AK Interactive3B Au/Zb Aubuy')
    expect(within(screen.getByRole('region', { name: 'From my collection' })).getByText('AK Interactive 3B Au/Zb Au')).toBeInTheDocument()
  })

  it('imports Wahapedia stratagems and prints them for the list\'s detachment', async () => {
    const user = await start()
    await user.click(screen.getByRole('button', { name: '⚙ Settings' }))
    const strat = ['faction_id|name|id|type|cp_cost|legend|turn|phase|detachment|detachment_id|description|', '|COMMAND RE-ROLL|1|Core – Battle Tactic Stratagem|1||Either player’s turn|Any phase|||<b>WHEN:</b> Any phase.|', 'T|HOLD FAST|2|Line Doctrine – Battle Tactic Stratagem|2||Your turn|Fight phase|Line Doctrine|d1|Hold!|', 'T|BIG PUSH|3|Heavy Force – Strategic Ploy|1||Your turn|Movement phase|Heavy Force|d2|Push!|'].join('\n')
    const det = ['id|faction_id|name|legend|description|detachment|detachment_id|', 'a|T|Steady Lines|f|Stay in line.|Line Doctrine|d1|'].join('\n')
    const panel = screen.getByRole('region', { name: 'Stratagems' })
    await user.upload(within(panel).getByLabelText('Stratagem files'), [new File([strat], 'Stratagems.csv'), new File([det], 'Detachment_abilities.csv')])
    expect(await within(panel).findByRole('status')).toHaveTextContent('3 stratagems, 1 detachment rules')
    await user.upload(within(panel).getByLabelText('Stratagem files'), new File(['x|y|\n1|2|'], 'bad.csv'))
    expect(await within(panel).findByRole('alert')).toHaveTextContent('not a Wahapedia')

    await user.click(screen.getByRole('button', { name: 'Armies' }))
    await user.click(screen.getByRole('button', { name: '+ New list' }))
    const form = screen.getByRole('form', { name: 'New list' })
    await user.type(within(form).getByLabelText('Name'), 'Strats')
    await user.click(within(form).getByRole('button', { name: 'Create' }))
    const add = await screen.findByRole('region', { name: 'Add units' })
    await user.click(within(add).getByRole('button', { name: 'Add Big Walker' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Choose faction' })).getByRole('button', { name: 'Testers' }))
    await user.selectOptions(screen.getByLabelText('Add detachment'), 'Line Doctrine (1 DP)')
    await user.selectOptions(screen.getByLabelText('Add detachment'), 'Heavy Doctrine (3 DP)')
    window.print = vi.fn()
    await user.click(screen.getByRole('button', { name: '📄 Army PDF' }))
    const ask = screen.getByRole('dialog', { name: 'Print army' })
    expect(within(ask).getByLabelText('Stratagem cards')).toBeChecked()
    expect(within(ask).getByText('Line Doctrine: 1 stratagems')).toBeInTheDocument()
    expect(within(ask).getByText('Heavy Doctrine: not found, pick it')).toBeInTheDocument()
    await user.selectOptions(within(ask).getByLabelText('Stratagems for Heavy Doctrine'), 'Heavy Force')
    expect(within(screen.getByRole('dialog', { name: 'Print army' })).getByText('Heavy Doctrine: 1 stratagems')).toBeInTheDocument()
    await user.click(within(screen.getByRole('dialog', { name: 'Print army' })).getByRole('button', { name: '🖨 Print' }))
    const cards = within(screen.getByLabelText('Army sheet')).getByLabelText('Stratagem cards')
    expect(cards).toHaveTextContent('Line DoctrineSteady Lines: Stay in line.')
    expect(within(cards).getByLabelText('HOLD FAST stratagem')).toHaveTextContent('HOLD FAST2 CPLine Doctrine – Battle Tactic Stratagem · Your turn · Fight phaseHold!')
    expect(within(cards).getByLabelText('BIG PUSH stratagem')).toBeInTheDocument()
    expect(within(cards).getByLabelText('COMMAND RE-ROLL stratagem')).toHaveTextContent('WHEN: Any phase.')
    expect(cards).toHaveTextContent('powered by Wahapedia')
    window.dispatchEvent(new Event('afterprint'))

    await user.click(screen.getByRole('button', { name: '⚙ Settings' }))
    await user.click(within(screen.getByRole('region', { name: 'Stratagems' })).getByRole('button', { name: 'Remove' }))
    expect(within(screen.getByRole('region', { name: 'Stratagems' })).queryByRole('status')).toBeNull()
  })

  it('only lets Characters be the Warlord', async () => {
    const user = await start()
    await user.click(screen.getByRole('button', { name: '+ New list' }))
    const form = screen.getByRole('form', { name: 'New list' })
    await user.type(within(form).getByLabelText('Name'), 'No heroes')
    await user.click(within(form).getByRole('button', { name: 'Create' }))
    const add = await screen.findByRole('region', { name: 'Add units' })
    await user.click(within(add).getByRole('button', { name: 'Add Big Walker' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Choose faction' })).getByRole('button', { name: 'Testers' }))
    const star = screen.getByRole('button', { name: 'Warlord: Big Walker' })
    expect(star).toBeDisabled()
    expect(star).toHaveAttribute('title', 'Only a Character can be the Warlord')
    expect(screen.getByRole('status')).toHaveTextContent('★ Add a Character to choose your Warlord.')
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
