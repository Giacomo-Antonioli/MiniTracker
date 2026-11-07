import type { Catalogue, CatalogueSource } from '../../domain/catalogue/types'
import type { SourceFile } from './bsdata'
import { parseCatalogue } from './parse'

/** Convert in a Web Worker when available (browser), inline otherwise (tests). */
export function convert(files: SourceFile[], source: CatalogueSource): Promise<Catalogue> {
  if (typeof Worker === 'undefined') return Promise.resolve(parseCatalogue(files, source))
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e: MessageEvent<{ ok: boolean; catalogue?: Catalogue; error?: string }>) => {
      w.terminate()
      if (e.data.ok) resolve(e.data.catalogue!)
      else reject(new Error(e.data.error))
    }
    w.onerror = (e) => {
      w.terminate()
      reject(new Error(e.message || 'Conversion failed'))
    }
    w.postMessage({ files, source })
  })
}
