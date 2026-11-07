/**
 * Where the app runs (#168): the web app (GitHub Pages / installed PWA) or the desktop/Android app (Tauri).
 * Links shared with other devices (share, pairing and QR links) always point to the public web app, since the
 * desktop app's own address (tauri://…) means nothing on another device.
 */
export const PUBLIC_URL = 'https://giacomo-antonioli.github.io/MiniTracker/'

export const isDesktopApp = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** The Android app (Tauri mobile, #168 Phase 3). */
export const isAndroidApp = (): boolean => isDesktopApp() && /Android/i.test(navigator.userAgent)

/** Installs that update themselves from GitHub releases: the desktop app, not Android (the .apk is installed by hand). */
export const canAutoUpdate = (): boolean => isDesktopApp() && !isAndroidApp()

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

/**
 * Print the current page. The desktop app's webview ignores window.print() on Windows, so there the
 * native print dialog is opened from the Rust side.
 */
export async function printPage(): Promise<void> {
  if (!isDesktopApp()) return window.print()
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('print_page')
}

/**
 * Print a standalone HTML document. On the web it opens in a new tab and prints there; the desktop app
 * has no pop-ups, so the document is shown inside the page (everything else hidden while printing).
 * Returns false when the browser blocked the pop-up.
 */
export async function printHtml(html: string): Promise<boolean> {
  if (!isDesktopApp()) {
    const w = window.open('', '_blank')
    if (!w) return false
    w.document.write(html)
    w.document.close()
    return true
  }
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script').forEach((s) => s.remove())
  document.getElementById('print-doc')?.remove()
  const root = document.createElement('div')
  root.id = 'print-doc'
  const css = [...doc.querySelectorAll('style')].map((s) => s.textContent).join('\n')
  root.innerHTML = `<style>#print-doc{display:none}@media print{body>:not(#print-doc){display:none!important}#print-doc{display:block}}${css}</style>${doc.body.innerHTML}`
  document.body.appendChild(root)
  window.addEventListener('afterprint', () => root.remove(), { once: true })
  await new Promise((r) => setTimeout(r, 100))
  await printPage()
  return true
}
