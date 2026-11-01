import { expect, test, type Page } from '@playwright/test'

async function addUnit(page: Page, name: string, faction: string, groups: [number, string][]) {
  await page.getByRole('button', { name: '+ Add unit' }).click()
  const d = page.getByRole('dialog', { name: 'Add unit' })
  await d.getByLabel('Name *').fill(name)
  await d.getByLabel('Faction').fill(faction)
  for (const [i, [count, stage]] of groups.entries()) {
    if (i > 0) await d.getByRole('button', { name: '+ Add group' }).click()
    await d.getByLabel('Models').nth(i).fill(String(count))
    await d.getByLabel('Stage').nth(i).selectOption(stage)
  }
  await d.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('cell', { name: name })).toBeVisible()
}

test('collector flow: add units, paint some, data survives reload', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./')
  await expect(page.getByText('Your backlog is empty')).toBeVisible()

  await addUnit(page, 'Intercessor Squad', 'Ultramarines', [[6, 'built'], [4, 'painted']])
  await addUnit(page, 'Termagants', 'Tyranids', [[20, 'sprue']])
  await expect(page.getByRole('region', { name: 'Summary' })).toContainText('Painted 4 / 30 models')

  await page.getByRole('cell', { name: 'Intercessor Squad' }).click()
  await page.getByRole('button', { name: 'Move…' }).first().click()
  const move = page.getByRole('dialog', { name: 'Move models' })
  await move.getByLabel('How many', { exact: true }).fill('6')
  await move.getByLabel('To stage').selectOption('painted')
  await move.getByLabel('Note').fill('Squad done!')
  await move.getByRole('button', { name: 'Move', exact: true }).click()
  await expect(page.getByText('Squad done!')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Summary' })).toContainText('Painted 10 / 30 models')

  await page.reload()
  await expect(page.getByRole('cell', { name: 'Termagants' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Summary' })).toContainText('Painted 10 / 30 models')
  expect(errors).toEqual([])
})

test('theme switch is remembered', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: /Settings/ }).click()
  await page.getByLabel('Theme').selectOption('forum2005')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'forum2005')
})

test('backup: export then restore after deleting', async ({ page }, info) => {
  page.on('dialog', (d) => d.accept())
  await page.goto('./')
  await addUnit(page, 'Backup Squad', 'Ultramarines', [[5, 'built']])
  await page.getByRole('button', { name: /Settings/ }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download backup/ }).click()])
  const file = info.outputPath('backup.json')
  await download.saveAs(file)

  await page.getByRole('button', { name: 'Backlog', exact: true }).click()
  await page.getByRole('cell', { name: 'Backup Squad' }).click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Your backlog is empty')).toBeVisible()

  await page.getByRole('button', { name: /Settings/ }).click()
  await page.getByLabel('Backup file').setInputFiles(file)
  await expect(page.getByText('Restored 1 units.')).toBeVisible()
  await page.getByRole('button', { name: 'Backlog', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'Backup Squad' })).toBeVisible()
})
