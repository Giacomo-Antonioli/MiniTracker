// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, it } from 'vitest'
import { parseOpr } from '../../data/catalogue/opr'
import type { ListEntry } from '../../domain/lists/types'
import { UpgradeEditor } from './UpgradeEditor'

const gun = (name: string) => ({ name, type: 'ArmyBookWeapon', count: 1, range: 12, attacks: 1 })
const book = {
  uid: 'a', name: 'Alpha', gameSystemSlug: 'grimdark-future',
  units: [{ id: 'u', name: 'Captain', cost: 50, size: 1, quality: 3, defense: 3, weapons: [gun('Pistol')], upgrades: ['P'] }],
  upgradePackages: [{ uid: 'P', sections: [{ uid: 's', label: 'Replace Pistol', variant: 'replace', targets: ['Pistol'], options: [
    { uid: 'r', label: 'Rifle', costs: [{ unitId: 'u', cost: 5 }], gains: [gun('Rifle')] },
    { uid: 'c', label: 'Cannon', costs: [{ unitId: 'u', cost: 20 }], gains: [gun('Cannon')] },
  ] }] }],
}

it('swaps between exclusive options and shows the resulting weapons', async () => {
  const d = parseOpr([{ name: 'a.json', text: JSON.stringify(book) }], { repo: 'army-forge/grimdark-future', commit: 'c', fetchedAt: 't' }).datasheets[0]
  let last: ListEntry['upgrades']
  function Wrap() {
    const [upgrades, setUpgrades] = useState<ListEntry['upgrades']>()
    return <UpgradeEditor d={d} entry={{ id: 'e', datasheetId: d.id, models: 1, wargear: [], upgrades }} onChange={(p) => { last = p; setUpgrades(p) }} />
  }
  render(<Wrap />)
  const user = userEvent.setup()
  expect(screen.getByText('1x Pistol')).toBeTruthy()
  await user.click(screen.getByRole('checkbox', { name: /Rifle/ }))
  expect(screen.getByText('1x Rifle')).toBeTruthy()
  await user.click(screen.getByRole('checkbox', { name: /Cannon/ }))
  expect(last).toEqual({ 's/c': 1 })
  expect(screen.getByText('1x Cannon')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Clear upgrades' }))
  expect(last).toBeUndefined()
})
