import { backlog } from './backlog'
import { batchA } from './batchA'
import { batchB } from './batchB'
import { batchC } from './batchC'

/** English text → [it, es, de, fr, zh], one dictionary per area of the app. */
export type Dict = Record<string, [it: string, es: string, de: string, fr: string, zh: string]>

export const TEXT: Record<string, Dict> = { backlog, batchA, batchB, batchC }
