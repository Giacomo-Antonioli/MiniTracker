import type { StageId, StatusEvent } from '../collection/types'
import type { Photo } from './types'

/**
 * A unit's photos oldest first, each with the stage it shows (#96): the stage of the history step it
 * was taken for, otherwise the last stage reached by the day it was taken (undefined before any move).
 */
export function photoTimeline(photos: Photo[], events: StatusEvent[]): { photo: Photo; stageId?: StageId }[] {
  const byId = new Map(events.map((e) => [e.id, e]))
  const moves = [...events].filter((e) => e.direction === 'forward').sort((a, b) => a.date.localeCompare(b.date))
  return [...photos]
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt))
    .map((photo) => {
      const own = photo.owner.kind === 'event' ? byId.get(photo.owner.eventId) : undefined
      const day = photo.takenAt.slice(0, 10)
      return { photo, stageId: own?.to ?? moves.filter((e) => e.date.slice(0, 10) <= day).at(-1)?.to }
    })
}
