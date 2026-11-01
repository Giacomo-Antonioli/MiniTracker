import { describe, expect, it } from 'vitest'
import { datasheetsWithRule, formatRuleText, ruleForKeyword } from './rules'
import type { Catalogue, Datasheet, Rule } from './types'

const rules: Rule[] = [
  { id: 'a', name: 'Assault', text: 't', kind: 'core', aliases: ['ASSAULT'] },
  { id: 's', name: 'Sustained Hits', text: 't', kind: 'core' },
  { id: 'anti', name: 'Anti-', text: 't', kind: 'core' },
  { id: 'm', name: 'Melta', text: 't', kind: 'core' },
  { id: 'f', name: 'For the Greater Good', text: 't', kind: 'faction' },
]

describe('ruleForKeyword', () => {
  it.each([
    ['Assault', 'a'],
    ['ASSAULT', 'a'],
    ['Sustained Hits 1', 's'],
    ['Anti-Infantry 4+', 'anti'],
    ['Melta 2', 'm'],
    ['Lethal Hits', undefined],
  ])('%s → %s', (k, id) => expect(ruleForKeyword(rules, k)?.id).toBe(id))
})

describe('formatRuleText', () => {
  it('turns **x** into bold parts and drops ^^ markers', () => {
    expect(formatRuleText('Each ^^**Infantry**^^ model gets **+1** to hit.')).toEqual([
      { text: 'Each ' },
      { text: 'Infantry', bold: true },
      { text: ' model gets ' },
      { text: '+1', bold: true },
      { text: ' to hit.' },
    ])
    expect(formatRuleText('plain')).toEqual([{ text: 'plain' }])
  })
})

describe('datasheetsWithRule', () => {
  const d = (name: string, extra: Partial<Datasheet>): Datasheet =>
    ({ id: name, name, factionIds: [], keywords: [], factionKeywords: [], minModels: 1, maxModels: 1, points: [], wargear: [], abilities: [], legends: false, ...extra }) as Datasheet
  const cat = {
    rules,
    datasheets: [d('A', { ruleIds: ['f'] }), d('B', { weaponKeywords: ['Sustained Hits 2'] }), d('C', { abilities: ['For the Greater Good'] }), d('D', {})],
  } as unknown as Catalogue
  it('finds units by rule link, weapon keyword or ability name', () => {
    expect(datasheetsWithRule(cat, rules[4]).map((x) => x.name)).toEqual(['A', 'C'])
    expect(datasheetsWithRule(cat, rules[1]).map((x) => x.name)).toEqual(['B'])
  })
})
