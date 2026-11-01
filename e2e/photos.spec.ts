import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

test('photos: compressed copy shown, original kept and downloadable, meaningful file name', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./')

  // A real 2400×1800 JPEG made by the browser.
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas')
    c.width = 2400
    c.height = 1800
    const g = c.getContext('2d')!
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `hsl(${i * 6}, 70%, 50%)`
      g.fillRect((i % 10) * 240, Math.floor(i / 10) * 300, 240, 300)
    }
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.95))
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let s = ''
    bytes.forEach((x) => (s += String.fromCharCode(x)))
    return btoa(s)
  })
  const original = Buffer.from(b64, 'base64')

  await page.getByRole('button', { name: '+ Add unit' }).click()
  const d = page.getByRole('dialog', { name: 'Add unit' })
  await d.getByLabel('Faction').fill('Ultramarines')
  await d.getByLabel('Name *').fill('Intercessor Squad')
  await d.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('cell', { name: 'Intercessor Squad' }).click()

  const panel = page.getByRole('complementary', { name: 'Unit details' })
  await panel.getByLabel('Add photos').setInputFiles({ name: 'IMG_1234.jpg', mimeType: 'image/jpeg', buffer: original })
  await expect(panel.getByText('Photos (1)')).toBeVisible()
  await expect(panel.getByRole('img').first()).toBeVisible()

  await panel.getByRole('button', { name: /Open photo/ }).first().click()
  const viewer = page.getByRole('dialog', { name: 'Photo 1 of 1' })
  await expect(viewer).toContainText(/ultramarines_intercessor-squad_mt-[0-9a-f]{8}_sprue_\d{8}_01\.jpg/)
  await expect(viewer).toContainText('shown 1600×1200')

  const [download] = await Promise.all([page.waitForEvent('download'), viewer.getByRole('button', { name: /Download original/ }).click()])
  expect(download.suggestedFilename()).toMatch(/^ultramarines_intercessor-squad_mt-[0-9a-f]{8}_sprue_\d{8}_01\.jpg$/)
  const saved = readFileSync(await download.path())
  expect(saved.equals(original)).toBe(true) // byte-for-byte original

  await page.reload()
  await page.getByRole('cell', { name: 'Intercessor Squad' }).click()
  await expect(page.getByRole('complementary', { name: 'Unit details' }).getByText('Photos (1)')).toBeVisible()
  expect(errors).toEqual([])
})
