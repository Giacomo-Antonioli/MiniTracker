import type { Datasheet } from './types'

/** Points for a unit of `models` models. Throws if the size is not allowed. */
export function pointsFor(d: Datasheet, models: number): number {
  if (!Number.isInteger(models) || models < d.minModels || models > d.maxModels) {
    throw new RangeError(`${d.name} must have ${d.minModels}–${d.maxModels} models`)
  }
  let pts = d.points[0].points
  for (const s of d.points) if (models >= s.fromModels) pts = s.points
  return pts
}
