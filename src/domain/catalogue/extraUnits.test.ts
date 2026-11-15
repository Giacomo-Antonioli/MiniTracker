import { expect, it } from 'vitest'
import { matchExtraUnits } from './extraUnits'

it('offers the Tau drones, hides names the catalogue already has, respects the faction', () => {
  expect(matchExtraUnits('drone', '', []).map((e) => e.name)).toHaveLength(6)
  expect(matchExtraUnits('shield', "T'au Empire", []).map((e) => e.name)).toEqual(['Shield Drone'])
  expect(matchExtraUnits('shield', '', ['Shield Drone'])).toEqual([])
  expect(matchExtraUnits('drone', 'Ultramarines', [])).toEqual([])
})
