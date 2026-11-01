import { expect, test } from '@playwright/test'

// The real, minified bookmarklet from the built app, run on a fake recipe site.
test('bookmarklet sends a recipe page to MiniTracker', async ({ page, context }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Schemes' }).click()
  await page.getByRole('button', { name: /Add from link/ }).click()
  await page.getByText(/Send recipes from any site/).click()
  const code = await page.getByRole('link', { name: /Send to MiniTracker/ }).getAttribute('href')
  expect(code?.startsWith('javascript:')).toBe(true)

  await context.route('https://recipes.example/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<html><head><title>T'au Vior'la</title><meta name="author" content="Jane"><meta property="og:site_name" content="Recipes Example"></head>
      <body><nav><ul><li>Home</li><li>Shop</li></ul></nav>
      <article><h1>How to paint Vior'la</h1><p>Some history about the sept.</p>
      <h2>Armour</h2><ol><li>Prime with Grey Seer.</li><li>Wash with Nuln Oil.</li><li>Edge highlight with White Scar.</li></ol>
      <h2>Markings</h2><p>Paint the symbols with Mephiston Red.</p><p>Thanks for reading!</p></article></body></html>`,
    }),
  )
  const recipePage = await context.newPage()
  await recipePage.goto('https://recipes.example/tau')
  const [app] = await Promise.all([context.waitForEvent('page'), recipePage.evaluate((c) => new Function(c!.slice('javascript:'.length))(), code)])

  const d = app.getByRole('dialog', { name: 'Recipe from page' })
  await expect(d.getByRole('region', { name: 'Draft preview' })).toContainText('4 steps in 2 areas')
  await expect(d.getByLabel('Title')).toHaveValue("T'au Vior'la")
  await d.getByLabel('Faction').fill("T'au Empire")
  await d.getByRole('button', { name: 'Create scheme' }).click()
  const editor = app.getByRole('region', { name: 'Scheme editor' })
  await expect(editor.getByLabel('Scheme name')).toHaveValue("T'au Vior'la")
  await expect(editor).toContainText('Community')
  await expect(editor.getByLabel('Source link')).toHaveValue('https://recipes.example/tau')
})
