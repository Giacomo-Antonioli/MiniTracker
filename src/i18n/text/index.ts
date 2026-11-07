import { backlog } from './backlog'

/** English text → [it, es, de, fr, zh], one dictionary per area of the app. */
export type Dict = Record<string, [it: string, es: string, de: string, fr: string, zh: string]>

export const TEXT: Record<string, Dict> = { backlog }
