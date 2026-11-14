/** Common round base sizes in mm (Warhammer, AoS, 40k, Kings of War…). */
export const ROUND_BASES = [25, 28.5, 32, 40, 50, 60] as const

export interface TrayPlan {
  /** Hole diameter to cut, in mm. */
  hole: number
  /** Centre to centre distance between two holes. */
  pitch: number
  cols: number
  rows: number
  cells: number
}

const half = (n: number) => Math.round(n * 2) / 2

/**
 * Cardboard tray with one round hole per base. The hole is a little wider than the base so it drops in
 * without scraping the paint; `wall` is the card left between two holes and at the tray edge.
 * Returns undefined when not even one hole fits.
 */
export function trayPlan(baseMm: number, trayW: number, trayD: number, clearance = 1.5, wall = 8): TrayPlan | undefined {
  if (![baseMm, trayW, trayD].every((n) => Number.isFinite(n) && n > 0)) return undefined
  const hole = half(baseMm + clearance)
  const pitch = hole + wall
  const cols = Math.floor((trayW - wall) / pitch)
  const rows = Math.floor((trayD - wall) / pitch)
  if (cols < 1 || rows < 1) return undefined
  return { hole, pitch, cols, rows, cells: cols * rows }
}
