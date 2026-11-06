import { expect, test } from '@playwright/test'

test('share collection: a read-only link opens on another device without changing it (#97)', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'one run is enough')
  const state = { cookies: [], origins: [{ origin: 'http://localhost:4173', localStorage: [{ name: 'startPage', value: 'backlog' }] }] }
  const me = await (await browser.newContext({ storageState: state })).newPage()
  await me.goto('./')
  await me.getByRole('button', { name: '+ Add unit' }).click()
  const d = me.getByRole('dialog', { name: 'Add unit' })
  await d.getByLabel('Name *').fill('Rhino')
  await d.getByRole('button', { name: 'Save' }).click()
  await me.getByRole('button', { name: 'Stats' }).click()
  await me.getByRole('button', { name: '🔗 Share' }).click()
  await me.getByLabel('Your name (shown on the page)').fill('Ana')
  await expect(me.getByLabel('Share link')).toHaveValue(/#view=/)
  const url = await me.getByLabel('Share link').inputValue()

  const friend = await (await browser.newContext({ storageState: state })).newPage()
  await friend.goto(url)
  await expect(friend.getByRole('heading', { name: "Ana's collection" })).toBeVisible()
  await expect(friend.getByRole('cell', { name: 'Rhino' })).toBeVisible()
  await friend.getByRole('button', { name: 'Open my MiniTracker' }).click()
  await expect(friend.getByText('Rhino')).toHaveCount(0)
  expect(friend.url()).not.toContain('#view=')
})
