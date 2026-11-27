import { describe, expect, it } from 'vitest'
import type { Datasheet, Gear, UpgradeSection } from '../catalogue/types'
import { applyUpgrades, gainedRules, gearWeapons, sectionLimits, upgradePoints } from './upgrades'

const w = (name: string, count = 1): Gear => ({ name, count, weapon: { name, kind: 'melee', values: [['A', '1']] } })
const section = (id: string, over: Partial<UpgradeSection>, ...options: [string, number, Gear[]][]): UpgradeSection => ({
  id, label: id, variant: 'replace', targets: [], options: options.map(([oid, points, gains]) => ({ id: oid, label: oid, points, gains })), ...over,
})
const unit = (size: number, gear: Gear[], ...upgrades: UpgradeSection[]) => ({ name: 'Unit', minModels: size, maxModels: size, abilities: ['Tough(3)'], gear, upgrades }) as unknown as Datasheet
const summary = (d: Datasheet, picks: Record<string, number>) => {
  const r = applyUpgrades(d, picks)
  return { gear: r.gear.map((g) => `${g.count}x ${g.name}`).sort(), problems: r.problems }
}

describe('applyUpgrades', () => {
  const squad = unit(
    5,
    [w('Rifle', 5), w('Knife', 5)],
    section('all', { targets: ['Rifles', 'Knives'], affects: { type: 'all' } }, ['spit', 15, [w('Spitter'), w('Claws')]]),
    section('any', { targets: ['Rifle'], affects: { type: 'any' } }, ['flamer', 10, [w('Flamer')]], ['saw', 5, [w('Saw')]]),
    section('banner', { variant: 'upgrade', affects: { type: 'exactly', value: 1 }, select: { type: 'exactly', value: 1 } }, ['a', 5, [{ name: 'Banner', count: 1, rules: ['Fear'] }]], ['b', 5, [{ name: 'Drum', count: 1, rules: ['Tough(3)'] }]]),
    section('wings', { variant: 'upgrade', affects: { type: 'all' } }, ['wings', 20, [{ name: 'Wings', count: 1, rules: ['Flying'] }]]),
  )

  it('replaces every copy with one pick, matching plural targets', () => {
    expect(summary(squad, { 'all/spit': 1 })).toEqual({ gear: ['5x Claws', '5x Spitter'], problems: [] })
  })

  it('replaces as many weapons as picked and reports too many', () => {
    expect(summary(squad, { 'any/flamer': 2, 'any/saw': 1 })).toEqual({ gear: ['1x Saw', '2x Flamer', '2x Rifle', '5x Knife'], problems: [] })
    expect(applyUpgrades(squad, { 'any/flamer': 4, 'any/saw': 2 }).problems).toHaveLength(1)
  })

  it('gives an upgrade for all models to each of them, with its rules', () => {
    const { gear } = applyUpgrades(squad, { 'wings/wings': 1 })
    expect(gear.find((g) => g.name === 'Wings')!.count).toBe(5)
    expect(gainedRules(squad, gear)).toEqual(['Flying'])
  })

  it('enforces section limits and unknown picks', () => {
    expect(applyUpgrades(squad, { 'banner/a': 1, 'banner/b': 1 }).problems).toEqual(['Unit: "banner" allows 1, 2 taken'])
    expect(applyUpgrades(squad, { 'gone/x': 1 }).problems).toEqual(['Unit: an upgrade is no longer in the catalogue'])
  })

  it('sums the points of what was taken', () => {
    expect(upgradePoints(squad, { upgrades: { 'all/spit': 1, 'any/flamer': 2 } })).toBe(35)
    expect(upgradePoints(squad, {})).toBe(0)
  })

  it('applies upgrades that depend on each other in any section order', () => {
    const d = unit(1, [w('Sword')], section('second', { targets: ['Axe'] }, ['bow', 5, [w('Bow')]]), section('first', { targets: ['Sword'] }, ['axe', 5, [w('Axe')]]))
    expect(summary(d, { 'second/bow': 1, 'first/axe': 1 })).toEqual({ gear: ['1x Bow'], problems: [] })
    expect(applyUpgrades(d, { 'second/bow': 1 }).problems).toEqual(['Unit: "bow" needs Axe'])
  })

  it('handles counted targets and weapons inside items', () => {
    const lord = unit(1, [w('Claws', 4), { name: 'Bike', count: 1, contains: [{ weapon: w('Scythes').weapon!, count: 1 }] }],
      section('c', { targets: ['4x Claws'] }, ['club', 5, [w('Claws', 2), w('Club')]]),
      section('s', { targets: ['Scythe'] }, ['rocket', 5, [w('Rocket')]]))
    const r = applyUpgrades(lord, { 'c/club': 1, 's/rocket': 1 })
    expect(r.problems).toEqual([])
    expect(gearWeapons(r.gear).map((x) => `${x.values[0][1]}x ${x.name}`).sort()).toEqual(['1x Club', '1x Rocket', '2x Claws'])
    // The datasheet itself is untouched.
    expect(lord.gear![1].contains).toHaveLength(1)
  })
})

describe('sectionLimits', () => {
  const s = (over: Partial<UpgradeSection>) => section('x', { variant: 'upgrade', ...over })
  it('reads the published wording', () => {
    expect(sectionLimits(s({ select: { type: 'exactly', value: 1 } }), 1)).toEqual({ perOption: 1, total: 1 })
    expect(sectionLimits(s({ affects: { type: 'upTo', value: 3 }, select: { type: 'exactly', value: 1 } }), 10)).toEqual({ perOption: 3, total: 3 })
    expect(sectionLimits(s({ select: { type: 'any' } }), 1)).toEqual({ perOption: 1, total: Infinity })
    expect(sectionLimits(s({ affects: { type: 'any' } }), 5)).toEqual({ perOption: 5, total: Infinity })
    expect(sectionLimits(s({ variant: 'replace', affects: { type: 'upTo', value: 2 } }), 10)).toEqual({ perOption: 2, total: 2 })
  })
})
