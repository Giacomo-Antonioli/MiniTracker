import { expect, test } from '@playwright/test'

test('scheme library: pages of 60, show more, faction filter', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./')
  await page.getByRole('button', { name: 'Schemes' }).click()
  const list = page.getByRole('list', { name: 'Schemes' })
  await expect(list.getByRole('listitem')).toHaveCount(60, { timeout: 15000 })
  await page.getByRole('button', { name: /Show more/ }).click()
  await expect(list.getByRole('listitem')).toHaveCount(120)
  await page.getByRole('region', { name: 'Scheme filters' }).getByRole('combobox').first().selectOption('Necrons')
  const n = await list.getByRole('listitem').count()
  expect(n).toBeGreaterThan(10)
  expect(n).toBeLessThan(60)
  await page.screenshot({ path: process.env.SHOT ?? 'test-results/library.png' })
  expect(errors).toEqual([])
})
