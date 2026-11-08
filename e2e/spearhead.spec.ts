import { expect, test } from '@playwright/test'

// Age of Sigmar from a faked GitHub: a tiny BSData-shaped catalogue with two Sylvaneth units (#99).
const SHA = 'c'.repeat(40)
const ch = (name: string, v: string) => ({ name, typeId: name, '#text': v })
const files: Record<string, object> = {
  'aos.json': { gameSystem: { id: 'g', name: 'Age of Sigmar 4.0', costTypes: [{ id: 'points', name: 'pts' }] } },
  'syl.json': {
    catalogue: {
      id: 'syl', name: 'Sylvaneth', library: false,
      selectionEntries: [
        { type: 'unit', id: 'bw', name: 'Branchwych', profiles: [{ id: 'p1', name: 'Branchwych', typeName: 'Unit', characteristics: [ch('Move', '6"')] }] },
        { type: 'unit', id: 'kh1', name: 'Kurnoth Hunters with Kurnoth Scythes' },
        { type: 'unit', id: 'kh2', name: 'Kurnoth Hunters with Kurnoth Greatbows' },
      ],
    },
  },
}

test('Spearhead box: pick an army, choose a build, add its units to the backlog', async ({ page }) => {
  await page.route('https://api.github.com/repos/BSData/age-of-sigmar-4th/commits/HEAD', (r) => r.fulfill({ body: SHA }))
  await page.route(`https://api.github.com/repos/BSData/age-of-sigmar-4th/git/trees/${SHA}`, (r) => r.fulfill({ json: { tree: Object.keys(files).map((path) => ({ path, type: 'blob' })) } }))
  await page.route(`https://raw.githubusercontent.com/BSData/age-of-sigmar-4th/${SHA}/**`, (r) => r.fulfill({ json: files[r.request().url().split('/').at(-1)!] }))
  await page.goto('./')
  await page.getByRole('button', { name: /Settings/ }).click()
  await page.getByRole('button', { name: 'Download Age of Sigmar 4th edition' }).click()
  await expect(page.getByRole('region', { name: 'Catalogue Age of Sigmar 4th edition' })).toContainText('3 units')

  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Backlog' }).click()
  await page.getByRole('button', { name: '⚔ Spearhead box' }).click()
  const dialog = page.getByRole('dialog', { name: 'Spearhead box' })
  await dialog.getByLabel('Faction').selectOption('Sylvaneth')
  await dialog.getByLabel('Army').selectOption({ label: 'Bitterbark Copse' })
  const contents = dialog.getByRole('list', { name: 'Box contents' })
  await expect(contents).toContainText('Branchwych')
  await expect(contents).toContainText('Treelord · not in the catalogue')
  await dialog.getByLabel('Build of Kurnoth Hunters').selectOption({ label: 'Kurnoth Hunters with Kurnoth Greatbows' })
  await dialog.getByRole('button', { name: 'Add 4 units to the backlog' }).click()
  await expect(dialog.getByRole('status')).toHaveText('Added 4 units from Bitterbark Copse to the backlog.')
  // Wishlisted models are not owned yet.
  await expect(contents).not.toContainText('you own')
  await dialog.getByRole('button', { name: /close/i }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('cell', { name: 'Kurnoth Hunters with Kurnoth Greatbows' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Tree-Revenants' })).toBeVisible()
})
