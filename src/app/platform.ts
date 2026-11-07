/**
 * Where the app runs (#168): the web app (GitHub Pages / installed PWA) or the desktop/Android app (Tauri).
 * Links shared with other devices (share, pairing and QR links) always point to the public web app, since the
 * desktop app's own address (tauri://…) means nothing on another device.
 */
export const PUBLIC_URL = 'https://giacomo-antonioli.github.io/MiniTracker/'

export const isDesktopApp = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** Base address for links to this app: the page's own address on the web, the public web app in the desktop app. */
export const appUrl = (): string => (isDesktopApp() ? PUBLIC_URL : location.origin + location.pathname)

/** In the desktop app, web links open in the system browser instead of inside the app window. */
export function openLinksInBrowser(open: (url: string) => Promise<void>): () => void {
  const onClick = (e: MouseEvent) => {
    const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
    if (!a || !/^(https?:|mailto:)/.test(a.href) || (a.target !== '_blank' && new URL(a.href).origin === location.origin)) return
    e.preventDefault()
    void open(a.href)
  }
  document.addEventListener('click', onClick)
  return () => document.removeEventListener('click', onClick)
}
