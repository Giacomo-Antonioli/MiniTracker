import { expect, it } from 'vitest'
import { buffered } from './syncChannel'

it('keeps messages and a close that arrive before anyone listens', () => {
  let deliver!: (t: string) => void
  let closeIt!: () => void
  const ch = buffered((fn) => (deliver = fn), (fn) => (closeIt = fn))
  deliver('hello')
  deliver('plan')
  closeIt()
  const got: string[] = []
  ch.onMessage((t) => got.push(t))
  deliver('later')
  let closed = false
  ch.onClose(() => (closed = true))
  expect(got).toEqual(['hello', 'plan', 'later'])
  expect(closed).toBe(true)
})
