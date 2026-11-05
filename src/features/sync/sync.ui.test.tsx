// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '../../app/App'
import { appDb, useStore } from '../../app/store'
import { MiniTrackerDb } from '../../data/db'
import type { Channel } from '../../data/syncChannel'
import { runSync } from '../../data/syncSession'
import { makeSyncFile } from '../../data/syncFile'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'
import { DEFAULT_LAYOUT } from '../../domain/home/layout'
import type { OwnedUnit } from '../../domain/collection/types'
import { createUnit } from '../../domain/collection/ownedUnit'

class FakeEnd implements Channel {
  peer!: FakeEnd
  private messageFns: ((t: string) => void)[] = []
  private closeFns: (() => void)[] = []
  send(t: string) { setTimeout(() => this.peer.messageFns.forEach((f) => f(t)), 0) }
  onMessage(f: (t: string) => void) { this.messageFns.push(f) }
  onClose(f: () => void) { this.closeFns.push(f) }
  close() { setTimeout(() => this.peer.closeFns.forEach((f) => f()), 0) }
}

// The other device: a second database answering on the other end of the connection.
let other: MiniTrackerDb
let otherRun: Promise<unknown> | undefined
const joined: string[] = []
let joinFails: string | undefined
vi.mock('../../data/syncChannel', () => ({
  PIECE_SIZE: 16_000,
  NO_DIRECT: "These devices can't reach each other directly",
  joinByCode: async (code: string) => {
    joined.push(code)
    if (joinFails) throw new Error(joinFails)
    const a = new FakeEnd()
    const b = new FakeEnd()
    a.peer = b
    b.peer = a
    otherRun = runSync(other, b, { deviceId: 'phone', deviceName: 'My phone' }, { starts: false }, { confirmPlan: async () => true, confirmChanges: async () => true })
    return a
  },
  hostByCode: async () => ({ channel: new Promise(() => {}), cancel: () => {} }),
  privateOffer: async () => ({ offer: '{"type":"offer","sdp":"x"}', accept: async () => new FakeEnd(), cancel: () => {} }),
  privateAnswer: async () => ({ answer: '{"type":"answer"}', channel: new Promise(() => {}) }),
}))

const unit = (id: string): OwnedUnit => createUnit({ customName: id, groups: [{ count: 1, status: 'built' }] }, { now: '2026-11-01T00:00:00Z', newId: () => id })

beforeEach(async () => {
  localStorage.setItem('startPage', 'backlog')
  history.replaceState(null, '', '/')
  await appDb.delete()
  await appDb.open()
  other = new MiniTrackerDb('other-' + Math.random())
  await other.units.put(unit('From phone'))
  await appDb.units.put(unit('From PC'))
  useStore.setState({ ready: false, units: [], homeLayout: DEFAULT_LAYOUT, pipeline: DEFAULT_PIPELINE })
})
afterEach(() => {
  joinFails = undefined
  joined.length = 0
  return other.delete()
})

it('syncs both ways by pairing code, with a preview, and remembers the device', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: '⇄ Sync' }))
  expect(await screen.findByText(/This device:/)).toBeInTheDocument()
  await user.type(screen.getByLabelText('Pairing code'), 'nope{enter}')
  expect(await screen.findByText(/not a pairing code/)).toBeInTheDocument()
  await user.clear(screen.getByLabelText('Pairing code'))
  await user.type(screen.getByLabelText('Pairing code'), 'k7p-42qx{enter}')

  const d = within(await screen.findByRole('dialog', { name: 'Apply these changes?' }))
  expect(d.getByRole('table', { name: 'Changes' })).toHaveTextContent('Units1')
  await user.click(d.getByRole('button', { name: 'Apply' }))
  expect(await screen.findByText('✓ Synced with My phone.')).toBeInTheDocument()
  await otherRun
  await waitFor(() => expect(useStore.getState().units.map((u) => u.customName).sort()).toEqual(['From PC', 'From phone']))
  expect((await other.units.toArray()).map((u) => u.customName).sort()).toEqual(['From PC', 'From phone'])
  expect(within(screen.getByRole('region', { name: 'Devices' })).getByText('My phone')).toBeInTheDocument()
})

it('a pairing link opens Sync and connects; Settings › Sync names the device', async () => {
  history.replaceState(null, '', '/#sync=K7P42QX')
  const user = userEvent.setup()
  render(<App />)
  await user.click(within(await screen.findByRole('dialog', { name: 'Apply these changes?' })).getByRole('button', { name: "Don't change anything" }))
  expect(await screen.findByText(/Nothing was changed on this device/)).toBeInTheDocument()
  expect(useStore.getState().units.map((u) => u.customName)).toEqual(['From PC'])

  await user.click(screen.getByRole('button', { name: 'Sync settings' }))
  await user.clear(await screen.findByLabelText('Device name'))
  await user.type(screen.getByLabelText('Device name'), 'Studio PC')
  await user.click(screen.getByRole('button', { name: 'Save name' }))
  expect(await screen.findByText('Name saved.')).toBeInTheDocument()
  await user.click(screen.getByLabelText(/Mark deletions/))
  await waitFor(async () => expect((await appDb.settings.get('syncPrefs'))?.value).toMatchObject({ tagDeletions: true }))
  expect(within(screen.getByRole('region', { name: 'Known devices' })).getByText('My phone')).toBeInTheDocument()
})

it('opens a sync file from another device', async () => {
  const f = await makeSyncFile(other, { deviceId: 'phone', deviceName: 'My phone' }, { photos: false })
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: '⇄ Sync' }))
  const file = new File([JSON.stringify(f)], 'x.json', { type: 'application/json' })
  await user.upload(await screen.findByLabelText('Open sync file'), file)
  const d = within(await screen.findByRole('dialog', { name: 'Apply the sync file?' }))
  await d.findByRole('table', { name: 'Changes' })
  await user.click(d.getByRole('button', { name: 'Apply' }))
  await waitFor(() => expect(useStore.getState().units.map((u) => u.customName).sort()).toEqual(['From PC', 'From phone']))
  expect(screen.getByText('Applied the sync file from My phone.')).toBeInTheDocument()
})

it('Sync now reaches a known device by its own code; a failed connection says what to do', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: '⇄ Sync' }))
  await user.type(await screen.findByLabelText('Pairing code'), 'K7P42QX{enter}')
  await user.click(within(await screen.findByRole('dialog', { name: 'Apply these changes?' })).getByRole('button', { name: 'Apply' }))
  await screen.findByText('✓ Synced with My phone.')
  await otherRun

  const { deviceCodeFor } = await import('../../domain/sync/protocol')
  joinFails = 'No device is waiting with this code'
  await user.click(screen.getByRole('button', { name: 'Sync now with My phone' }))
  expect(joined.at(-1)).toBe(deviceCodeFor('phone'))
  expect(await screen.findByText(/My phone isn't reachable right now/)).toBeInTheDocument()

  joinFails = "These devices can't reach each other directly"
  await user.click(screen.getByRole('button', { name: 'Sync now with My phone' }))
  expect(await screen.findByRole('button', { name: 'TURN server settings' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Use the QR carousel' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'TURN server settings' }))
  expect(await screen.findByLabelText('TURN address')).toBeInTheDocument()
})
