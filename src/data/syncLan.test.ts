// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { lanAnswer, lanStart, NOT_CONFIRMED, pairingCode, type LanOptions, type PairPrompt, type Pipe } from './syncLan'

// ---- a fake WebRTC: two peers in one process ----
class FakeDC extends EventTarget {
  readyState = 'connecting'
  peer?: FakeDC
  send(t: string) {
    const p = this.peer!
    setTimeout(() => p.dispatchEvent(new MessageEvent('message', { data: t })), 0)
  }
  open() {
    this.readyState = 'open'
    this.dispatchEvent(new Event('open'))
  }
  close() {}
}
let n = 0
const answerers: FakePC[] = []
class FakePC extends EventTarget {
  fp: string
  constructor(cfg: { certificates?: { fp: string }[] } = {}) {
    super()
    this.fp = cfg.certificates?.[0]?.fp ?? `sha-256 AA:${++n}`
  }
  iceGatheringState = 'complete'
  iceConnectionState = 'new'
  localDescription?: RTCSessionDescriptionInit
  dc?: FakeDC
  createDataChannel() {
    return (this.dc = new FakeDC())
  }
  async createOffer() {
    return { type: 'offer', sdp: `v=0\na=fingerprint:${this.fp}` }
  }
  async createAnswer() {
    return { type: 'answer', sdp: `v=0\na=fingerprint:${this.fp}` }
  }
  async setLocalDescription(d: RTCSessionDescriptionInit) {
    this.localDescription = d
  }
  async setRemoteDescription(d: RTCSessionDescriptionInit) {
    if (d.type === 'offer') return void answerers.push(this)
    const b = new FakeDC()
    this.dc!.peer = b
    b.peer = this.dc
    answerers.pop()!.dispatchEvent(Object.assign(new Event('datachannel'), { channel: b }))
    setTimeout(() => (this.dc!.open(), b.open()), 0)
  }
  close() {}
}

function pipes(): [Pipe, Pipe] {
  const make = () => ({ msg: undefined as ((t: string) => void) | undefined, early: [] as string[], close: [] as (() => void)[] })
  const a = make()
  const b = make()
  let closed = false
  const end = (from: typeof a, to: typeof a): Pipe => ({
    send: (t) => setTimeout(() => (to.msg ? to.msg(t) : to.early.push(t)), 0),
    onMessage: (fn) => ((from.msg = fn), from.early.splice(0).forEach(fn)),
    onClose: (fn) => void from.close.push(fn),
    close: () => {
      if (closed) return
      closed = true
      setTimeout(() => [...a.close, ...b.close].forEach((f) => f()), 0)
    },
  })
  return [end(a, b), end(b, a)]
}

const cert = (id: string) => ({ fp: `SHA-256 CE:RT:${id}` }) as unknown as RTCCertificate
const opts = (id: string, decide: (p: PairPrompt) => Promise<boolean>, stored?: string): LanOptions => ({
  me: { deviceId: id, deviceName: `Device ${id}` },
  certificate: cert(id),
  knownPrint: () => stored,
  decide,
})

beforeEach(() => vi.stubGlobal('RTCPeerConnection', FakePC))
afterEach(() => vi.unstubAllGlobals())

it('makes the same 6-digit code on both sides, whatever the order', async () => {
  const a = 'a=fingerprint:sha-256 11:22', b = 'a=fingerprint:sha-256 33:44'
  const code = await pairingCode(a, b)
  expect(code).toMatch(/^\d{6}$/)
  expect(await pairingCode(b, a)).toBe(code)
  expect(await pairingCode(a, 'a=fingerprint:sha-256 99:99')).not.toBe(code)
})

it('pairs when both people confirm the same code, then the data channel works', async () => {
  const [pa, pb] = pipes()
  const seen: PairPrompt[] = []
  const yes = async (p: PairPrompt) => (seen.push(p), true)
  const [x, y] = await Promise.all([lanStart(pa, opts('A', yes)), lanAnswer(pb, opts('B', yes))])
  expect(x.other.deviceId).toBe('B')
  expect(y.other.deviceId).toBe('A')
  expect(seen).toHaveLength(2)
  expect(seen[0].code).toBe(seen[1].code)
  const got = new Promise<string>((r) => y.channel.onMessage(r))
  x.channel.send('hello')
  expect(await got).toBe('hello')
})

it('fails on both sides when one person cancels', async () => {
  const [pa, pb] = pipes()
  const r = await Promise.allSettled([lanStart(pa, opts('A', async () => true)), lanAnswer(pb, opts('B', async () => false))])
  expect(r.map((x) => x.status)).toEqual(['rejected', 'rejected'])
  expect((r[0] as PromiseRejectedResult).reason.message).toBe(NOT_CONFIRMED)
})

it('skips the question when the paired device shows the same certificate', async () => {
  const [pa, pb] = pipes()
  const decide = vi.fn(async () => true)
  const [x, y] = await Promise.all([lanStart(pa, opts('A', decide, 'SHA-256 CE:RT:B')), lanAnswer(pb, opts('B', decide, 'SHA-256 CE:RT:A'))])
  expect(decide).not.toHaveBeenCalled()
  expect(x.theirPrint).toBe('SHA-256 CE:RT:B')
  expect(y.theirPrint).toBe('SHA-256 CE:RT:A')
})

it('asks again, with a warning, when a paired device shows a different certificate', async () => {
  const [pa, pb] = pipes()
  const seen: PairPrompt[] = []
  const decide = vi.fn(async (p: PairPrompt) => (seen.push(p), true))
  await Promise.all([lanStart(pa, opts('A', decide, 'SHA-256 OLD:ONE')), lanAnswer(pb, opts('B', decide, 'SHA-256 CE:RT:A'))])
  expect(seen).toHaveLength(1)
  expect(seen[0]).toMatchObject({ known: false, changed: true, theirPrint: 'SHA-256 CE:RT:B' })
})
