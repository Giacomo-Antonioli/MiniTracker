import { expect, test } from '@playwright/test'

test('goals page: add a goal, survives reload', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./')
  await page.getByRole('button', { name: 'Goals' }).click()
  await page.getByRole('button', { name: '+ Goal' }).click()
  await page.getByRole('button', { name: 'Save goal' }).click()
  await page.getByRole('button', { name: '+ Goal' }).click()
  await page.getByLabel('Kind').selectOption('streak')
  await page.getByRole('button', { name: 'Save goal' }).click()
  // The form closes once the goal is stored; reloading earlier could lose it.
  await expect(page.getByRole('list', { name: 'Goals' }).getByRole('listitem')).toHaveCount(2)
  await page.reload()
  await page.getByRole('button', { name: 'Goals' }).click()
  await expect(page.getByRole('list', { name: 'Goals' }).getByRole('listitem')).toHaveCount(2)
  await page.screenshot({ path: process.env.SHOT ?? 'test-results/goals.png' })
  expect(errors).toEqual([])
})
