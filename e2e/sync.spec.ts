import { expect, test, type Page } from '@playwright/test'

async function addUnit(page: Page, name: string) {
  await page.getByRole('button', { name: '+ Add unit' }).click()
  const d = page.getByRole('dialog', { name: 'Add unit' })
  await d.getByLabel('Name *').fill(name)
  await d.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('cell', { name })).toBeVisible()
}

// Two separate browser profiles = two devices; private mode needs no relay, so this runs offline.
test('two devices sync both ways over a direct connection (private mode)', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'one run is enough')
  const state = { cookies: [], origins: [{ origin: 'http://localhost:4173', localStorage: [{ name: 'startPage', value: 'backlog' }] }] }
  const pc = await (await browser.newContext({ storageState: state })).newPage()
  const phone = await (await browser.newContext({ storageState: state })).newPage()
  for (const [p, name] of [[pc, 'Rhino'], [phone, 'Termagants']] as const) {
    await p.goto('./')
    await addUnit(p, name)
    await p.getByRole('button', { name: '⇄ Sync' }).click()
    await p.getByText('Private mode (no relay)').click()
  }

  await pc.getByRole('button', { name: 'Start here' }).click()
  const offer = await pc.getByLabel("This device's connection text").inputValue()
  await phone.getByLabel('Connection text from the other device').fill(offer)
  await phone.getByRole('button', { name: 'Reply' }).click()
  const answer = await phone.getByLabel("This device's connection text").inputValue()
  await pc.getByLabel('Reply from the other device').fill(answer)
  await pc.getByRole('button', { name: 'Connect' }).click()

  await phone.getByRole('dialog', { name: 'Accept this sync?' }).getByRole('button', { name: 'Accept' }).click()
  for (const p of [pc, phone]) await p.getByRole('dialog', { name: 'Apply these changes?' }).getByRole('button', { name: 'Apply' }).click()
  for (const p of [pc, phone]) {
    await expect(p.getByText(/✓ Synced with/)).toBeVisible({ timeout: 15_000 })
    await p.getByRole('button', { name: 'Backlog' }).click()
    await expect(p.getByRole('cell', { name: 'Rhino' })).toBeVisible()
    await expect(p.getByRole('cell', { name: 'Termagants' })).toBeVisible()
  }
})
