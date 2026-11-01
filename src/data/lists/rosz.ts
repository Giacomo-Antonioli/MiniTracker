import { XMLParser } from 'fast-xml-parser'
import { strFromU8, unzipSync } from 'fflate'
import type { Roster, RosterSelection } from '../../domain/lists/io'

/** Reads a BattleScribe / NewRecruit roster: .rosz (zipped) or .ros (XML). */
export function readRoster(bytes: Uint8Array): Roster {
  let xml: string
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const files = unzipSync(bytes)
    const ros = Object.keys(files).find((n) => n.toLowerCase().endsWith('.ros')) ?? Object.keys(files)[0]
    if (!ros) throw new Error('This .rosz file is empty')
    xml = strFromU8(files[ros])
  } else xml = strFromU8(bytes)
  return parseRosterXml(xml)
}

type Node = Record<string, unknown>
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', isArray: (_n, _p, _l, isAttr) => !isAttr })
const kids = (n: Node, container: string, tag: string): Node[] => ((n[container] as Node[] | undefined)?.[0]?.[tag] as Node[] | undefined) ?? []
const str = (n: Node, k: string) => (typeof n[k] === 'string' ? (n[k] as string) : undefined)

function selection(n: Node): RosterSelection {
  const ids = [...(str(n, 'entryId') ?? '').split('::'), ...(str(n, 'entryGroupId') ?? '').split('::')].filter(Boolean)
  return {
    ids,
    name: str(n, 'name') ?? '',
    type: str(n, 'type'),
    number: Number(str(n, 'number') ?? 1) || 1,
    children: kids(n, 'selections', 'selection').map(selection),
  }
}

export function parseRosterXml(xml: string): Roster {
  let doc: Node
  try {
    doc = parser.parse(xml) as Node
  } catch {
    throw new Error('This is not a BattleScribe roster')
  }
  const roster = (doc.roster as Node[] | undefined)?.[0]
  if (!roster) throw new Error('This is not a BattleScribe roster')
  return {
    name: str(roster, 'name') ?? '',
    forces: kids(roster, 'forces', 'force').map((f) => ({
      catalogueId: str(f, 'catalogueId'),
      catalogueName: str(f, 'catalogueName'),
      selections: kids(f, 'selections', 'selection').map(selection),
    })),
  }
}
