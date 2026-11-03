import { expect, test } from '@playwright/test'

test('magnet slots: add in the form, show in the table, survive edit', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./')
  await page.getByRole('button', { name: '+ Add unit' }).click()
  const d = page.getByRole('dialog', { name: 'Add unit' })
  await d.getByLabel('Name *').fill('Intercessors')
  await d.getByRole('button', { name: 'Magnets' }).click()
  await d.getByRole('button', { name: '+ Magnet slot' }).click()
  await d.getByLabel('Slot name').fill('arms')
  await d.getByLabel('Options').fill('bolt rifle, auto bolt rifle')
  await page.screenshot({ path: process.env.SHOT ?? 'test-results/magnets.png' })
  await d.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('row', { name: /Intercessors/ }).first()).toContainText('🧲')
  await page.reload()
  await expect(page.getByRole('row', { name: /Intercessors/ }).first()).toContainText('🧲')
  expect(errors).toEqual([])
})
