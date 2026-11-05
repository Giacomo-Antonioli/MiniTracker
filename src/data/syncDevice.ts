/** This device's name and id, the devices it synced with, and the sync preferences (#161). All device-only settings. */
import type { MiniTrackerDb } from './db'
import type { SyncPrefs } from './syncStamps'

export interface Device {
  deviceId: string
  deviceName: string
}

export interface KnownDevice {
  id: string
  name: string
  lastSync: string
}

/** Deletion markers expire after this many days, so a device away longer can bring deleted items back. */
export const STALE_DAYS = 90

/** A readable default name, e.g. "Chrome on Windows". */
export function defaultDeviceName(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): string {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'this device'
  return `${browser} on ${os}`
}

const get = async <T,>(db: MiniTrackerDb, key: string) => (await db.settings.get(key))?.value as T | undefined

/** This device's id and name; made on first use. */
export async function getDevice(db: MiniTrackerDb): Promise<Device> {
  let deviceId = await get<string>(db, 'deviceId')
  if (!deviceId) {
    deviceId = crypto.randomUUID()
    await db.settings.put({ key: 'deviceId', value: deviceId })
  }
  return { deviceId, deviceName: (await get<string>(db, 'deviceName')) || defaultDeviceName() }
}

export async function setDeviceName(db: MiniTrackerDb, name: string): Promise<void> {
  const n = name.trim()
  if (!n) throw new Error('Give this device a name')
  await db.settings.put({ key: 'deviceName', value: n })
}

export const getKnownDevices = async (db: MiniTrackerDb) => (await get<KnownDevice[]>(db, 'syncDevices')) ?? []

/** Remember the other device and when we last synced with it. */
export async function recordSync(db: MiniTrackerDb, other: Device, now: string): Promise<void> {
  const list = (await getKnownDevices(db)).filter((d) => d.id !== other.deviceId)
  await db.settings.put({ key: 'syncDevices', value: [{ id: other.deviceId, name: other.deviceName, lastSync: now }, ...list] })
}

export async function forgetDevice(db: MiniTrackerDb, id: string): Promise<void> {
  await db.settings.put({ key: 'syncDevices', value: (await getKnownDevices(db)).filter((d) => d.id !== id) })
}

/** Devices not synced for more than STALE_DAYS. */
export const isStale = (d: KnownDevice, now: string) => Date.parse(now) - Date.parse(d.lastSync) > STALE_DAYS * 86_400_000

export const getSyncPrefs = async (db: MiniTrackerDb): Promise<SyncPrefs> => (await get<SyncPrefs>(db, 'syncPrefs')) ?? {}

export async function saveSyncPrefs(db: MiniTrackerDb, patch: Partial<SyncPrefs>): Promise<SyncPrefs> {
  const next = { ...(await getSyncPrefs(db)), ...patch }
  await db.settings.put({ key: 'syncPrefs', value: next })
  return next
}
