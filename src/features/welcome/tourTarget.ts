import type { WelcomeGo } from './WelcomeGuide'

/** What to point at: a CSS selector, or the visible text of a button, tab, heading or label. */
export type TourTarget = { css: string } | { text: string }

/** Something a mock step does before it is shown, as if the user did it. */
export type TourAction =
  | { click: TourTarget }
  /** Type into the field with this label (or CSS selector). */
  | { fill: TourTarget; value: string }
  /** Pick an option (by value or visible text) in the select with this label. */
  | { pick: TourTarget; value: string }
  | { wait: number }

export interface TourStep {
  page: WelcomeGo
  target?: TourTarget
  title: string
  text: string
  /** Acted out (once, going forward) before the step is shown. */
  before?: TourAction[]
  /** Shown only when a catalogue is installed (pages that are built from one, like army lists). */
  needsCatalogue?: boolean
}

const visible = (e: Element) => (e as HTMLElement).offsetParent !== null || getComputedStyle(e).position === 'fixed'
const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase()

/** Finds the element of a step on the page (first visible match; open dialogs first). */
export function findTarget(t: TourTarget | undefined, root: ParentNode = document): HTMLElement | null {
  if (!t) return null
  const scopes: ParentNode[] = [...document.querySelectorAll('dialog[open]'), root]
  for (const scope of scopes) {
    if ('css' in t) {
      const hit = [...scope.querySelectorAll(t.css)].find(visible)
      if (hit) return hit as HTMLElement
      continue
    }
    const want = norm(t.text)
    const els = [...scope.querySelectorAll('button, a, [role="tab"], h1, h2, h3, label, summary, li, td, tr')].filter((e) => visible(e) && !e.closest('.driver-popover'))
    // Text that starts with it first (a button or heading), else the smallest element that contains it (a row).
    const hit = els.find((e) => norm(e.textContent).startsWith(want)) ?? els.filter((e) => norm(e.textContent).includes(want)).sort((a, b) => norm(a.textContent).length - norm(b.textContent).length)[0]
    if (hit) return hit as HTMLElement
  }
  return null
}

/** The input, select or textarea for a label text (or a CSS selector). */
export function findField(t: TourTarget): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null {
  const isField = (e: Element | null): e is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement => !!e && /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName)
  if ('css' in t) {
    const e = findTarget(t)
    return isField(e) ? e : (e?.querySelector('input, select, textarea') as HTMLInputElement | null)
  }
  const want = norm(t.text)
  for (const scope of [...document.querySelectorAll('dialog[open]'), document]) {
    const byAria = [...scope.querySelectorAll('input, select, textarea')].find((e) => visible(e) && (norm(e.getAttribute('aria-label')) === want || norm(e.getAttribute('placeholder')).startsWith(want)))
    if (isField(byAria ?? null)) return byAria as HTMLInputElement
    for (const label of scope.querySelectorAll('label')) {
      if (!visible(label) || !norm(label.textContent).startsWith(want)) continue
      const f = label.htmlFor ? document.getElementById(label.htmlFor) : label.querySelector('input, select, textarea')
      if (isField(f)) return f
    }
  }
  return null
}

/** Sets a value the way typing would, so React sees it. */
function setValue(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const proto = Object.getPrototypeOf(el) as object
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Waits (up to about two seconds) for something to appear: pages and dialogs render after the previous action. */
async function until<T>(get: () => T | null): Promise<T | null> {
  for (let i = 0; i < 20; i++) {
    const v = get()
    if (v) return v
    await sleep(100)
  }
  return null
}

/** Acts out a mock step. Missing elements are skipped: the tour carries on rather than getting stuck. */
export async function runActions(actions: TourAction[] = []): Promise<void> {
  for (const a of actions) {
    if ('wait' in a) await sleep(a.wait)
    else if ('click' in a) (await until(() => findTarget(a.click)))?.click()
    else {
      const f = await until(() => findField('fill' in a ? a.fill : a.pick))
      if (!f) continue
      if ('pick' in a && f instanceof HTMLSelectElement) {
        const o = [...f.options].find((x) => x.value === a.value || norm(x.textContent) === norm(a.value))
        if (o) setValue(f, o.value)
      } else setValue(f, a.value)
    }
    await sleep(150)
  }
}

/** Waits until a step's element is on the page, up to about two seconds. */
export async function waitForTarget(step: TourStep): Promise<HTMLElement | null> {
  return step.target ? until(() => findTarget(step.target)) : null
}
