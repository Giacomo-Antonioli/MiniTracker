import { expect, test } from '@playwright/test'

test('colour match: panel and hex picker', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./')
  await page.getByRole('button', { name: 'Paints' }).click()
  await page.getByPlaceholder(/Search name or brand/).fill('macragge blue')
  await page.getByRole('button', { name: 'Macragge Blue (Citadel)' }).click()
  const panel = page.getByRole('complementary', { name: 'Paint details' })
  await panel.getByRole('button', { name: 'I own it' }).click()
  await panel.getByLabel('Match brand').selectOption('Vallejo')
  await expect(panel.getByRole('list', { name: 'Closest in Vallejo' }).getByRole('listitem')).toHaveCount(5)
  await page.getByRole('button', { name: /Match a colour/ }).click()
  const d = page.getByRole('dialog', { name: 'Match a colour' })
  await d.getByLabel('Colour', { exact: true }).fill('#0d407f')
  await expect(d.getByRole('list', { name: 'Closest you own' })).toContainText('Macragge Blue')
  await page.screenshot({ path: process.env.SHOT ?? 'test-results/colour.png' })
  expect(errors).toEqual([])
})
