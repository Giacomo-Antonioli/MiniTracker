import { expect, test } from '@playwright/test'

test('dice roller: 3D dice roll hits, then wounds (#191)', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./')
  await page.getByRole('button', { name: 'Games' }).click()
  await page.getByRole('button', { name: '▶ New game' }).click()
  await page.getByRole('button', { name: '▶ Start game' }).click()
  await page.getByRole('button', { name: '🎲 Dice' }).click()
  const roller = page.getByRole('dialog', { name: 'Dice roller' })
  await roller.getByRole('button', { name: 'Roll 10D6' }).click()
  // 3D when the browser has WebGL, else the quick fallback: either way 10 results.
  await expect(roller.getByLabel('Dice results').locator('span')).toHaveCount(10, { timeout: 30_000 })
  await expect(roller.getByText(/\d+ hits of 10/)).toBeVisible()
  await page.screenshot({ path: process.env.SHOT ?? 'test-results/dice.png' })
  const next = roller.getByRole('button', { name: /Wound roll with/ })
  if (await next.isEnabled()) {
    await next.click()
    await expect(roller.getByRole('listitem').filter({ hasText: 'Wound' })).toHaveAttribute('aria-current', 'step')
  }
  await roller.getByRole('button', { name: 'Close dice roller' }).click()
  await expect(roller).toHaveCount(0)
  expect(errors).toEqual([])
})
