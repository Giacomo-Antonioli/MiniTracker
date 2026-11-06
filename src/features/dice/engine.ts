import { rollD6 } from '../../domain/dice/dice'

/** Rolls D6s, animated or not (#191). `reroll` returns the whole pool with the chosen dice rolled again. */
export interface DiceEngine {
  roll(n: number): Promise<number[]>
  reroll(values: number[], indices: number[]): Promise<number[]>
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
  roll(n: string): Promise<DieRoll[]>
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
