import { expect, test } from '@playwright/test'

test('game photos: add during the game, still there in history (#164)', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./')
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas')
    c.width = 400
    c.height = 300
    c.getContext('2d')!.fillRect(0, 0, 200, 150)
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9))
    let s = ''
    new Uint8Array(await blob.arrayBuffer()).forEach((x) => (s += String.fromCharCode(x)))
    return btoa(s)
  })
  await page.getByRole('button', { name: 'Games' }).click()
  await page.getByRole('button', { name: '▶ New game' }).click()
  await page.getByRole('button', { name: '▶ Start game' }).click()
  await page.getByLabel('Add game photos').setInputFiles({ name: 'table.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') })
  await expect(page.getByText('Photos (1)')).toBeVisible()
  await page.getByRole('button', { name: 'End game' }).click()
  await page.getByRole('dialog', { name: 'End game' }).getByRole('button', { name: 'Save game' }).click()
  await page.getByRole('table').first().getByRole('row').nth(1).click()
  await expect(page.getByText('Photos (1)')).toBeVisible()
  expect(errors).toEqual([])
})
