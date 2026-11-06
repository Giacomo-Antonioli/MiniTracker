// @3d-dice/dice-box ships no types; src/features/dice/engine.ts declares the parts it uses.
declare module '@3d-dice/dice-box' {
  const DiceBox: new (config: Record<string, unknown>) => unknown
  export default DiceBox
}
