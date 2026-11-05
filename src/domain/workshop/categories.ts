import { LIQUID_CATEGORIES, SUPPLY_CATEGORIES } from '../supplies/supplies'
import { TOOL_CATEGORIES } from '../tools/tools'
import type { WorkshopCategories } from './item'

export const DEFAULT_CATEGORIES: WorkshopCategories = { tools: TOOL_CATEGORIES, supplies: SUPPLY_CATEGORIES, liquid: LIQUID_CATEGORIES }
