import { expect, it } from 'vitest'
import { decodeShare, encodeShare, httpUrl, shareToken, shareUrl } from './share'

it('round-trips text through a URL-safe token', async () => {
  const text = JSON.stringify({ name: 'Sa’cea – ½ ✓', steps: Array(50).fill('basecoat Mephiston Red') })
  const t = await encodeShare(text)
  expect(t).toMatch(/^[A-Za-z0-9_-]+$/)
  expect(t.length).toBeLessThan(text.length)
  expect(await decodeShare(t)).toBe(text)
})

it('reads the token from the hash and builds the url', async () => {
  expect(shareToken('#scheme=abc')).toBe('abc')
  expect(shareToken('#scheme=')).toBeNull()
  expect(shareToken('#recipe=x')).toBeNull()
  const url = await shareUrl('https://x.io/app/#old', 'hi')
  expect(url.startsWith('https://x.io/app/#scheme=')).toBe(true)
  expect(await decodeShare(shareToken(new URL(url).hash)!)).toBe('hi')
})

it('rejects a broken token', async () => {
  await expect(decodeShare('!!!')).rejects.toThrow(/broken/)
  await expect(decodeShare('AAAA')).rejects.toThrow(/broken/)
})

it('httpUrl accepts only http(s)', () => {
  expect(httpUrl(' https://youtu.be/x ')?.hostname).toBe('youtu.be')
  expect(httpUrl('javascript:alert(1)')).toBeUndefined()
  expect(httpUrl('not a url')).toBeUndefined()
})
