import { describe, expect, it } from 'vitest'
import { APP_NAME } from './version'

describe('smoke', () => {
  it('has an app name', () => {
    expect(APP_NAME).toBe('MiniTracker')
  })
})
