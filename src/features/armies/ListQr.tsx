import { useCallback } from 'react'
import { ctx } from '../../app/store'
import { packText, unpackText } from '../../data/syncCarousel'
import { listFromJson, listToJson } from '../../domain/lists/io'
import type { ArmyList } from '../../domain/lists/types'
import { QrLoop, QrRead } from '../sync/QrCarousel'
import { useTx } from '../../i18n'

/** Shows an army list as a QR carousel, for the opponent's device to read (#193). */
export function ListQrSend({ list, onClose }: { list: ArmyList; onClose: () => void }) {
  const tx = useTx()
  const pack = useCallback(() => packText(listToJson(list)), [list])
  return <QrLoop title={tx('QR: {{name}}', { name: list.name })} intro={tx('On the other device: Games › New game › 📷 Read QR, and point its camera at this screen until it has every frame.')} pack={pack} onClose={onClose} />
}

/** Reads an army list from another device's QR carousel. */
export function ListQrRead({ onList, onClose }: { onList: (l: ArmyList) => void; onClose: () => void }) {
  const tx = useTx()
  return <QrRead title={tx('Read a list by QR')} hint={tx('On the other device open the list › ⬇ Export › 📱 Show as QR.')} read={async (t) => onList(listFromJson(await unpackText(t), ctx()).list)} onClose={onClose} />
}
