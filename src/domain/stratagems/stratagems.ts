/** Stratagems and detachment rules imported from Wahapedia's CSV export (#98). */
export interface Stratagem {
  id: string
  name: string
  /** e.g. "Core – Battle Tactic Stratagem". */
  type: string
  cp: string
  turn: string
  phase: string
  /** Wahapedia detachment name; absent for core stratagems. */
  detachment?: string
  /** Rule text with **bold** markers and line breaks. */
  text: string
}

export interface DetachmentRule {
  id: string
  name: string
  detachment: string
  text: string
}

export interface StratagemData {
  importedAt: string
  stratagems: Stratagem[]
  detachmentRules: DetachmentRule[]
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }

/** Wahapedia's HTML rule text as plain text: <b> becomes **bold**, list items become bullets. */
export function htmlToText(html: string): string {
  return html
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/(p|ul|ol|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#?\w+);/g, (m, e: string) => ENTITIES[e] ?? m)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Rows of a Wahapedia CSV ('|' separated, each row ending in '|'), keyed by the header. */
function rows(text: string): Record<string, string>[] {
  const lines = text.replace(/^﻿/, '').split(/\|\r?\n/).filter((l) => l.trim())
  const head = lines[0].replace(/\|$/, '').split('|')
  return lines.slice(1).map((l) => Object.fromEntries(l.replace(/\|$/, '').split('|').map((v, i) => [head[i], v])))
}

/** Read Stratagems.csv and Detachment_abilities.csv (either or both), told apart by their header. */
export function parseWahapedia(files: string[], now: string): StratagemData {
  const data: StratagemData = { importedAt: now, stratagems: [], detachmentRules: [] }
  for (const f of files) {
    const head = f.replace(/^﻿/, '').split('\n')[0]
    if (head.startsWith('faction_id|name|id|type|cp_cost')) {
      const seen = new Set<string>()
      const all = rows(f)
      // The export has an older core set ("Core – Battle Tactic Stratagem") next to the current one
      // ("Core Stratagem"): keep the current one when it is there, each stratagem once.
      const coreType = all.some((r) => !r.detachment && r.type.startsWith('Core Stratagem')) ? 'Core Stratagem' : 'Core'
      for (const r of all) {
        if (r.type.startsWith('Boarding Actions') || r.type.startsWith('Challenger')) continue
        const core = !r.detachment
        if (core && (!r.type.startsWith(coreType) || seen.has(r.name))) continue
        if (core) seen.add(r.name)
        data.stratagems.push({ id: r.id, name: r.name, type: r.type, cp: r.cp_cost, turn: r.turn, phase: r.phase, ...(core ? {} : { detachment: r.detachment }), text: htmlToText(r.description) })
      }
    } else if (head.startsWith('id|faction_id|name|legend|description|detachment')) {
      data.detachmentRules = rows(f).map((r) => ({ id: r.id, name: r.name, detachment: r.detachment, text: htmlToText(r.description) }))
    } else {
      throw new Error('This is not a Wahapedia stratagems or detachment abilities file')
    }
  }
  return data
}

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

/** Wahapedia detachment names, to pick one when a name does not match. */
export function detachmentNames(data: StratagemData): string[] {
  return [...new Set(data.stratagems.map((s) => s.detachment).filter((x): x is string => !!x))].sort()
}

/**
 * Core stratagems, plus for each of the list's detachments its rules and stratagems, matched by name
 * or by a name chosen earlier (`chosen`: list detachment name → Wahapedia name).
 */
export function stratagemsFor(names: string[], data: StratagemData, chosen: Record<string, string> = {}) {
  const all = detachmentNames(data)
  return {
    core: data.stratagems.filter((s) => !s.detachment),
    detachments: names.map((name) => {
      const matched = chosen[name] ?? all.find((x) => key(x) === key(name))
      return {
        name,
        matched,
        rules: matched ? data.detachmentRules.filter((r) => r.detachment === matched) : [],
        stratagems: matched ? data.stratagems.filter((s) => s.detachment === matched) : [],
      }
    }),
  }
}
