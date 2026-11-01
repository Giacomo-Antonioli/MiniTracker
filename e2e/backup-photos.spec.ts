import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

async function makeJpeg(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas')
    c.width = 2000
    c.height = 1500
    const g = c.getContext('2d')!
    for (let i = 0; i < 300; i++) {
      g.fillStyle = `hsl(${(i * 37) % 360}, 70%, ${30 + (i % 40)}%)`
      g.fillRect((i * 97) % 2000, (i * 53) % 1500, 180, 140)
    }
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.95))
    const u = new Uint8Array(await blob.arrayBuffer())
    let s = ''
    u.forEach((x) => (s += String.fromCharCode(x)))
    return btoa(s)
  })
  return Buffer.from(b64, 'base64')
}

async function unitWithPhoto(page: Page, original: Buffer) {
  await page.getByRole('button', { name: '+ Add unit' }).click()
  const d = page.getByRole('dialog', { name: 'Add unit' })
  await d.getByLabel('Faction').fill('Ultramarines')
  await d.getByLabel('Name *').fill('Hellblasters')
  await d.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('cell', { name: 'Hellblasters' }).click()
  const panel = page.getByRole('complementary', { name: 'Unit details' })
  await panel.getByLabel('Add photos').setInputFiles({ name: 'IMG_9.jpg', mimeType: 'image/jpeg', buffer: original })
  await expect(panel.getByText('Photos (1)')).toBeVisible()
}

async function exportAndWipe(page: Page, kind: 'Light' | 'Full', path: string) {
  await page.getByRole('button', { name: /Settings/ }).click()
  await page.getByRole('radio', { name: new RegExp(`^${kind}`) }).check()
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: new RegExp(`Download ${kind.toLowerCase()} backup`) }).click()])
  await dl.saveAs(path)
  await page.getByRole('button', { name: 'Backlog', exact: true }).click()
  await page.getByRole('cell', { name: 'Hellblasters' }).click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Your backlog is empty')).toBeVisible()
}

async function restore(page: Page, path: string) {
  await page.getByRole('button', { name: /Settings/ }).click()
  await page.getByLabel('Backup file').setInputFiles(path)
  await expect(page.getByText(/Restored 1 units and 1 photos/)).toBeVisible()
  await page.getByRole('button', { name: 'Backlog', exact: true }).click()
  await page.getByRole('cell', { name: 'Hellblasters' }).click()
  const panel = page.getByRole('complementary', { name: 'Unit details' })
  await expect(panel.getByText('Photos (1)')).toBeVisible()
  await panel.getByRole('button', { name: /Open photo/ }).click()
  return page.getByRole('dialog', { name: 'Photo 1 of 1' })
}

test.beforeEach(({ page }) => {
  page.on('dialog', (d) => d.accept())
})

test('full backup restores photos with byte-identical originals', async ({ page }, info) => {
  await page.goto('./')
  const original = await makeJpeg(page)
  await unitWithPhoto(page, original)
  const zip = info.outputPath('full.zip')
  await exportAndWipe(page, 'Full', zip)
  expect(readFileSync(zip).length).toBeGreaterThan(original.length)

  const viewer = await restore(page, zip)
  const [dl] = await Promise.all([page.waitForEvent('download'), viewer.getByRole('button', { name: /Download original/ }).click()])
  expect(readFileSync(await dl.path()).equals(original)).toBe(true)
})

test('light backup is small and restores the compressed copies', async ({ page }, info) => {
  await page.goto('./')
  const original = await makeJpeg(page)
  await unitWithPhoto(page, original)
  const zip = info.outputPath('light.zip')
  await exportAndWipe(page, 'Light', zip)
  expect(readFileSync(zip).length).toBeLessThan(original.length)

  const viewer = await restore(page, zip)
  await expect(viewer).toContainText('original removed')
  await expect(viewer.getByRole('img')).toBeVisible()
})

test('remove originals frees space but keeps photos visible', async ({ page }) => {
  await page.goto('./')
  await unitWithPhoto(page, await makeJpeg(page))
  await page.getByRole('button', { name: /Settings/ }).click()
  await page.getByRole('button', { name: /Remove originals/ }).click()
  await expect(page.getByText(/^Freed /)).toBeVisible()
  await expect(page.getByLabel('Storage usage')).toContainText('originals 0.0 MB')
})
