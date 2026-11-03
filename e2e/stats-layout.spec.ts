import { expect, test } from '@playwright/test'

test('stats charts stay inside their cards', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: '+ Add unit' }).click()
  const d = page.getByRole('dialog', { name: 'Add unit' })
  await d.getByLabel('Name *').fill('Squad')
  await d.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('button', { name: 'Stats' }).click()
  for (const width of [1440, 1100, 800]) {
    await page.setViewportSize({ width, height: 900 })
    await page.waitForTimeout(300)
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll('svg[role=img]')].flatMap((svg) => {
        const card = svg.closest('.panel')!.getBoundingClientRect()
        const box = svg.parentElement && getComputedStyle(svg.parentElement).overflowX === 'auto' ? svg.parentElement : svg
        const r = box.getBoundingClientRect()
        return r.right > card.right + 1 || r.left < card.left - 1 ? [svg.getAttribute('aria-label')] : []
      }),
    )
    expect(bad, `at ${width}px`).toEqual([])
  }
})
