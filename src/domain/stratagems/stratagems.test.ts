import { describe, expect, it } from 'vitest'
import { detachmentNames, htmlToText, parseWahapedia, stratagemsFor } from './stratagems'

const S = [
  '﻿faction_id|name|id|type|cp_cost|legend|turn|phase|detachment|detachment_id|description|',
  '|COMMAND RE-ROLL|1|Core – Battle Tactic Stratagem|1|Fluff.|Either player’s turn|Any phase|||<b>WHEN:</b> Any phase.<br><br><b>EFFECT:</b> Re-roll it.|',
  '|SMOKESCREEN|2|Core – Wargear Stratagem|1||Opponent’s turn|Shooting phase|||<b>WHEN:</b> Shooting.|',
  '|SMOKESCREEN|3|Core Stratagem|1||Opponent’s turn|Shooting phase|||Old copy.|',
  '|EXPLOSIVE CLEARANCE|4|Boarding Actions – Battle Tactic Stratagem|1||Your turn|Shooting phase|||Boarding.|',
  'SM|ARMOUR OF CONTEMPT|5|Gladius Task Force – Battle Tactic Stratagem|1||Either player’s turn|Shooting or Fight phase|Gladius Task Force|d1|<b>TARGET:</b> One <span class="kwb">ADEPTUS</span> unit &amp; more:<ul><li>First</li><li>Second</li></ul>|',
  'SM|HONOUR THE CHAPTER|6|Gladius Task Force – Battle Tactic Stratagem|2||Your turn|Fight phase|Gladius Task Force|d1|Fight!|',
  'SM|OTHER|7|Firestorm – Strategic Ploy Stratagem|1||Your turn|Movement phase|Firestorm Assault Force|d2|Move.|',
].join('\n')
const D = ['﻿id|faction_id|name|legend|description|detachment|detachment_id|', 'a1|SM|Combat Doctrines|Fluff|<p>Pick a doctrine.</p>|Gladius Task Force|d1|'].join('\n')

describe('Wahapedia import', () => {
  it('turns the HTML rule text into plain text with **bold** and bullets', () => {
    expect(htmlToText('<b>WHEN:</b> Now.<br><br>One <span class="kwb">UNIT</span> &amp; x &lt;3&gt;:<ul><li>A</li><li>B</li></ul><p>End&nbsp;it.</p>')).toBe('**WHEN:** Now.\n\nOne UNIT & x <3>:\n• A\n• B\nEnd it.')
  })

  it('reads stratagems and detachment rules by their header, skipping Boarding Actions and repeated core ones', () => {
    const data = parseWahapedia([S, D], 'now')
    expect(data.importedAt).toBe('now')
    expect(data.stratagems.map((s) => s.name)).toEqual(['SMOKESCREEN', 'ARMOUR OF CONTEMPT', 'HONOUR THE CHAPTER', 'OTHER'])
    expect(parseWahapedia([S.replace('|SMOKESCREEN|3|Core Stratagem|', '|SMOKESCREEN|3|Core – Old|')], 'x').stratagems[0]).toEqual({ id: '1', name: 'COMMAND RE-ROLL', type: 'Core – Battle Tactic Stratagem', cp: '1', turn: 'Either player’s turn', phase: 'Any phase', text: '**WHEN:** Any phase.\n\n**EFFECT:** Re-roll it.' })
    expect(data.stratagems[1]).toMatchObject({ detachment: 'Gladius Task Force', text: '**TARGET:** One ADEPTUS unit & more:\n• First\n• Second' })
    expect(data.detachmentRules).toEqual([{ id: 'a1', name: 'Combat Doctrines', detachment: 'Gladius Task Force', text: 'Pick a doctrine.' }])
    expect(parseWahapedia([D], 'x').stratagems).toEqual([])
    // With the current core set ("Core Stratagem") present, the older one is left out.
    const both = S + '\n|EXPLOSIVES|8|Core Stratagem|1||Your turn|Shooting phase|||Boom.|'
    expect(parseWahapedia([both], 'x').stratagems.filter((s) => !s.detachment).map((s) => [s.name, s.text])).toEqual([['SMOKESCREEN', 'Old copy.'], ['EXPLOSIVES', 'Boom.']])
    expect(() => parseWahapedia(['a|b|\n1|2|'], 'x')).toThrow(/not a Wahapedia/)
  })
})

describe('stratagems for a list', () => {
  const data = parseWahapedia([S, D], 'now')
  it('matches detachments by name (ignoring case and punctuation), or by a chosen name; adds the core ones', () => {
    const r = stratagemsFor(['Gladius task-force'], data)
    expect(r.core.map((s) => s.name)).toEqual(['SMOKESCREEN'])
    expect(r.detachments).toEqual([{ name: 'Gladius task-force', matched: 'Gladius Task Force', rules: data.detachmentRules, stratagems: [data.stratagems[1], data.stratagems[2]] }])
    expect(stratagemsFor(['Firestorm'], data).detachments[0]).toMatchObject({ matched: undefined, stratagems: [] })
    expect(stratagemsFor(['Firestorm'], data, { Firestorm: 'Firestorm Assault Force' }).detachments[0].stratagems.map((s) => s.name)).toEqual(['OTHER'])
  })

  it('lists the detachment names to choose from', () => {
    expect(detachmentNames(data)).toEqual(['Firestorm Assault Force', 'Gladius Task Force'])
  })
})
