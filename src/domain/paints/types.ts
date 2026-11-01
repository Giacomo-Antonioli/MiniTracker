/** A paint that exists (bundled list or added by the user). */
export interface PaintDef {
  id: string
  brand: string
  name: string
  /** base, layer, shade, contrast, metallic, air, technical… */
  type?: string
  /** red, blue, metallic, bone… */
  family?: string
  hex: string
  /** Only set for paints the user added. */
  custom?: true
}

/** What the user has of one paint. Absent = never touched. */
export interface PaintStock {
  paintId: string
  /** Stage id from the paint pipeline (wishlist, sealed, in use, low…). */
  stage: string
  /** Number of pots. */
  quantity: number
  purchaseDate?: string
  /** Price per pot. */
  price?: number
  shop?: string
  /** Case, drawer, rack slot… */
  location?: string
  barcode?: string
  /** 1–5 */
  rating?: number
  favourite: boolean
  notes: string
  updatedAt: string
}
