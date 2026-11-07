import { editionOfRepo } from '../../domain/catalogue/editions'
import type { Catalogue, CatalogueSource } from '../../domain/catalogue/types'
import { parseBsData, type SourceFile } from './bsdata'
import { parseMesbg } from './mesbg'

/** Picks the converter for the source: the MESBG list builder's JSON (#99) or BattleScribe data. */
export function parseCatalogue(files: SourceFile[], source: CatalogueSource): Catalogue {
  const format = (editionOfRepo(source.repo) as { format?: string } | undefined)?.format
  return format === 'mesbg' ? parseMesbg(files, source) : parseBsData(files, source)
}
