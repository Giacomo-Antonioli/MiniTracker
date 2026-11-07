import { expect, test } from '@playwright/test'

// Every other spec starts with the guide done; this one starts like a brand-new user.
test.use({ storageState: { cookies: [], origins: [] } })

test('welcome guide on first start: walk through, skip, reopen from Settings', async ({ page }) => {
  await page.goto('./')
  const guide = page.getByRole('dialog', { name: 'Welcome to MiniTracker' })
  await expect(guide).toBeVisible()
  await guide.getByRole('button', { name: 'Next' }).click()
  await expect(guide.getByRole('region', { name: 'Your games' })).toContainText('Middle-earth Strategy Battle Game')
  await guide.getByRole('button', { name: 'Next' }).click()
  await guide.getByLabel('Text and interface size').focus()
  await page.keyboard.press('ArrowRight')
  await guide.getByRole('button', { name: 'Next' }).click()
  await expect(guide.getByRole('button', { name: /Restore a backup/ })).toBeVisible()
  await guide.getByRole('button', { name: 'Skip guide' }).click()
  await expect(guide).toBeHidden()

  // Done: not shown again after a reload.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Welcome to MiniTracker' }).first()).toBeVisible() // Home's empty state
  await expect(guide).toBeHidden()

  // Settings › Appearance › Show it again, then "Start fresh" goes to the Backlog.
  await page.getByRole('button', { name: /Settings/ }).click()
  await page.getByRole('tab', { name: /Appearance/ }).click()
  await page.getByRole('button', { name: 'Show it again' }).click()
  await expect(guide).toBeVisible()
  await guide.getByRole('button', { name: /4\. Your data/ }).click()
  await guide.getByRole('button', { name: /Start fresh/ }).click()
  await expect(guide.getByRole('region', { name: 'Units' })).toContainText('Spearhead box')

  // "Open the Backlog" pauses the guide on the page; "Back to the guide" resumes at the same step.
  await guide.getByRole('button', { name: 'Open the Backlog' }).click()
  await expect(guide).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Backlog' })).toBeVisible()
  await page.getByRole('button', { name: /Back to the guide \(5\/9\)/ }).click()
  await expect(guide.getByRole('region', { name: 'Units' })).toBeVisible()
  await guide.getByRole('button', { name: 'Next' }).click()
  await expect(guide.getByRole('region', { name: 'Paints' })).toContainText('Colour match')
  await guide.getByRole('button', { name: /9\. Find your way/ }).click()
  await guide.getByRole('button', { name: 'Start using MiniTracker' }).click()
  await expect(guide).toBeHidden()
  await expect(page.getByRole('status', { name: 'Welcome guide paused' })).toBeHidden()
})
