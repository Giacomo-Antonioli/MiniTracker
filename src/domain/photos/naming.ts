/** File-system-safe lower-case words joined by dashes. */
export function slug(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Short permanent tag of a unit. QR/NFC tags and NFTs (#10) point to the same tag. */
export function unitTag(unitId: string): string {
  return `mt-${unitId.replace(/-/g, '').slice(0, 8).toLowerCase()}`
}

const day = (iso: string) => iso.slice(0, 10).replace(/-/g, '')
const nn = (n: number) => String(n).padStart(2, '0')

type UnitPhoto = { faction?: string; unitName: string; unitId: string; stage?: string; date: string; seq: number; ext: string }
type SchemePhoto = { scheme: string; schemeId: string; date: string; seq: number; ext: string }

export function photoFileName(p: UnitPhoto | SchemePhoto): string {
  const ext = p.ext.toLowerCase()
  if ('scheme' in p) {
    return `scheme_${slug(p.scheme) || 'scheme'}_sc-${p.schemeId.replace(/-/g, '').slice(0, 8).toLowerCase()}_${day(p.date)}_${nn(p.seq)}.${ext}`
  }
  return [slug(p.faction ?? '') || 'no-faction', slug(p.unitName) || 'unit', unitTag(p.unitId), slug(p.stage ?? '') || 'photo', day(p.date), nn(p.seq)].join('_') + `.${ext}`
}
