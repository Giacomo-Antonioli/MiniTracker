// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { LanBridge, NearbyPeer } from '../../data/syncLan'
import { NearbyDevices } from './NearbyDevices'

const peers: NearbyPeer[] = [
  { id: 'pc', name: 'Gaming PC', addrs: ['192.168.1.5'], port: 4000 },
  { id: 'phone', name: 'Pixel', addrs: ['192.168.1.6'], port: 4001 },
]

it('lists nearby devices: one click to sync with paired ones, pair the others', async () => {
  const bridge: LanBridge = {
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    onPeers: (fn) => (fn(peers), () => {}),
    onIncoming: () => () => {},
    connect: vi.fn(),
  }
  render(
    <NearbyDevices me={{ deviceId: 'me', deviceName: 'Laptop' }} busy={false} known={[{ id: 'pc', name: 'Gaming PC', lastSync: '2026-11-07', lanPaired: true }]}
      onChannel={() => {}} onStatus={() => {}} onError={() => {}} bridge={async () => bridge} />,
  )
  expect(await screen.findByRole('button', { name: 'Sync now with Gaming PC' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Pair with Pixel' })).toBeTruthy()
  expect(bridge.start).toHaveBeenCalledWith({ deviceId: 'me', deviceName: 'Laptop' })
})
