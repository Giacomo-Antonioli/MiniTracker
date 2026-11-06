import { rollD6 } from '../../domain/dice/dice'

/** Rolls D6s, animated or not (#191). `reroll` returns the whole pool with the chosen dice rolled again. */
export interface DiceEngine {
  roll(n: number): Promise<number[]>
  reroll(values: number[], indices: number[]): Promise<number[]>
}

const PREF = 'mt.dice3d'
/** 3D dice on unless turned off here or the device asks for reduced motion. */
export function read3d(): boolean {
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
    return localStorage.getItem(PREF) !== 'off'
  } catch {
    return true
  }
}
export function write3d(on: boolean) {
  try {
    localStorage.setItem(PREF, on ? 'on' : 'off')
  } catch {
    // Not saved: the choice lasts until the page reloads.
  }
}

/** No animation: reduce motion, quick mode, tests, or when 3D can't start. */
export const quickEngine: DiceEngine = {
  roll: async (n) => rollD6(n),
  reroll: async (values, indices) => {
    const fresh = rollD6(indices.length)
    const out = [...values]
    indices.forEach((i, k) => (out[i] = fresh[k]))
    return out
  },
}

type DieRoll = { value: number; groupId: number; rollId: number | string; sides: number; qty?: number; theme?: string }
type Box = {
  init(): Promise<unknown>
  roll(n: string, o?: { themeColor?: string }): Promise<DieRoll[]>
  add(n: string, o?: { themeColor?: string }): Promise<DieRoll[]>
  reroll(r: DieRoll[], o: { remove: boolean }): Promise<DieRoll[]>
  updateConfig(c: Record<string, unknown>): void
  clear(): void
}

/**
 * The 3D tray: one canvas for the whole app, kept in a detached element that the roller moves into its slot, so
 * BabylonJS and the physics worker start once. Loaded on first use (it is a large download).
 */
const tray = typeof document !== 'undefined' ? Object.assign(document.createElement('div'), { id: 'dice-tray', className: 'dice-tray' }) : undefined
let box: Promise<Box> | undefined
let rolls: DieRoll[] = []

export function attachTray(slot: HTMLElement) {
  if (tray && tray.parentElement !== slot) slot.appendChild(tray)
}

function loadBox(): Promise<Box> {
  box ??= (async () => {
    if (!tray) throw new Error('No document')
    if (!tray.isConnected) throw new Error('Dice tray not shown')
    const { default: DiceBox } = await import('@3d-dice/dice-box')
    const b = new DiceBox({ container: '#dice-tray', assetPath: `${import.meta.env.BASE_URL}dice-box/`, theme: 'default', themeColor: '#b3261e', scale: 6 }) as unknown as Box
    await b.init()
    return b
  })().catch((e) => {
    box = undefined
    throw e
  })
  return box
}

const scaleFor = (n: number) => (n <= 6 ? 8 : n <= 15 ? 6.5 : n <= 30 ? 5 : 4)

export const boxEngine: DiceEngine = {
  async roll(n) {
    const b = await loadBox()
    b.updateConfig({ scale: scaleFor(n) })
    rolls = n > 0 ? await b.roll(`${n}d6`) : (b.clear(), [])
    return rolls.map((r) => r.value)
  },
  async reroll(values, indices) {
    const b = await loadBox()
    if (rolls.length !== values.length) return quickEngine.reroll(values, indices)
    const fresh = await b.reroll(indices.map((i) => rolls[i]), { remove: true })
    indices.forEach((i, k) => (rolls[i] = fresh[k]))
    return rolls.map((r) => r.value)
  },
}

/** Colours of the two players' dice in a roll-off. */
export const ME_COLOR = '#b3261e'
export const THEM_COLOR = '#1e5bb3'

/** Roll-off (#192): one D6 each, in each player's colour. Returns [mine, theirs]. */
export async function rollOff(use3d: boolean): Promise<[number, number]> {
  if (!use3d) {
    const [a, b] = await quickEngine.roll(2)
    return [a, b]
  }
  const b = await loadBox()
  b.updateConfig({ scale: 8 })
  rolls = []
  const [mine, theirs] = await Promise.all([b.roll('1d6', { themeColor: ME_COLOR }), b.add('1d6', { themeColor: THEM_COLOR })])
  return [mine[0].value, theirs[0].value]
}
