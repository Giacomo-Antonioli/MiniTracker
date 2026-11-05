// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../app/App'
import { appDb, useStore } from '../../app/store'
import { parseBsData } from '../../data/catalogue/bsdata'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'

const raw = import.meta.glob('../../data/catalogue/fixtures/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const catalogue = parseBsData(Object.entries(raw).map(([p, text]) => ({ name: p.split('/').pop()!, text })), { repo: 't', commit: 'c', fetchedAt: '2026-11-01T00:00:00.000Z' })

async function start(cat: object | null = catalogue, mode: 'collapsed' | 'expanded' | 'hover' = 'collapsed') {
  await appDb.delete()
  await appDb.open()
  if (cat) await appDb.catalogues.put(cat as never)
  useStore.setState({ ready: false, units: [], catalogue: null, pipeline: DEFAULT_PIPELINE, ruleDisplay: mode })
  const user = userEvent.setup()
  render(<App />)
  await screen.findByText(/Your backlog is empty/)
  return user
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('startPage', 'backlog')
})

describe('Rules page', () => {
  it('lists core and faction rules, searches, and shows which units have a rule', async () => {
    const user = await start()
    await user.click(screen.getByRole('button', { name: 'Rules' }))
    expect(screen.getByText('4 of 4 rules · Test Game')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Core rules' })).getByText('Deep Strike')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Testers' })).getByText('Testers Doctrine')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(/Search name or text/), 'reserves')
    expect(screen.getByText('1 of 4 rules · Test Game')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Which units have it?' }))
    await user.click(screen.getByRole('button', { name: 'Line Troopers' }))
    expect(screen.getByRole('complementary', { name: 'Datasheet details' })).toHaveTextContent('Line Troopers')
  })

  it('collapsed mode: the arrow opens the explanation under the name', async () => {
    const user = await start()
    await user.click(screen.getByRole('button', { name: 'Rules' }))
    const btn = screen.getByRole('button', { name: /Assault/ })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    await user.click(btn)
    const note = screen.getByRole('note', { name: 'Assault explanation' })
    expect(note).toHaveTextContent('Weapons with [ASSAULT] can shoot after Advancing.')
    expect(within(note).getByText('[ASSAULT]').tagName).toBe('B')
  })

  it('expanded mode shows every explanation; hover mode shows it while hovering', async () => {
    let user = await start(catalogue, 'expanded')
    await user.click(screen.getByRole('button', { name: 'Rules' }))
    expect(screen.getAllByRole('note')).toHaveLength(4)
    document.body.innerHTML = ''

    user = await start(catalogue, 'hover')
    await user.click(screen.getByRole('button', { name: 'Rules' }))
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    await user.hover(screen.getByRole('button', { name: /Deep Strike/ }))
    expect(screen.getByRole('note', { name: 'Deep Strike explanation' })).toBeInTheDocument()
    await user.unhover(screen.getByRole('button', { name: /Deep Strike/ }))
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('the setting lives in Settings → Appearance and is remembered', async () => {
    const user = await start()
    await user.click(screen.getByRole('button', { name: /Settings/ }))
    await user.click(await screen.findByRole('tab', { name: 'Appearance' }))
    await user.selectOptions(screen.getByLabelText('Rule explanations'), 'expanded')
    expect(useStore.getState().ruleDisplay).toBe('expanded')
    expect(localStorage.getItem('ruleDisplay')).toBe('expanded')
  })

  it('asks to re-download catalogues made before rules existed', async () => {
    const { rules: _r, formatVersion: _f, ...old } = catalogue
    const user = await start(old)
    await user.click(screen.getByRole('button', { name: 'Rules' }))
    expect(screen.getByText(/downloaded before rules were supported/)).toBeInTheDocument()
  })
})

describe('Datasheet panel', () => {
  it('shows abilities, unit rules and weapon abilities with explanations', async () => {
    const user = await start()
    await user.click(screen.getByRole('button', { name: /^Catalogue$/ }))
    await user.click(screen.getByRole('cell', { name: 'Line Troopers' }))
    const panel = screen.getByRole('complementary', { name: 'Datasheet details' })
    const abilities = within(panel).getByRole('region', { name: 'Abilities' })
    await user.click(within(abilities).getByRole('button', { name: /Hold the Line/ }))
    expect(within(abilities).getByRole('note')).toHaveTextContent('Once per battle, this unit can hold its ground.')
    expect(within(panel).getByRole('region', { name: 'Rules' })).toHaveTextContent('Deep Strike')
    const weapons = within(panel).getByRole('region', { name: 'Weapon abilities' })
    await user.click(within(weapons).getByRole('button', { name: /Sustained Hits 1/ }))
    expect(within(weapons).getByRole('note')).toHaveTextContent('Each Critical Hit scores extra hits.')
  })
})
