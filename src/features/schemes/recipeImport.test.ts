// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { bookmarkletCode, readRecipeHash } from './recipeImport'

describe('recipe hash', () => {
  it('reads a valid payload and ignores bad blocks', () => {
    const p = { v: 1, url: 'https://x/y', title: 'T', site: 'x', blocks: [{ type: 'heading', text: 'Armour' }, { type: 'evil', text: 'x' }, { type: 'step' }] }
    expect(readRecipeHash('#recipe=' + encodeURIComponent(JSON.stringify(p)))).toEqual({ ...p, blocks: [{ type: 'heading', text: 'Armour' }] })
  })
  it('returns null for anything else', () => {
    expect(readRecipeHash('')).toBeNull()
    expect(readRecipeHash('#recipe=%7Bbroken')).toBeNull()
    expect(readRecipeHash('#recipe=' + encodeURIComponent('{"v":2}'))).toBeNull()
  })
})

describe('bookmarklet', () => {
  it('collects a recipe page and opens the app with it', () => {
    document.head.innerHTML = '<meta property="og:title" content="How to paint T\'au"><meta name="author" content="Jane"><meta property="og:site_name" content="Goonhammer">'
    document.body.innerHTML = `
      <article>
        <h2>Armour</h2>
        <ol><li>Basecoat with Tau Light Ochre.</li><li>Shade with <span class="paint-swatch"><span class="paint-swatch__sample" style="background: #8b4806"></span> Skrag Brown</span></li></ol>
        <p>Thanks for reading!</p>
      </article>`
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const code = bookmarkletCode('https://app.example/MiniTracker/')
    expect(code.startsWith('javascript:(')).toBe(true)
    new Function(code.slice('javascript:'.length))()
    const url = open.mock.calls[0][0] as string
    expect(url.startsWith('https://app.example/MiniTracker/#recipe=')).toBe(true)
    const p = readRecipeHash(url.slice(url.indexOf('#')))!
    expect(p).toMatchObject({ title: "How to paint T'au", author: 'Jane', site: 'Goonhammer' })
    expect(p.blocks).toEqual([
      { type: 'heading', text: 'Armour' },
      { type: 'step', text: 'Basecoat with Tau Light Ochre.' },
      { type: 'step', text: 'Shade with Skrag Brown', paints: [{ name: 'Skrag Brown', hex: '#8b4806' }] },
      { type: 'step', text: 'Thanks for reading!' },
    ])
  })
})
