import type { Ctx } from '../collection/types'
import type { NewShopItem, ShopItem, ShopList } from './types'

/** The main list holds every item. */
export const MAIN = 'main'

const same = (a: Pick<ShopItem, 'kind' | 'refId' | 'name'>, b: Pick<ShopItem, 'kind' | 'refId' | 'name'>) =>
  a.kind === b.kind && (a.refId || b.refId ? a.refId === b.refId : a.name.trim().toLowerCase() === b.name.trim().toLowerCase())
const union = (a: string[], b: string[]) => [...new Set([...a, ...b])]

/**
 * Adds items to the main list and to the chosen lists. An item already there and not bought is reused:
 * it joins the lists, gains the sources, and keeps the larger quantity (so adding the same buy list twice does not double it).
 */
export function addItems(items: ShopItem[], incoming: NewShopItem[], listIds: string[], ctx: Ctx): { items: ShopItem[]; changed: ShopItem[] } {
  const out = [...items]
  const changed: ShopItem[] = []
  const lists = listIds.filter((id) => id !== MAIN)
  for (const n of incoming) {
    const i = out.findIndex((x) => !x.bought && same(x, n))
    const item: ShopItem =
      i >= 0
        ? { ...out[i], qty: Math.max(out[i].qty, n.qty), sources: union(out[i].sources, n.sources ?? []), listIds: union(out[i].listIds, lists), shop: out[i].shop ?? n.shop, price: out[i].price ?? n.price, updatedAt: ctx.now }
        : { id: ctx.newId(), kind: n.kind, name: n.name.trim(), refId: n.refId, qty: Math.max(1, n.qty), shop: n.shop, price: n.price, bought: false, sources: n.sources ?? [], listIds: lists, createdAt: ctx.now, updatedAt: ctx.now }
    if (i >= 0) out[i] = item
    else out.push(item)
    changed.push(item)
  }
  return { items: out, changed }
}

/** Items on a list (the main list has all), to buy first, then by kind and name. */
export function itemsOn(items: ShopItem[], listId: string): ShopItem[] {
  const order = { model: 0, paint: 1, other: 2 }
  return items
    .filter((x) => listId === MAIN || x.listIds.includes(listId))
    .sort((a, b) => Number(a.bought) - Number(b.bought) || order[a.kind] - order[b.kind] || a.name.localeCompare(b.name))
}

/** Totals of what is still to buy. Items without a price are counted apart. */
export function totals(items: ShopItem[]): { toBuy: number; bought: number; price: number; unpriced: number } {
  const open = items.filter((x) => !x.bought)
  return {
    toBuy: open.length,
    bought: items.length - open.length,
    price: Math.round(open.reduce((s, x) => s + (x.price ?? 0), 0) * 100) / 100,
    unpriced: open.filter((x) => x.price === undefined).length,
  }
}

export function newList(name: string, ctx: Ctx): ShopList {
  const n = name.trim()
  if (!n) throw new Error('Give the list a name')
  return { id: ctx.newId(), name: n, createdAt: ctx.now }
}

/** Removes a list's id from its items (the items stay on the main list). */
export function withoutList(items: ShopItem[], listId: string, ctx: Pick<Ctx, 'now'>): ShopItem[] {
  return items.filter((x) => x.listIds.includes(listId)).map((x) => ({ ...x, listIds: x.listIds.filter((id) => id !== listId), updatedAt: ctx.now }))
}

const money = (n: number) => n.toFixed(2)

/** Plain text, grouped by shop, for a message or a note. */
export function shoppingText(title: string, items: ShopItem[]): string {
  const open = items.filter((x) => !x.bought)
  if (!open.length) return `${title}: nothing to buy`
  const byShop = new Map<string, ShopItem[]>()
  for (const x of open) byShop.set(x.shop ?? '', [...(byShop.get(x.shop ?? '') ?? []), x])
  const out = [title]
  for (const [shop, xs] of [...byShop].sort(([a], [b]) => (a ? 0 : 1) - (b ? 0 : 1) || a.localeCompare(b))) {
    out.push('', shop || 'Any shop')
    out.push(...xs.map((x) => `- ${x.qty > 1 ? `${x.qty}× ` : ''}${x.name}${x.price !== undefined ? ` – ${money(x.price)}` : ''}`))
  }
  const t = totals(items)
  out.push('', `Total: ${money(t.price)}${t.unpriced ? ` (+${t.unpriced} without price)` : ''}`)
  return out.join('\n')
}
