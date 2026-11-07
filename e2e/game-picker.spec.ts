import { expect, test } from '@playwright/test'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

// Two games installed offline: 40k from the sample BSData files, Middle-earth (#99) from a faked GitHub.
const dir = join(process.cwd(), 'src/data/catalogue/fixtures')
const files = readdirSync(dir).map((f) => join(dir, f))
const SHA = 'b'.repeat(40)
const mesbg: Record<string, object> = {
  'mesbg_data.json': { a: { model_id: '[moria] goblin', army_type: 'Evil', army_list: 'Moria', profile_origin: 'Moria', name: 'Moria Goblin Warrior', unit_type: 'Warrior', base_points: 5, MWFW: [], options: [] } },
  'profile_data.json': { Moria: { 'Moria Goblin Warrior': { Mv: '5"', Fv: '2' } } },
  'army_list_data.json': {},
}

test('game picker in the menu switches the active catalogue', async ({ page }) => {
  await page.route('https://api.github.com/repos/mhollink/mesbg-list-builder-v2024/commits/HEAD', (r) => r.fulfill({ body: SHA }))
  await page.route(`https://raw.githubusercontent.com/mhollink/mesbg-list-builder-v2024/${SHA}/**`, (r) => r.fulfill({ json: mesbg[r.request().url().split('/').at(-1)!] }))
  await page.goto('./')
  const picker = page.getByRole('navigation', { name: 'Main' }).getByLabel('Game')
  await page.getByRole('button', { name: /Settings/ }).click()
  await page.getByLabel('Catalogue files').setInputFiles(files)
  await expect(page.getByRole('region', { name: 'Catalogue Test Game' })).toContainText('5 units')
  await expect(picker).toHaveCount(0)

  await page.getByRole('button', { name: 'Download Middle-earth (2024 edition)' }).click()
  const me = page.getByRole('region', { name: 'Catalogue Middle-earth (2024 edition)' })
  await expect(me).toContainText('1 units in 1 factions')
  await expect(picker.locator('option')).toHaveText(['All games', 'Warhammer 40,000', 'Middle-earth Strategy Battle Game'])

  await picker.selectOption('Warhammer 40,000')
  await expect(page.getByRole('region', { name: 'Catalogue Test Game' })).toContainText('active')
  await picker.selectOption('Middle-earth Strategy Battle Game')
  await expect(me).toContainText('active')
  await page.reload()
  await expect(picker).toHaveValue('mesbg')

  // The other way round: making a 40k edition active in Settings moves the picker to 40k.
  await page.getByRole('button', { name: /Settings/ }).click()
  await page.getByRole('region', { name: 'Catalogue Test Game' }).getByRole('button', { name: 'Use this edition' }).click()
  await expect(picker).toHaveValue('40k')
  await picker.selectOption('all')
  await me.getByRole('button', { name: 'Use this edition' }).click()
  await expect(picker).toHaveValue('all')
})
