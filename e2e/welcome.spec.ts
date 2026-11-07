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
  // Step 5 is a guided tour: it starts by itself; closing it shows the step in the guide.
  await expect(page.locator('.driver-popover')).toContainText('The Backlog')
  await page.locator('.driver-popover-close-btn').click()
  await expect(guide.getByRole('region', { name: 'Units' })).toContainText('Spearhead box')

  // "Open the Backlog" pauses the guide on the page; "Back to the guide" resumes at the same step.
  await guide.getByRole('button', { name: 'Open the Backlog' }).click()
  await expect(guide).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Backlog' })).toBeVisible()
  await page.getByRole('button', { name: /Back to the guide \(5\/9\)/ }).click()
  await expect(guide.getByRole('region', { name: 'Units' })).toBeVisible()
  await guide.getByRole('button', { name: 'Next' }).click()
  await expect(page.locator('.driver-popover')).toContainText('Your paints')
  await page.keyboard.press('Escape')
  await expect(guide.getByRole('region', { name: 'Paints' })).toContainText('Colour match')
  await guide.getByRole('button', { name: /9\. Find your way/ }).click()
  await expect(page.locator('.driver-popover')).toContainText('Home')
  await page.keyboard.press('Escape')
  await guide.getByRole('button', { name: 'Start using MiniTracker' }).click()
  await expect(guide).toBeHidden()
  await expect(page.getByRole('status', { name: 'Welcome guide paused' })).toBeHidden()
})

test('tour steps run a guided tour over a demo collection, chain on, and put your data back', async ({ page }) => {
  await page.goto('./')
  const guide = page.getByRole('dialog', { name: 'Welcome to MiniTracker' })
  await guide.getByRole('button', { name: /5\. Units/ }).click()
  await expect(guide).toBeHidden()

  const pop = page.locator('.driver-popover')
  await expect(pop).toContainText('The Backlog')
  await expect(pop).toContainText('Your units · 1 / 14')
  // The demo collection is on the page.
  await expect(page.getByText('Intercessor Squad').first()).toBeVisible()
  await pop.getByRole('button', { name: 'Next' }).click()
  await expect(pop).toContainText('Progress at a glance')
  await pop.getByRole('button', { name: 'Back' }).click()
  await expect(pop).toContainText('The Backlog')

  // Closing the tour: the guide comes back on the same step and the demo units are gone.
  await page.locator('.driver-popover-close-btn').click()
  await expect(pop).toBeHidden()
  await expect(guide.getByRole('region', { name: 'Units' })).toBeVisible()
  await expect(page.getByText('Intercessor Squad')).toHaveCount(0)

  // Show me again replays it; Next starts the next tour (Paints → Schemes, across pages).
  await guide.getByRole('button', { name: '▶ Show me again' }).click()
  await expect(pop).toContainText('The Backlog')
  await page.keyboard.press('Escape')
  await guide.getByRole('button', { name: 'Next' }).click()
  await expect(pop).toContainText('Your paints')
  for (let i = 0; i < 7; i++) await pop.getByRole('button', { name: 'Next' }).click()
  await expect(pop).toContainText('Your own scheme')
  await expect(page.getByRole('heading', { name: 'Schemes' })).toBeVisible()
  // Done goes straight into the next tour (Workshop).
  await pop.getByRole('button', { name: 'Done' }).click()
  await expect(pop).toContainText('Tools')
  await page.locator('.driver-popover-close-btn').click()
  await expect(guide.getByRole('region', { name: 'Workshop' })).toBeVisible()
})

test('Enter and Space go one step at a time, in the guide and in a tour', async ({ page }) => {
  await page.goto('./')
  const guide = page.getByRole('dialog', { name: 'Welcome to MiniTracker' })
  await expect(guide.getByRole('region', { name: 'Welcome' })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(guide.getByRole('region', { name: 'Your games' })).toBeVisible()
  await page.keyboard.press(' ')
  await expect(guide.getByRole('region', { name: 'Look' })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(guide.getByRole('region', { name: 'Your data' })).toBeVisible()
  await page.keyboard.press('Enter')
  // Step 5 is the Units tour: Enter and Space move one tour step each, not to the next guide step.
  const pop = page.locator('.driver-popover')
  await expect(pop).toContainText('Your units · 1 / 14')
  await page.keyboard.press('Enter')
  await expect(pop).toContainText('Your units · 2 / 14')
  await page.keyboard.press(' ')
  await expect(pop).toContainText('Your units · 3 / 14')
})
