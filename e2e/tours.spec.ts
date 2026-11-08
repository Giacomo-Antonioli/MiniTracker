import { expect, test } from '@playwright/test'

// Every guided tour of the welcome guide, end to end: each step finds its element, the mocks (add a unit, add a
// tool and a place, run a game) work, and the guide ends on its last step with the user's data untouched.
test.use({ storageState: { cookies: [], origins: [] } })

test('walk every guided tour, mocks included', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one run is enough')
  test.setTimeout(120_000)
  const problems: string[] = []
  page.on('console', (m) => m.text().startsWith('Tour step without') && problems.push(m.text()))
  page.on('pageerror', (e) => problems.push(e.message))
  await page.goto('./')
  const guide = page.getByRole('dialog', { name: 'Welcome to MiniTracker' })
  await guide.getByRole('button', { name: /5\. Units/ }).click()
  const pop = page.locator('.driver-popover')
  const titles: string[] = []
  for (let n = 0; n < 80; n++) {
    try {
      await pop.waitFor({ state: 'visible', timeout: 10_000 })
    } catch {
      break
    }
    titles.push((await pop.locator('.driver-popover-title').textContent()) ?? '')
    // One locator for both, so a re-render between a check and the click cannot leave us waiting for the wrong button.
    await pop.getByRole('button', { name: /^(Next|Done)$/ }).click()
  }
  expect(problems).toEqual([])
  for (const t of ['There it is', 'Unit details', 'Added', 'Put units in it', 'Playing', 'Score', 'End the game', 'Settings']) expect(titles).toContain(t)
  await expect(guide.getByRole('region', { name: 'Find your way' })).toBeVisible()
  // The demo is gone: the Backlog is the user's (empty) one again.
  await guide.getByRole('button', { name: 'Start using MiniTracker' }).click()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Backlog' }).click()
  await expect(page.getByText('Hellblaster Squad')).toHaveCount(0)
  await expect(page.getByText('Intercessor Squad')).toHaveCount(0)
})
