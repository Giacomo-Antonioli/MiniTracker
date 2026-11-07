// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { appDb, ctx, useStore } from '../../app/store'
import { createUnit } from '../../domain/collection/ownedUnit'
import { endDemo, startDemo } from './demo'

describe('guided tour demo (#168)', () => {
  it('runs on its own database: what the tour saves never reaches the user\'s, and their state comes back', async () => {
    await useStore.getState().load()
    const mine = createUnit({ customName: 'My own unit', groups: [{ count: 3, status: 'built' }] }, ctx())
    await useStore.getState().saveUnit(mine)
    expect(useStore.getState().units.map((u) => u.customName)).toEqual(['My own unit'])

    await startDemo()
    expect(useStore.getState().units.map((u) => u.customName)).toContain('Intercessor Squad')
    expect(useStore.getState().units.map((u) => u.customName)).not.toContain('My own unit')
    // A real save during the tour (the "add a unit" mock) works…
    await useStore.getState().saveUnit(createUnit({ customName: 'Hellblaster Squad', groups: [{ count: 5, status: 'built' }] }, ctx()))
    expect(useStore.getState().units.map((u) => u.customName)).toContain('Hellblaster Squad')

    endDemo()
    // …but only in the demo database.
    expect(useStore.getState().units.map((u) => u.customName)).toEqual(['My own unit'])
    expect((await appDb.units.toArray()).map((u) => u.customName)).toEqual(['My own unit'])
    await useStore.getState().load()
    expect(useStore.getState().units.map((u) => u.customName)).toEqual(['My own unit'])
  })
})
