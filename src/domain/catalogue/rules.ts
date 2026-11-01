import type { Catalogue, Datasheet, Rule } from './types'

const low = (s: string) => s.toLowerCase().trim()

/** The rule a weapon keyword refers to: "Sustained Hits 1" → Sustained Hits, "Anti-Infantry 4+" → Anti-. */
export function ruleForKeyword(rules: Rule[], keyword: string): Rule | undefined {
  const k = low(keyword)
  const exact = rules.find((r) => low(r.name) === k || r.aliases?.some((a) => low(a) === k))
  if (exact) return exact
  return rules
    .filter((r) => r.kind === 'core' && k.startsWith(low(r.name)))
    .sort((a, b) => b.name.length - a.name.length)[0]
}

export type TextPart = { text: string; bold?: boolean }

/** Splits rule text into plain and bold parts; drops the ^^keyword^^ markers used in the data. */
export function formatRuleText(text: string): TextPart[] {
  const clean = text.replace(/\^\^/g, '')
  const parts: TextPart[] = []
  const re = /\*\*(.+?)\*\*/g
  let last = 0
  for (let m = re.exec(clean); m; m = re.exec(clean)) {
    if (m.index > last) parts.push({ text: clean.slice(last, m.index) })
    parts.push({ text: m[1], bold: true })
    last = m.index + m[0].length
  }
  if (last < clean.length) parts.push({ text: clean.slice(last) })
  return parts
}

/** Datasheets that use a rule: linked to it, an ability with its name, or a weapon keyword for it. */
export function datasheetsWithRule(cat: Catalogue, rule: Rule): Datasheet[] {
  const rules = cat.rules ?? []
  return cat.datasheets.filter(
    (d) =>
      d.ruleIds?.includes(rule.id) ||
      d.abilities.some((a) => low(a) === low(rule.name)) ||
      d.weaponKeywords?.some((k) => ruleForKeyword(rules, k)?.id === rule.id),
  )
}
