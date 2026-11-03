/**
 * Connections between two devices for sync (#161). Both kinds end in a direct, encrypted WebRTC data channel:
 * - relay: PeerJS's public server passes the short connection messages, found by pairing code;
 * - private: no relay; the connection text is copied/pasted or shown as QR, once each way.
 */
import type { DataConnection, Peer as PeerType } from 'peerjs'
import { peerIdFor } from '../domain/sync/protocol'

/** A connected, ordered text channel to the other device. */
export interface Channel {
  send(text: string): void
  onMessage(fn: (text: string) => void): void
  onClose(fn: () => void): void
  close(): void
}

export interface ConnectOptions {
  /** Optional TURN server from Settings. */
  turn?: { urls: string; username?: string; credential?: string }
}

// Public address lookup only: they never see the data. IPv6 candidates are tried automatically.
const STUN = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }]
export const iceServers = (o: ConnectOptions = {}): RTCIceServer[] => (o.turn?.urls ? [...STUN, o.turn] : STUN)

/** Keep pieces under the size every browser accepts on a data channel. */
export const PIECE_SIZE = 16_000

// ---------- relay (PeerJS) ----------

async function newPeer(id: string | undefined, o: ConnectOptions): Promise<PeerType> {
  const { Peer } = await import('peerjs')
  const config = { config: { iceServers: iceServers(o) } }
  const peer = id ? new Peer(id, config) : new Peer(config)
  await new Promise<void>((resolve, reject) => {
    peer.on('open', () => resolve())
    peer.on('error', (e) => reject(new Error(relayError(e))))
  })
  return peer
}

function relayError(e: { type?: string; message?: string }): string {
  if (e.type === 'unavailable-id') return 'This code is already in use; try again for a new one'
  if (e.type === 'peer-unavailable') return 'No device is waiting with this code'
  if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') return 'Cannot reach the pairing service; try the private mode or the sync file'
  return e.message ?? 'Connection failed'
}

function fromPeerJs(conn: DataConnection, peer: PeerType): Channel {
  return {
    send: (t) => void conn.send(t),
    onMessage: (fn) => void conn.on('data', (d) => fn(String(d))),
    onClose: (fn) => void conn.on('close', fn),
    close: () => {
      conn.close()
      peer.destroy()
    },
  }
}

const opened = (conn: DataConnection) =>
  new Promise<void>((resolve, reject) => {
    conn.on('open', () => resolve())
    conn.on('error', (e) => reject(e))
  })

/** Wait on the relay under a pairing code until the other device connects. */
export async function hostByCode(code: string, o: ConnectOptions = {}): Promise<{ channel: Promise<Channel>; cancel: () => void }> {
  const peer = await newPeer(peerIdFor(code), o)
  const channel = new Promise<Channel>((resolve, reject) => {
    peer.on('connection', (conn) => void opened(conn).then(() => resolve(fromPeerJs(conn, peer)), reject))
    peer.on('error', (e) => reject(new Error(relayError(e))))
  })
  return { channel, cancel: () => peer.destroy() }
}

/** Connect to the device waiting under a pairing code. */
export async function joinByCode(code: string, o: ConnectOptions = {}): Promise<Channel> {
  const peer = await newPeer(undefined, o)
  const conn = peer.connect(peerIdFor(code), { reliable: true, serialization: 'raw' })
  const failed = new Promise<never>((_, reject) => peer.on('error', (e) => reject(new Error(relayError(e)))))
  await Promise.race([opened(conn), failed])
  return fromPeerJs(conn, peer)
}

// ---------- private (no relay) ----------

function fromDataChannel(dc: RTCDataChannel, pc: RTCPeerConnection): Channel {
  return {
    send: (t) => dc.send(t),
    onMessage: (fn) => dc.addEventListener('message', (e) => fn(String(e.data))),
    onClose: (fn) => dc.addEventListener('close', fn),
    close: () => {
      dc.close()
      pc.close()
    },
  }
}

/** Wait until the connection text lists every address, so it can travel in one piece. */
async function gathered(pc: RTCPeerConnection, ms = 5000): Promise<string> {
  if (pc.iceGatheringState !== 'complete') {
    await new Promise<void>((resolve) => {
      const done = () => pc.iceGatheringState === 'complete' && resolve()
      pc.addEventListener('icegatheringstatechange', done)
      setTimeout(resolve, ms)
    })
  }
  return JSON.stringify(pc.localDescription)
}

const channelOpen = (dc: RTCDataChannel) =>
  new Promise<void>((resolve, reject) => {
    if (dc.readyState === 'open') return resolve()
    dc.addEventListener('open', () => resolve())
    dc.addEventListener('error', () => reject(new Error('The connection could not be opened')))
  })

/** First device: make the connection text to send over; then give it the reply. */
export async function privateOffer(o: ConnectOptions = {}): Promise<{ offer: string; accept: (answer: string) => Promise<Channel>; cancel: () => void }> {
  const pc = new RTCPeerConnection({ iceServers: iceServers(o) })
  const dc = pc.createDataChannel('sync', { ordered: true })
  await pc.setLocalDescription(await pc.createOffer())
  return {
    offer: await gathered(pc),
    accept: async (answer) => {
      await pc.setRemoteDescription(parseDescription(answer, 'answer'))
      await channelOpen(dc)
      return fromDataChannel(dc, pc)
    },
    cancel: () => pc.close(),
  }
}

/** Second device: take the first device's text, make the reply to send back. */
export async function privateAnswer(offer: string, o: ConnectOptions = {}): Promise<{ answer: string; channel: Promise<Channel> }> {
  const pc = new RTCPeerConnection({ iceServers: iceServers(o) })
  const channel = new Promise<Channel>((resolve, reject) => {
    pc.addEventListener('datachannel', (e) => void channelOpen(e.channel).then(() => resolve(fromDataChannel(e.channel, pc)), reject))
  })
  await pc.setRemoteDescription(parseDescription(offer, 'offer'))
  await pc.setLocalDescription(await pc.createAnswer())
  return { answer: await gathered(pc), channel }
}

function parseDescription(text: string, type: 'offer' | 'answer'): RTCSessionDescriptionInit {
  try {
    const d = JSON.parse(text.trim()) as RTCSessionDescriptionInit
    if (d.type === type && typeof d.sdp === 'string') return d
  } catch {
    // fall through
  }
  throw new Error(type === 'offer' ? 'This is not a connection text from the other device' : 'This is not the reply from the other device')
}
