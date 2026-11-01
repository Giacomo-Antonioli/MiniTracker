import { expect, test } from '@playwright/test'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

// Uses the hand-written sample files, so this runs offline and goes through the real Web Worker.
const dir = join(process.cwd(), 'src/data/catalogue/fixtures')
const files = readdirSync(dir).map((f) => join(dir, f))

test('import catalogue from local files', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./')
  await page.getByRole('button', { name: /Settings/ }).click()
  await expect(page.getByRole('region', { name: 'Catalogue 11th edition' })).toContainText('Not installed.')

  await page.getByLabel('Catalogue files').setInputFiles(files)
  const status = page.getByRole('region', { name: 'Catalogue Test Game' })
  await expect(status).toContainText('Test Game')
  await expect(status).toContainText('5 units in 2 factions')

  await page.reload()
  await page.getByRole('button', { name: /Settings/ }).click()
  await expect(status).toContainText('5 units in 2 factions')
  expect(errors).toEqual([])
})
