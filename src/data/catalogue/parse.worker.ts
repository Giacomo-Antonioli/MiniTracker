/// <reference lib="webworker" />
import type { CatalogueSource } from '../../domain/catalogue/types'
import { parseBsData, type SourceFile } from './bsdata'

// Converts BSData files off the main thread so the page stays responsive.
self.onmessage = (e: MessageEvent<{ files: SourceFile[]; source: CatalogueSource }>) => {
  try {
    self.postMessage({ ok: true, catalogue: parseBsData(e.data.files, e.data.source) })
  } catch (err) {
    self.postMessage({ ok: false, error: (err as Error).message })
  }
}
