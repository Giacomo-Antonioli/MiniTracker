/** Dice roller (#191): the attack sequence hits → wounds → saves on D6s. */
export type Step = 'hit' | 'wound' | 'save'
export const STEPS: Step[] = ['hit', 'wound', 'save']
export const STEP_LABEL: Record<Step, string> = { hit: 'Hit', wound: 'Wound', save: 'Save' }

/** Target for a roll of N+, kept between 2+ and 6+ (a 1 always fails, a 6 always succeeds). */
export const clampTarget = (t: number) => Math.min(6, Math.max(2, Math.round(t)))

/** Dice that succeed on target+ (a natural 1 always fails). */
export const isSuccess = (v: number, target: number) => v !== 1 && v >= clampTarget(target)
export const successes = (values: number[], target: number) => values.filter((v) => isSuccess(v, target)).length

/** Which dice to re-roll: the 1s, or every failed die. */
export type Reroll = 'ones' | 'fails'
export function rerollIndices(values: number[], target: number, mode: Reroll): number[] {
  return values.flatMap((v, i) => ((mode === 'ones' ? v === 1 : !isSuccess(v, target)) ? [i] : []))
}

/** Wound roll needed from Strength and Toughness: 2+ (S ≥ 2T), 3+ (S > T), 4+ (equal), 5+ (S < T), 6+ (2S ≤ T). */
export function woundTarget(s: number, t: number): number {
  if (s >= 2 * t) return 2
  if (s > t) return 3
  if (s === t) return 4
  if (2 * s <= t) return 6
  return 5
}

/**
 * Save roll needed: the Save characteristic worsened by AP (AP −2 on a 3+ save → 5+), or the invulnerable save
 * if better (AP does not change it). Undefined when no save is possible (worse than 6+).
 */
export function saveTarget(save: number, ap: number, invuln?: number): number | undefined {
  const armour = save + Math.abs(ap)
  const best = invuln && invuln < armour ? invuln : armour
  return best > 6 ? undefined : Math.max(2, best)
}

/** Sorted copy, highest first, for showing a pool of dice. */
export const sortedDesc = (values: number[]) => [...values].sort((a, b) => b - a)

/** One step of the sequence: how many dice, the target, the result. */
export interface StepRoll {
  step: Step
  dice: number
  target: number
  values: number[]
}

/** Dice carried to the next step: hits become wound dice; wounds become save dice (failed saves are what get through). */
export const carried = (r: StepRoll) => successes(r.values, r.target)

/** Failed saves: the attacks that get through. */
export const unsaved = (r: StepRoll) => r.values.length - successes(r.values, r.target)

/** Fair D6 values without animation. */
export function rollD6(n: number, random: () => number = Math.random): number[] {
  return Array.from({ length: Math.max(0, n) }, () => 1 + Math.floor(random() * 6))
}
