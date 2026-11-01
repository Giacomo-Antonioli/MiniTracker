/**
 * BSData's newer repositories (e.g. wh40k-11e) publish the BattleScribe format as JSON instead of XML.
 * Same structure, different encoding: containers are plain arrays, values are real booleans/numbers and
 * element text sits under "$text". This converts it to the shape the XML parser produces, so one parser
 * reads both.
 */

type XmlLike = Record<string, unknown>

/** "sharedSelectionEntries" → "selectionEntry", "costs" → "cost", "conditionGroups" → "conditionGroup". */
export function tagFor(container: string): string {
  const base = container.replace(/^shared(?=[A-Z])/, '')
  const lower = base.charAt(0).toLowerCase() + base.slice(1)
  return lower.endsWith('ies') ? lower.slice(0, -3) + 'y' : lower.endsWith('s') ? lower.slice(0, -1) : lower
}

function convert(node: Record<string, unknown>): XmlLike {
  const out: XmlLike = {}
  for (const [key, value] of Object.entries(node)) {
    if (key === '$text') out['#text'] = String(value)
    else if (Array.isArray(value)) {
      if (value.every((v) => typeof v === 'object' && v !== null)) out[key] = [{ [tagFor(key)]: value.map((v) => convert(v as Record<string, unknown>)) }]
      else out[key] = value.map(String) // e.g. alias: ["PISTOL"]
    } else if (value && typeof value === 'object') out[key] = [convert(value as Record<string, unknown>)]
    else if (key === 'description' || key === 'readme' || key === 'comment') out[key] = [String(value)]
    else out[key] = String(value)
  }
  return out
}

/** Parse a BSData JSON file into the XML-parser shape: { gameSystem: [node] } or { catalogue: [node] }. */
export function parseBsDataJson(text: string): Record<string, XmlLike[]> {
  const raw = JSON.parse(text) as Record<string, Record<string, unknown>>
  const rootKey = 'gameSystem' in raw ? 'gameSystem' : 'catalogue' in raw ? 'catalogue' : null
  if (!rootKey) throw new Error('Not a BattleScribe game system or catalogue')
  return { [rootKey]: [convert(raw[rootKey])] }
}
