import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { MiniTrackerDb } from './db'
import { defaultDeviceName, forgetDevice, getDevice, getKnownDevices, getSyncPrefs, isStale, markLanPaired, recordSync, saveSyncPrefs, setDeviceName } from './syncDevice'

let db: MiniTrackerDb
beforeEach(() => {
  db = new MiniTrackerDb('device-' + Math.random())
})
afterEach(() => db.delete())

it('names devices from the browser', () => {
  expect(defaultDeviceName('Mozilla/5.0 (Windows NT 10.0) AppleWebKit Chrome/130 Safari/537')).toBe('Chrome on Windows')
  expect(defaultDeviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 18) AppleWebKit Version/18 Mobile Safari/604')).toBe('Safari on iPhone')
  expect(defaultDeviceName('Mozilla/5.0 (Linux; Android 15) Chrome/130 Mobile Safari/537')).toBe('Chrome on Android')
  expect(defaultDeviceName('x')).toBe('Browser on this device')
})

it('keeps one id per device, a name, known devices and preferences', async () => {
  const a = await getDevice(db)
  expect((await getDevice(db)).deviceId).toBe(a.deviceId)
  await expect(setDeviceName(db, ' ')).rejects.toThrow()
  await setDeviceName(db, ' Studio PC ')
  expect((await getDevice(db)).deviceName).toBe('Studio PC')

  await recordSync(db, { deviceId: 'p', deviceName: 'Phone' }, '2026-01-01T00:00:00Z')
  await recordSync(db, { deviceId: 't', deviceName: 'Tablet' }, '2026-11-01T00:00:00Z')
  await recordSync(db, { deviceId: 'p', deviceName: 'My phone' }, '2026-11-02T00:00:00Z')
  const list = await getKnownDevices(db)
  expect(list.map((d) => d.name)).toEqual(['My phone', 'Tablet'])
  expect(isStale({ id: 'x', name: 'x', lastSync: '2026-01-01T00:00:00Z' }, '2026-11-04T00:00:00Z')).toBe(true)
  expect(isStale(list[1], '2026-11-04T00:00:00Z')).toBe(false)
  await forgetDevice(db, 't')
  expect((await getKnownDevices(db)).map((d) => d.id)).toEqual(['p'])

  expect(await getSyncPrefs(db)).toEqual({})
  await saveSyncPrefs(db, { mode: 'merge' })
  expect(await saveSyncPrefs(db, { photos: true })).toEqual({ mode: 'merge', photos: true })
})

it('remembers a LAN pairing across later syncs', async () => {
  const other = { deviceId: 'b', deviceName: 'PC' }
  await markLanPaired(db, other, '2026-11-07T10:00:00Z')
  await recordSync(db, other, '2026-11-08T10:00:00Z')
  expect(await getKnownDevices(db)).toEqual([{ id: 'b', name: 'PC', lastSync: '2026-11-08T10:00:00Z', lanPaired: true }])
})
