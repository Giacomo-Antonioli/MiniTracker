import { useRef, useState } from 'react'
import { blePair } from '../../data/syncBle'
import { canAdvertiseBle, connectToPhone, waitForPc } from '../../data/syncBleLinks'
import type { Channel } from '../../data/syncChannel'
import type { Device } from '../../data/syncDevice'
import { Dialog } from '../../ui/Dialog'
import { useTx, txr } from '../../i18n'

interface Props {
  me: Device
  busy: boolean
  /** A confirmed, open channel. The PC (which connected) starts the sync. */
  onChannel(ch: Channel, starts: boolean, other: Device): void
  onStatus(text: string): void
  onError(text: string): void
}

/** "Bluetooth" on the Sync page (#168 phase 4): the phone waits, the PC finds it; no network needed. */
export function BluetoothSync({ me, busy, onChannel, onStatus, onError }: Props) {
  const tx = useTx()
  const phone = canAdvertiseBle()
  const [working, setWorking] = useState(false)
  const [prompt, setPrompt] = useState<{ other: Device; code: string; resolve: (ok: boolean) => void }>()
  const cancel = useRef<() => void>(undefined)

  const run = async () => {
    setWorking(true)
    onStatus(phone ? txr('Waiting for a PC… open Sync › Bluetooth on the PC and choose Find a phone.') : txr('Looking for a phone…'))
    try {
      let link
      if (phone) {
        const w = waitForPc()
        cancel.current = w.cancel
        link = await w.link
      } else link = await connectToPhone()
      const { channel, other } = await blePair(link, !phone, { me, decide: (p) => new Promise((resolve) => setPrompt({ ...p, resolve })) })
      onChannel(channel, !phone, other)
    } catch (e) {
      onError(txr((e as Error).message))
    } finally {
      cancel.current = undefined
      setPrompt(undefined)
      setWorking(false)
    }
  }
  const answer = (ok: boolean) => {
    prompt?.resolve(ok)
    setPrompt(undefined)
  }

  return (
    <section className="panel grid gap-2 p-4" aria-label={tx('Bluetooth')}>
      <h2 className="font-display text-lg">🔵 {tx('Bluetooth')}</h2>
      <p className="text-sm text-muted">{tx('No network needed. The phone waits, the PC finds it. The first time, check that both screens show the same number.')}</p>
      <div className="flex gap-2">
        <button className="btn" disabled={busy || working} onClick={() => void run()}>{phone ? tx('Wait for a PC') : tx('Find a phone')}</button>
        {working && phone && <button className="btn" onClick={() => cancel.current?.()}>{tx('Stop waiting')}</button>}
      </div>
      {prompt && (
        <Dialog title={tx('Pair these devices over Bluetooth?')} onClose={() => answer(false)}>
          <div className="grid gap-2 text-sm">
            <p>{txr('Pairing with {{name}}. Check it shows the same number:', { name: prompt.other.deviceName })}</p>
            <p className="text-center font-mono text-4xl font-bold tracking-widest" aria-label={tx('Pairing number')}>{prompt.code.slice(0, 3)} {prompt.code.slice(3)}</p>
            <p className="text-xs text-muted">{tx('Different number? Cancel: another device may be in the middle.')}</p>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={() => answer(true)}>{tx('Same number: pair')}</button>
              <button className="btn" onClick={() => answer(false)}>{tx('Cancel')}</button>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  )
}
