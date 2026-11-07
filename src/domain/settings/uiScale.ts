/** Text and interface size (#168): one factor for the root font size; layout follows because it is sized in rem. */
export const UI_SCALES = [0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.5] as const
export const DEFAULT_UI_SCALE = 1

/** The nearest allowed size (anything stored or typed is snapped to the list). */
export function snapScale(x: unknown): number {
  const n = typeof x === 'string' ? Number(x) : typeof x === 'number' ? x : NaN
  if (!Number.isFinite(n)) return DEFAULT_UI_SCALE
  return UI_SCALES.reduce((best, s) => (Math.abs(s - n) < Math.abs(best - n) ? s : best), DEFAULT_UI_SCALE)
}

/** One step bigger (+1) or smaller (-1), staying within the list. */
export function stepScale(current: number, dir: 1 | -1): number {
  const i = UI_SCALES.indexOf(snapScale(current) as (typeof UI_SCALES)[number])
  return UI_SCALES[Math.min(UI_SCALES.length - 1, Math.max(0, i + dir))]
}

export const scaleLabel = (s: number) => `${Math.round(s * 100)}%`

/** "Auto" (the default): the size follows the window, so a bigger or maximised window gets bigger text. */
export const AUTO = 'auto' as const
export type UiScaleSetting = number | typeof AUTO

/** Window width at which Auto is 100%; wider windows grow in steps up to the largest size, never below 100%. */
export const AUTO_BASE_WIDTH = 1280

export function autoScale(windowWidth: number): number {
  const want = Math.min(UI_SCALES[UI_SCALES.length - 1], Math.max(1, windowWidth / AUTO_BASE_WIDTH))
  // The biggest allowed size that does not exceed the window's ratio.
  return [...UI_SCALES].reverse().find((s) => s <= want + 1e-9) ?? 1
}

/** Stored value → setting: a saved size, or Auto when nothing (or "auto") was saved. */
export const readSetting = (x: unknown): UiScaleSetting => (x === null || x === undefined || x === AUTO ? AUTO : snapScale(x))

/** The size in effect. */
export const effectiveScale = (s: UiScaleSetting, windowWidth: number): number => (s === AUTO ? autoScale(windowWidth) : s)
