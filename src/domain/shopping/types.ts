/** What a shopping item is: a model kit (datasheet), a paint, or anything else (brushes, basing sand…). */
export type ShopItemKind = 'model' | 'paint' | 'other'

/** One thing to buy. Every item is on the main list; `listIds` also puts it on your own lists (#87). */
export interface ShopItem {
  id: string
  kind: ShopItemKind
  name: string
  /** Paint id (kind 'paint') or datasheet id (kind 'model'). */
  refId?: string
  /** Backlog unit holding these models as Wishlisted; ticking bought moves them to the first owned stage. */
  unitId?: string
  /** Models for a kit, pots for a paint. */
  qty: number
  shop?: string
  /** Total price for this line. */
  price?: number
  bought: boolean
  /** Where it came from, e.g. "List: Sept strike", "Scheme: Sept". */
  sources: string[]
  listIds: string[]
  createdAt: string
  updatedAt: string
}

/** A named shopping list holding some of the main list's items. */
export interface ShopList {
  id: string
  name: string
  createdAt: string
}

export type NewShopItem = Pick<ShopItem, 'kind' | 'name' | 'qty'> & Partial<Pick<ShopItem, 'refId' | 'unitId' | 'shop' | 'price' | 'sources'>>
