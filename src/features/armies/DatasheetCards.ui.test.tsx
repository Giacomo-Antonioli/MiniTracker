// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Datasheet } from '../../domain/catalogue/types'
import { DatasheetCards, KeywordLegend } from './DatasheetCards'

describe('DatasheetCards', () => {
  it('prints stats per model, weapon tables, rules, abilities with bold text, and enhancements', () => {
    const d = {
      id: 'x', name: 'Squad', keywords: ['Infantry'], factionKeywords: [],
      stats: [{ name: 'Sergeant', values: [['M', '6"']] }, { name: 'Trooper', values: [['M', '5"']] }],
    } as unknown as Datasheet
    const w = (name: string, kind: 'ranged' | 'melee') => ({ name, kind, values: [['A', '2'], ['Keywords', 'Assault']] as [string, string][] })
    render(<DatasheetCards cards={[{ datasheet: d, entries: [{ models: 5, enhancement: { name: 'Charm', points: 15 } }], weapons: [w('Rifle', 'ranged'), w('Knife', 'melee')], rules: ['Deep Strike'], abilities: [{ name: 'Hold', text: 'Stay **put**.' }, { name: 'Odd' }] }]} />)
    const card = screen.getByLabelText('Squad card')
    expect(card).toHaveTextContent('15 pts')
    expect(card).toHaveTextContent('5 models, Charm (+15)')
    expect(card).toHaveTextContent('Sergeant6"')
    expect(within(card).getAllByRole('table')).toHaveLength(4)
    expect(card).toHaveTextContent('Ranged weaponsAKeywordsRifle2Assault')
    expect(card).toHaveTextContent('Core: Deep Strike')
    expect(within(card).getByText('put').tagName).toBe('B')
    expect(card).not.toHaveTextContent('Faction:')
  })

  it('prints a legend of the rules behind the keywords, and nothing when there are none', () => {
    const { container } = render(<KeywordLegend rules={[]} />)
    expect(container).toBeEmptyDOMElement()
    render(<KeywordLegend rules={[{ id: 'a', name: 'Assault', text: 'Can shoot after **Advancing**, ^^Infantry^^ too.', kind: 'core' }]} />)
    const legend = screen.getByLabelText('Keyword legend')
    expect(legend).toHaveTextContent('Rules and keywordsAssaultCan shoot after Advancing, Infantry too.')
    expect(within(legend).getByText('Advancing').tagName).toBe('B')
  })
})
