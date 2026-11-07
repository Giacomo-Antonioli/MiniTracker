/// <reference lib="webworker" />
import type { CatalogueSource } from '../../domain/catalogue/types'
import type { SourceFile } from './bsdata'
import { parseCatalogue } from './parse'

// Converts BSData files off the main thread so the page stays responsive.
self.onmessage = (e: MessageEvent<{ files: SourceFile[]; source: CatalogueSource }>) => {
  try {
    self.postMessage({ ok: true, catalogue: parseCatalogue(e.data.files, e.data.source) })
  } catch (err) {
    self.postMessage({ ok: false, error: (err as Error).message })
  }
}
