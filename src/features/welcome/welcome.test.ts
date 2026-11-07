// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { useWelcome } from './welcome'

const s = () => useWelcome.getState()

describe('welcome guide (#168)', () => {
  beforeEach(() => {
    localStorage.removeItem('welcomeDone')
    useWelcome.setState({ done: false, open: false, paused: false, step: 0 })
  })

  it('opens on a first start with no data, not when there are units or once done', () => {
    s().startIfNew(true)
    expect(s().open).toBe(false)
    s().startIfNew(false)
    expect(s().open).toBe(true)
    s().finish()
    expect(localStorage.getItem('welcomeDone')).toBe('1')
    expect(s().open).toBe(false)
    s().startIfNew(false)
    expect(s().open).toBe(false)
  })

  it('pauses on a step while you try it and resumes there; adding units meanwhile does not close it', () => {
    s().startIfNew(false)
    s().setStep(4)
    s().pause()
    expect(s()).toMatchObject({ open: true, paused: true, step: 4 })
    s().startIfNew(true)
    s().resume()
    expect(s()).toMatchObject({ open: true, paused: false, step: 4 })
  })

  it('can be opened again from Settings even when done, from the first step', () => {
    s().finish()
    s().reopen()
    expect(s()).toMatchObject({ open: true, paused: false, step: 0 })
  })
})
