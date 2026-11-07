// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PUBLIC_URL, appUrl, isDesktopApp, openLinksInBrowser } from './platform'

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
  document.body.innerHTML = ''
})

describe('platform (#168)', () => {
  it('on the web, links use the page address; in the desktop app, the public web app', () => {
    expect(isDesktopApp()).toBe(false)
    expect(appUrl()).toBe(location.origin + location.pathname)
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
    expect(isDesktopApp()).toBe(true)
    expect(appUrl()).toBe(PUBLIC_URL)
  })

  it('external and new-tab links open in the system browser; in-app links stay', () => {
    const open = vi.fn(async () => {})
    const stop = openLinksInBrowser(open)
    document.body.innerHTML = '<a id="ext" href="https://github.com/x" target="_blank">x</a><a id="in" href="#stats">s</a>'
    const ext = new MouseEvent('click', { bubbles: true, cancelable: true })
    document.getElementById('ext')!.dispatchEvent(ext)
    document.getElementById('in')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(open).toHaveBeenCalledExactlyOnceWith('https://github.com/x')
    expect(ext.defaultPrevented).toBe(true)
    stop()
  })
})
