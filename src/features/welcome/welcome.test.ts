// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { shouldShowWelcome, useWelcome } from './welcome'

describe('welcome guide (#168)', () => {
  beforeEach(() => {
    localStorage.removeItem('welcomeDone')
    useWelcome.setState({ done: false, reopened: false })
  })

  it('shows on a first start with no data, not when there are units or once done', () => {
    expect(shouldShowWelcome(useWelcome.getState(), false)).toBe(true)
    expect(shouldShowWelcome(useWelcome.getState(), true)).toBe(false)
    useWelcome.getState().finish()
    expect(localStorage.getItem('welcomeDone')).toBe('1')
    expect(shouldShowWelcome(useWelcome.getState(), false)).toBe(false)
  })

  it('can be opened again from Settings even when done', () => {
    useWelcome.getState().finish()
    useWelcome.getState().reopen()
    expect(shouldShowWelcome(useWelcome.getState(), true)).toBe(true)
    useWelcome.getState().finish()
    expect(shouldShowWelcome(useWelcome.getState(), true)).toBe(false)
  })
})
