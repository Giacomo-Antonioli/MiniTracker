import type { Catalogue, CatalogueSource, Datasheet, Faction, PointsStep, Rule, StatLine } from '../../domain/catalogue/types'
import type { SourceFile } from './bsdata'

/**
 * Converts the Middle-earth data of the community MESBG list builder (mhollink/mesbg-list-builder-v2024, #99) into a
 * Catalogue. The browser downloads the three JSON files from GitHub at a fixed commit; MiniTracker ships none of them.
 */

interface Option {
  id: string
  name: string
  points: number
}
interface Unit {
  model_id: string
  army_type: string
  army_list: string
  profile_origin: string
  name: string
  unit_type: string
  base_points: number
  MWFW: [string, string][]
  options: Option[]
  unique?: boolean
  legacy?: boolean
}
interface Profile {
  [stat: string]: unknown
  active_or_passive_rules?: { name: string; type?: string; description: string }[]
  magic_powers?: { name: string; range?: string; cast?: string }[]
  heroic_actions?: string[]
  special_rules?: string[]
  wargear?: string[]
}
interface ArmyList {
  special_rules?: { title: string; description: string }[]
  additional_rules?: { description: string }[]
}

const STATS = ['Mv', 'Fv', 'Sv', 'S', 'D', 'A', 'W', 'C', 'I'] as const
/** Most warriors of one kind in a list entry (a warband rarely holds more). */
const MAX_WARRIORS = 30

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** JSON with an optional byte-order mark (profile_data.json has one). */
function readJson<T>(files: SourceFile[], name: string): T {
  const f = files.find((x) => x.name.endsWith(name))
  if (!f) throw new Error(`Missing ${name} in the Middle-earth data`)
  return JSON.parse(f.text.replace(/^﻿/, '')) as T
}

const isHero = (u: Unit) => u.unit_type !== 'Warrior' && u.unit_type !== 'Siege Engine'

export function parseMesbg(files: SourceFile[], source: CatalogueSource): Catalogue {
  const units = Object.values(readJson<Record<string, Unit>>(files, 'mesbg_data.json'))
  const profiles = readJson<Record<string, Record<string, Profile>>>(files, 'profile_data.json')
  const armies = readJson<Record<string, ArmyList>>(files, 'army_list_data.json')

  const factions = new Map<string, Faction>()
  const rules: Rule[] = []
  for (const u of units) {
    const id = slug(u.army_list)
    if (factions.has(id)) continue
    factions.set(id, { id, name: u.army_list, fullName: `${u.army_type} - ${u.profile_origin} - ${u.army_list}` })
    const a = armies[u.army_list]
    a?.special_rules?.forEach((r, i) => rules.push({ id: `${id}/rule-${i}`, name: r.title, text: r.description, kind: 'faction', factionId: id }))
    a?.additional_rules?.forEach((r, i) => rules.push({ id: `${id}/army-${i}`, name: 'Army composition', text: r.description, kind: 'faction', factionId: id }))
  }

  const datasheets: Datasheet[] = units.map((u) => {
    const p = profiles[u.profile_origin]?.[u.name]
    const hero = isHero(u)
    const maxModels = hero || u.unique ? 1 : MAX_WARRIORS
    const points: PointsStep[] = []
    for (let n = 1; n <= maxModels; n++) points.push({ fromModels: n, points: n * u.base_points })

    const abilityTexts: Record<string, string> = {}
    for (const r of p?.active_or_passive_rules ?? []) abilityTexts[r.name] = r.type ? `${r.type}: ${r.description}` : r.description
    for (const m of p?.magic_powers ?? []) abilityTexts[`Magic: ${m.name}`] = [m.range && `Range ${m.range}`, m.cast && `Cast ${m.cast}`].filter(Boolean).join(', ')
    const abilities = [...Object.keys(abilityTexts), ...(p?.special_rules ?? []), ...(p?.heroic_actions ?? []).map((h) => `Heroic action: ${h}`)]

    const values: [string, string][] = p ? STATS.filter((s) => p[s] !== undefined).map((s) => [s, String(p[s])]) : []
    const mwfw = u.MWFW?.[0]?.[1]
    if (mwfw) values.push(['M:W:F:W', mwfw])
    const stats: StatLine[] = values.length ? [{ name: u.name, values }] : []

    const wargear = [...(p?.wargear ?? []), ...u.options.map((o) => `${o.name} (+${o.points} pts)`)]
    return {
      id: u.model_id,
      name: u.name,
      factionIds: [slug(u.army_list)],
      role: u.unit_type,
      keywords: [u.unit_type, u.army_type, ...(hero ? ['Hero'] : [])],
      factionKeywords: [u.army_list],
      minModels: 1,
      maxModels,
      points,
      wargear,
      abilities,
      legends: !!u.legacy,
      ...(Object.keys(abilityTexts).length ? { abilityTexts } : {}),
      ...(stats.length ? { stats } : {}),
      ...(u.unique ? { armyLimit: { max: 1 } } : {}),
    }
  })

  return {
    formatVersion: 7,
    gameId: 'mesbg-2024',
    gameName: 'Middle-earth Strategy Battle Game',
    source,
    factions: [...factions.values()].sort((a, b) => a.name.localeCompare(b.name)),
    datasheets,
    rules,
  }
}
