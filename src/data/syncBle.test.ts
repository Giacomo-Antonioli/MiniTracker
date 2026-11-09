import { expect, it } from 'vitest'
import { blePair, NOT_CONFIRMED_BLE, reassembler, toFrames, type BleLink } from './syncBle'

/** Two ends of a fake GATT link: frames arrive in order, a tick later. */
function fakeLinks(maxFrame = 20, tamper?: (f: Uint8Array) => Uint8Array): [BleLink, BleLink] {
  const mk = () => {
    let on: (f: Uint8Array) => void = () => {}
    let onClose: () => void = () => {}
    return { on: (f: Uint8Array) => on(f), setOn: (fn: typeof on) => (on = fn), onClose: () => onClose(), setClose: (fn: () => void) => (onClose = fn) }
  }
  const a = mk()
  const b = mk()
  const link = (me: ReturnType<typeof mk>, you: ReturnType<typeof mk>, tam?: typeof tamper): BleLink => ({
    maxFrame,
    send: (f) => void setTimeout(() => you.on(tam ? tam(f) : f), 0),
    onFrame: (fn) => me.setOn(fn),
    onClose: (fn) => me.setClose(fn),
    close: () => void setTimeout(() => (me.onClose(), you.onClose()), 0),
  })
  return [link(a, b), link(b, a, tamper)]
}

const devA = { deviceId: 'a', deviceName: 'Phone' }
const devB = { deviceId: 'b', deviceName: 'PC' }

it('cuts messages into frames and puts them back, whatever the size', () => {
  for (const len of [0, 1, 18, 19, 20, 500]) {
    const bytes = Uint8Array.from({ length: len }, (_, i) => i % 251)
    const frames = toFrames(bytes, 20)
    expect(frames.every((f) => f.length <= 20)).toBe(true)
    const got: Uint8Array[] = []
    const feed = reassembler((m) => got.push(m))
    frames.forEach(feed)
    expect(got).toHaveLength(1)
    expect([...got[0]]).toEqual([...bytes])
  }
})

it('pairs with the same code on both sides and carries long text both ways, encrypted', async () => {
  const [pa, pb] = fakeLinks(23)
  const codes: string[] = []
  const decide = async (p: { code: string }) => (codes.push(p.code), true)
  const [a, b] = await Promise.all([blePair(pa, false, { me: devA, decide }), blePair(pb, true, { me: devB, decide })])
  expect(codes[0]).toMatch(/^\d{6}$/)
  expect(codes[0]).toBe(codes[1])
  expect(a.other.deviceName).toBe('PC')
  expect(b.other.deviceName).toBe('Phone')
  const big = 'x'.repeat(5000) + 'è日本'
  const gotB = new Promise<string[]>((res) => {
    const seen: string[] = []
    b.channel.onMessage((t) => (seen.push(t), seen.length === 2 && res(seen)))
  })
  const gotA = new Promise<string>((res) => a.channel.onMessage(res))
  a.channel.send(big)
  a.channel.send('second')
  b.channel.send('reply')
  expect(await gotB).toEqual([big, 'second'])
  expect(await gotA).toBe('reply')
})

it('fails on both sides when one person says no', async () => {
  const [pa, pb] = fakeLinks()
  const r = await Promise.allSettled([blePair(pa, false, { me: devA, decide: async () => true }), blePair(pb, true, { me: devB, decide: async () => false })])
  expect(r.map((x) => x.status)).toEqual(['rejected', 'rejected'])
  expect((r[1] as PromiseRejectedResult).reason.message).toBe(NOT_CONFIRMED_BLE)
})

it('closes the channel when a message is tampered with', async () => {
  let tamperOn = false
  const [pa, pb] = fakeLinks(64, (f) => {
    if (!tamperOn) return f
    const g = f.slice()
    g[g.length - 1] ^= 1
    return g
  })
  const decide = async () => true
  const [a, b] = await Promise.all([blePair(pa, false, { me: devA, decide }), blePair(pb, true, { me: devB, decide })])
  const closed = new Promise<void>((res) => b.channel.onClose(res))
  a.channel.onMessage(() => {
    throw new Error('should not be delivered')
  })
  const tampered = new Promise<void>((res) => a.channel.onClose(res))
  tamperOn = true
  b.channel.send('hello')
  await tampered
  await closed
})
