import { DEFAULT_PIPELINE } from './collection/pipeline'
import type { Pipeline } from './collection/types'
import { DEFAULT_STORAGE_FLOW } from './storage/storage'

/** Every editable pipeline in the app. Units use 'painting'; paints and schemes get theirs in #26/#27. */
export type PipelineKey = 'painting' | 'paint' | 'scheme' | 'storage' | 'level'

export const DEFAULT_PIPELINES: Record<PipelineKey, Pipeline> = {
  painting: DEFAULT_PIPELINE,
  paint: {
    stages: [
      { id: 'wishlist', name: 'Wishlist' },
      { id: 'ordered', name: 'Ordered' },
      { id: 'sealed', name: 'Sealed' },
      { id: 'in-use', name: 'In use' },
      { id: 'low', name: 'Running low' },
      { id: 'empty', name: 'Empty / dried' },
    ],
  },
  storage: DEFAULT_STORAGE_FLOW,
  /** How full a liquid supply is (primer, glue, varnish…); 'low' and later count as running low. */
  level: {
    stages: [
      { id: 'full', name: 'Full' },
      { id: 'half', name: 'Half' },
      { id: 'low', name: 'Running low' },
      { id: 'empty', name: 'Empty' },
    ],
  },
  scheme: {
    stages: [
      { id: 'idea', name: 'Idea' },
      { id: 'testing', name: 'Testing' },
      { id: 'final', name: 'Final' },
      { id: 'archived', name: 'Archived' },
    ],
  },
}
