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
  await page.getByRole('button', { name: 'Catalogue' }).click()
  await expect(page.getByText('No catalogue installed yet')).toBeVisible()

  await page.locator('input[type=file]').setInputFiles(files)
  const status = page.getByRole('region', { name: 'Catalogue status' })
  await expect(status).toContainText('Test Game')
  await expect(status).toContainText('5 units in 2 factions')

  await page.reload()
  await page.getByRole('button', { name: 'Catalogue' }).click()
  await expect(status).toContainText('5 units in 2 factions')
  expect(errors).toEqual([])
})
