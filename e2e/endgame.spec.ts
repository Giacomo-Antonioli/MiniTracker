import { expect, test } from '@playwright/test'

test('ending a game closes the live game and shows it in history', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./')
  await page.getByRole('button', { name: 'Games' }).click()
  await page.getByRole('button', { name: '▶ New game' }).click()
  await page.getByRole('button', { name: '▶ Start game' }).click()
  await page.getByRole('button', { name: 'Next turn ▶' }).click()
  await page.getByRole('button', { name: 'Next turn ▶' }).click()
  await page.getByRole('button', { name: 'End game' }).click()
  await page.getByRole('dialog', { name: 'End game' }).getByRole('button', { name: 'Save game' }).click()
  await page.screenshot({ path: process.env.SHOT ?? 'test-results/endgame.png' })
  await expect(page.getByRole('button', { name: 'Next turn ▶' })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('discard a game at the end, delete a finished game from history', async ({ page }) => {
  page.on('dialog', (d) => void d.accept())
  await page.goto('./')
  await page.getByRole('button', { name: 'Games' }).click()
  for (const action of ['Save game', 'Discard game']) {
    await page.getByRole('button', { name: '▶ New game' }).click()
    await page.getByRole('button', { name: '▶ Start game' }).click()
    await page.getByRole('button', { name: 'End game' }).click()
    await page.getByRole('dialog', { name: 'End game' }).getByRole('button', { name: action }).click()
    await expect(page.getByRole('button', { name: 'Next turn ▶' })).toHaveCount(0)
  }
  const history = page.getByRole('region', { name: 'Game history' })
  await expect(history.getByRole('row')).toHaveCount(2)
  await history.getByRole('button', { name: /Delete game vs/ }).click()
  await expect(page.getByText('No finished games yet.')).toBeVisible()
})
