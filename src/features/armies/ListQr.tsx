import { useCallback } from 'react'
import { ctx } from '../../app/store'
import { packText, unpackText } from '../../data/syncCarousel'
import { listFromJson, listToJson } from '../../domain/lists/io'
import type { ArmyList } from '../../domain/lists/types'
import { QrLoop, QrRead } from '../sync/QrCarousel'

/** Shows an army list as a QR carousel, for the opponent's device to read (#193). */
export function ListQrSend({ list, onClose }: { list: ArmyList; onClose: () => void }) {
  const pack = useCallback(() => packText(listToJson(list)), [list])
  return <QrLoop title={`QR: ${list.name}`} intro="On the other device: Games › New game › 📷 Read QR, and point its camera at this screen until it has every frame." pack={pack} onClose={onClose} />
}

/** Reads an army list from another device's QR carousel. */
export function ListQrRead({ onList, onClose }: { onList: (l: ArmyList) => void; onClose: () => void }) {
  return <QrRead title="Read a list by QR" hint="On the other device open the list › ⬇ Export › 📱 Show as QR." read={async (t) => onList(listFromJson(await unpackText(t), ctx()).list)} onClose={onClose} />
}
