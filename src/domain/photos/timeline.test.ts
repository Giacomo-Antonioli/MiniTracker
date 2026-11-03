import { describe, expect, it } from 'vitest'
import type { StatusEvent } from '../collection/types'
import type { Photo } from './types'
import { photoTimeline } from './timeline'

const photo = (id: string, takenAt: string, owner: Photo['owner'] = { kind: 'unit', unitId: 'u' }) => ({ id, takenAt, owner }) as Photo
const ev = (id: string, date: string, to: string): StatusEvent => ({ id, unitId: 'u', groupId: 'g', from: 'x', to, count: 1, date, direction: 'forward', note: '' })

describe('photoTimeline', () => {
  it('orders photos by date with the stage each shows: its history step, else the last stage reached by then', () => {
    const events = [ev('e1', '2026-01-10', 'built'), ev('e2', '2026-02-10', 'primed'), ev('e3', '2026-03-10', 'painted')]
    const rows = photoTimeline(
      [photo('late', '2026-03-20'), photo('step', '2026-02-11', { kind: 'event', unitId: 'u', eventId: 'e3' }), photo('first', '2026-01-01'), photo('mid', '2026-02-15')],
      events,
    )
    expect(rows.map((r) => [r.photo.id, r.stageId])).toEqual([['first', undefined], ['step', 'painted'], ['mid', 'primed'], ['late', 'painted']])
  })
})
