import { expect, test } from '@playwright/test'

const shots = process.env.PHONE_SHOTS

test('phone layout: bottom bar, menu, cards, full-screen panel, sync and workshop', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./')
  const quick = page.getByRole('navigation', { name: 'Quick' })
  await expect(quick).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)

  await page.getByRole('button', { name: '+ Add unit' }).click()
  const d = page.getByRole('dialog', { name: 'Add unit' })
  await d.getByLabel('Name *').fill('Intercessor Squad')
  await d.getByLabel('Faction').fill('Ultramarines')
  await d.getByRole('button', { name: 'Save' }).click()
  const card = page.getByRole('list', { name: 'Units' }).getByRole('button', { name: 'Intercessor Squad' })
  await expect(card).toBeVisible()
  if (shots) await page.screenshot({ path: `${shots}/backlog.png` })

  await card.click()
  const panel = page.getByRole('complementary', { name: 'Unit details' })
  await expect(panel).toBeVisible()
  const box = await panel.boundingBox()
  expect(box!.width).toBeGreaterThan(page.viewportSize()!.width - 2)
  if (shots) await page.screenshot({ path: `${shots}/unit.png` })
  await panel.getByRole('button', { name: 'Close details' }).click()

  await page.getByRole('button', { name: 'Menu' }).click()
  const menu = page.getByRole('navigation', { name: 'Main' })
  await expect(menu).toBeVisible()
  if (shots) await page.screenshot({ path: `${shots}/menu.png` })
  await menu.getByRole('button', { name: 'Shopping' }).click()
  await expect(menu).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Shopping' })).toBeVisible()

  await quick.getByRole('button', { name: /Workshop/ }).click()
  await page.getByRole('form', { name: 'New item' }).getByLabel('Name').fill('Sprue cutters')
  await page.getByRole('form', { name: 'New item' }).getByRole('button', { name: '+ Add' }).click()
  await expect(page.getByRole('listitem', { name: 'Tool Sprue cutters' })).toBeVisible()
  if (shots) await page.screenshot({ path: `${shots}/workshop.png` })

  await page.getByRole('button', { name: 'Sync', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sync', exact: true })).toBeVisible()
  if (shots) await page.screenshot({ path: `${shots}/sync.png`, fullPage: true })

  await quick.getByRole('button', { name: /Home/ }).click()
  if (shots) await page.screenshot({ path: `${shots}/home.png` })

  // nothing sticks out sideways
  for (const go of ['Backlog', 'Paints']) {
    await quick.getByRole('button', { name: new RegExp(go) }).click()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, `${go} is wider than the screen`).toBeLessThanOrEqual(1)
    if (shots) await page.screenshot({ path: `${shots}/${go.toLowerCase()}.png` })
  }
  expect(errors).toEqual([])
})
