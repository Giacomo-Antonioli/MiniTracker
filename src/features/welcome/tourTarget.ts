import type { WelcomeGo } from './WelcomeGuide'

/** What to point at: a CSS selector, or the visible text of a button, tab or heading. */
export type TourTarget = { css: string } | { text: string }

export interface TourStep {
  page: WelcomeGo
  target?: TourTarget
  title: string
  text: string
}

/** Finds the element of a step on the page (first visible match). */
export function findTarget(t: TourTarget | undefined, root: ParentNode = document): HTMLElement | null {
  if (!t) return null
  const visible = (e: Element) => (e as HTMLElement).offsetParent !== null || getComputedStyle(e).position === 'fixed'
  if ('css' in t) return ([...root.querySelectorAll(t.css)].find(visible) as HTMLElement) ?? null
  const want = t.text.trim().toLowerCase()
  const els = [...root.querySelectorAll('button, a, [role="tab"], h1, h2, h3, label, summary')]
  return (els.find((e) => visible(e) && (e.textContent ?? '').trim().toLowerCase().startsWith(want)) as HTMLElement) ?? null
}
