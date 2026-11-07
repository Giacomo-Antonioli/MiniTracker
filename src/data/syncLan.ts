/**
 * Sync with nearby devices on the same network (#168 Phase 2), desktop and Android apps only.
 * The app finds the others over mDNS and opens a small LAN pipe (WebSocket, in the Rust core) to one. The
 * pipe carries only the WebRTC connection texts and the pairing confirmation; the data then goes over the
 * same encrypted WebRTC channel as every other sync, and runSync does the rest.
 *
 * First pairing: both screens show a 6-digit code made from both connections' encryption fingerprints,
 * so a device in the middle would show a different code. Once both sides confirm, the devices remember each
 * other and later syncs skip the code.
 */
import { channelOpen, fromDataChannel, gathered, guard, iceServers, type Channel } from './syncChannel'
import type { Device } from './syncDevice'

/** Another MiniTracker app found on the network. */
export interface NearbyPeer {
  id: string
  name: string
  addrs: string[]
  port: number
}

/** A text pipe to a nearby device. */
export interface Pipe {
  send(text: string): void
  onMessage(fn: (text: string) => void): void
  onClose(fn: () => void): void
  close(): void
}

export interface LanBridge {
  start(me: Device): Promise<void>
  stop(): Promise<void>
  /** The list of nearby devices, every time it changes. Returns an unsubscribe. */
  onPeers(fn: (peers: NearbyPeer[]) => void): () => void
  /** A nearby device opened a pipe to this one. Returns an unsubscribe. */
  onIncoming(fn: (pipe: Pipe) => void): () => void
  connect(peer: NearbyPeer): Promise<Pipe>
}

type Signal =
  | { t: 'hi'; id: string; name: string }
  | { t: 'offer'; sdp: string }
  | { t: 'answer'; sdp: string }
  | { t: 'ok' }
  | { t: 'no' }

/** What the person on this device decides about a pairing. */
export interface PairPrompt {
  other: Device
  /** The 6-digit code; the same on both screens. */
  code: string
  /** True when this device already paired with the other one and its certificate matches: no need to ask. */
  known: boolean
  /** Paired before, but the other device's certificate is different now: its identity changed. */
  changed: boolean
  /** The other device's certificate fingerprint, to store with the pairing. */
  theirPrint: string
}

export const NOT_CONFIRMED = 'The pairing was not confirmed on both devices.'

/** Waits for one signal of the given type; fails when the pipe closes or the other side says no. */
function inbox(pipe: Pipe) {
  const got: Signal[] = []
  const waiting: (() => void)[] = []
  let closed = false
  pipe.onMessage((text) => {
    try {
      got.push(JSON.parse(text) as Signal)
    } catch {
      return
    }
    waiting.splice(0).forEach((w) => w())
  })
  pipe.onClose(() => {
    closed = true
    waiting.splice(0).forEach((w) => w())
  })
  return async function next<T extends Signal['t']>(t: T, ms = 5 * 60_000): Promise<Extract<Signal, { t: T }>> {
    const deadline = Date.now() + ms
    for (;;) {
      const i = got.findIndex((s) => s.t === t || s.t === 'no')
      if (i >= 0) {
        const s = got.splice(i, 1)[0]
        if (s.t === 'no' && t !== 'no') throw new Error(NOT_CONFIRMED)
        return s as Extract<Signal, { t: T }>
      }
      if (closed) throw new Error(NOT_CONFIRMED)
      if (Date.now() > deadline) throw new Error('The other device did not answer')
      await new Promise<void>((r) => {
        waiting.push(r)
        setTimeout(r, Math.max(0, deadline - Date.now()))
      })
    }
  }
}

const say = (pipe: Pipe, s: Signal) => pipe.send(JSON.stringify(s))

/** The certificate fingerprint in a connection text ("sha-256 AB:CD:…"). */
export const fingerprintOf = (sdp: string) => (/a=fingerprint:(\S+ \S+)/.exec(sdp)?.[1] ?? '').toUpperCase()

/** The 6-digit code for a pair of connection texts: the same on both devices, different for anyone in the middle. */
export async function pairingCode(offerSdp: string, answerSdp: string): Promise<string> {
  const prints = [offerSdp, answerSdp].map((s) => (/a=fingerprint:(\S+ \S+)/.exec(s)?.[1] ?? s).toUpperCase()).sort()
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(prints.join('|'))))
  const n = new DataView(hash.buffer).getUint32(0) % 1_000_000
  return String(n).padStart(6, '0')
}

function promptFor(other: Device, code: string, theirSdp: string, o: LanOptions): PairPrompt {
  const theirPrint = fingerprintOf(theirSdp)
  const stored = o.knownPrint(other.deviceId)
  return { other, code, theirPrint, known: !!stored && !!theirPrint && stored === theirPrint, changed: !!stored && stored !== theirPrint }
}

/** This device's certificate for LAN pairing: made once, then kept (renewed when it expires). */
export async function lanCertificate(load: () => Promise<RTCCertificate | undefined>, save: (c: RTCCertificate) => Promise<void>): Promise<RTCCertificate | undefined> {
  try {
    const have = await load()
    if (have && have.expires > Date.now() + 86_400_000) return have
    const made = await RTCPeerConnection.generateCertificate({ name: 'ECDSA', namedCurve: 'P-256', expires: 365 * 86_400_000 } as EcKeyGenParams)
    await save(made)
    return made
  } catch {
    return undefined // no stored certificate: every connection gets a new one, so pairing asks each time
  }
}

const sdpOf = (text: string) => (JSON.parse(text) as RTCSessionDescriptionInit).sdp ?? ''

/**
 * Both sides after the connection texts were swapped: ask the person (unless known) and wait for the other
 * device's confirmation, then for the encrypted channel.
 */
async function confirm(pipe: Pipe, next: ReturnType<typeof inbox>, prompt: PairPrompt, decide: (p: PairPrompt) => Promise<boolean>, open: Promise<Channel>): Promise<{ channel: Channel; other: Device; theirPrint: string }> {
  open.catch(() => {})
  const theirOk = next('ok')
  theirOk.catch(() => {})
  const mine = prompt.known || (await decide(prompt))
  if (!mine) {
    say(pipe, { t: 'no' })
    pipe.close()
    throw new Error(NOT_CONFIRMED)
  }
  say(pipe, { t: 'ok' })
  await theirOk
  const channel = await open
  pipe.close()
  return { channel, other: prompt.other, theirPrint: prompt.theirPrint }
}

export interface LanOptions {
  me: Device
  /** The certificate fingerprint stored when this device paired with that one, if it did. */
  knownPrint(id: string): string | undefined
  /** This device's own long-lived certificate, so the other device can recognise it next time. */
  certificate?: RTCCertificate
  /** Ask the person to compare the code on both screens. */
  decide(p: PairPrompt): Promise<boolean>
  turn?: { urls: string; username?: string; credential?: string }
}

/** This device starts: send the connection text through the pipe, get the reply, confirm the pairing. */
export async function lanStart(pipe: Pipe, o: LanOptions): Promise<{ channel: Channel; other: Device; theirPrint: string }> {
  const next = inbox(pipe)
  say(pipe, { t: 'hi', id: o.me.deviceId, name: o.me.deviceName })
  const pc = new RTCPeerConnection({ iceServers: iceServers(o), ...(o.certificate ? { certificates: [o.certificate] } : {}) })
  try {
    const dc = pc.createDataChannel('sync', { ordered: true })
    const ch = fromDataChannel(dc, pc)
    const isOpen = channelOpen(dc)
    isOpen.catch(() => {})
    await pc.setLocalDescription(await pc.createOffer())
    const offer = await gathered(pc)
    say(pipe, { t: 'offer', sdp: offer })
    const hi = await next('hi', 30_000)
    const { sdp: answer } = await next('answer', 30_000)
    await pc.setRemoteDescription(JSON.parse(answer) as RTCSessionDescriptionInit)
    const other = { deviceId: hi.id, deviceName: hi.name }
    const code = await pairingCode(sdpOf(offer), sdpOf(answer))
    return await confirm(pipe, next, promptFor(other, code, sdpOf(answer), o), o.decide, guard(isOpen.then(() => ch), () => pc, 5 * 60_000))
  } catch (e) {
    pc.close()
    pipe.close()
    throw e
  }
}

/** The other device started: answer through the pipe, confirm the pairing. */
export async function lanAnswer(pipe: Pipe, o: LanOptions): Promise<{ channel: Channel; other: Device; theirPrint: string }> {
  const next = inbox(pipe)
  say(pipe, { t: 'hi', id: o.me.deviceId, name: o.me.deviceName })
  const pc = new RTCPeerConnection({ iceServers: iceServers(o), ...(o.certificate ? { certificates: [o.certificate] } : {}) })
  try {
    const open = new Promise<Channel>((resolve, reject) => {
      pc.addEventListener('datachannel', (e) => {
        const ch = fromDataChannel(e.channel, pc)
        void channelOpen(e.channel).then(() => resolve(ch), reject)
      })
    })
    const hi = await next('hi', 30_000)
    const { sdp: offer } = await next('offer', 30_000)
    await pc.setRemoteDescription(JSON.parse(offer) as RTCSessionDescriptionInit)
    await pc.setLocalDescription(await pc.createAnswer())
    const answer = await gathered(pc)
    say(pipe, { t: 'answer', sdp: answer })
    const other = { deviceId: hi.id, deviceName: hi.name }
    const code = await pairingCode(sdpOf(offer), sdpOf(answer))
    return await confirm(pipe, next, promptFor(other, code, sdpOf(offer), o), o.decide, guard(open, () => pc, 5 * 60_000))
  } catch (e) {
    pc.close()
    pipe.close()
    throw e
  }
}

// ---------- the Rust core (Tauri) ----------

/** The LAN bridge of the desktop/Android app. */
export async function tauriLan(): Promise<LanBridge> {
  const [{ invoke }, { listen }] = await Promise.all([import('@tauri-apps/api/core'), import('@tauri-apps/api/event')])
  const pipes = new Map<number, { msg?: (t: string) => void; close?: () => void; early: string[]; closed: boolean }>()
  const slot = (conn: number) => {
    let p = pipes.get(conn)
    if (!p) pipes.set(conn, (p = { early: [], closed: false }))
    return p
  }
  const pipeFor = (conn: number): Pipe => {
    const p = slot(conn)
    return {
      send: (text) => void invoke('lan_send', { conn, text }).catch(() => {}),
      onMessage: (fn) => {
        p.msg = fn
        p.early.splice(0).forEach(fn)
      },
      onClose: (fn) => {
        p.close = fn
        if (p.closed) fn()
      },
      close: () => void invoke('lan_close', { conn }).catch(() => {}),
    }
  }
  const incoming = new Set<(p: Pipe) => void>()
  const peerFns = new Set<(p: NearbyPeer[]) => void>()
  let peers: NearbyPeer[] = []
  await listen<{ conn: number; text: string }>('lan-msg', ({ payload }) => {
    const p = slot(payload.conn)
    if (p.msg) p.msg(payload.text)
    else p.early.push(payload.text)
  })
  await listen<{ conn: number }>('lan-close', ({ payload }) => {
    const p = slot(payload.conn)
    p.closed = true
    p.close?.()
    pipes.delete(payload.conn)
  })
  await listen<{ conn: number; incoming: boolean }>('lan-open', ({ payload }) => {
    if (payload.incoming) incoming.forEach((fn) => fn(pipeFor(payload.conn)))
  })
  await listen<NearbyPeer[]>('lan-peers', ({ payload }) => {
    peers = payload
    peerFns.forEach((fn) => fn(peers))
  })
  return {
    start: async (me) => void (await invoke('lan_start', { id: me.deviceId, name: me.deviceName })),
    stop: () => invoke('lan_stop'),
    onPeers: (fn) => {
      peerFns.add(fn)
      fn(peers)
      return () => peerFns.delete(fn)
    },
    onIncoming: (fn) => {
      incoming.add(fn)
      return () => incoming.delete(fn)
    },
    connect: async (peer) => pipeFor(await invoke<number>('lan_connect', { addrs: peer.addrs, port: peer.port })),
  }
}

let shared: Promise<LanBridge> | undefined
/** One bridge for the whole app (the event listeners are global). */
export const lanBridge = () => (shared ??= tauriLan())
