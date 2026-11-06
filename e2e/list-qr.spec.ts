import { expect, test } from '@playwright/test'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(process.cwd(), 'src/data/catalogue/fixtures')
const files = readdirSync(dir).map((f) => join(dir, f))

// The opponent shows their list as QR codes; my device reads it with a fake camera playing those frames (#193).
test('opponent list by QR: Export › Show as QR, then New game › Read QR', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'one run is enough')
  test.setTimeout(90_000)
  const them = await (await browser.newContext()).newPage()
  const me = await (await browser.newContext()).newPage()

  await them.goto('./')
  await them.getByRole('button', { name: /Settings/ }).click()
  await them.getByLabel('Catalogue files').setInputFiles(files)
  await expect(them.getByRole('region', { name: 'Catalogue Test Game' })).toContainText('5 units')
  await them.evaluate(
    () =>
      new Promise<void>((done, fail) => {
        const req = indexedDB.open('minitracker')
        req.onerror = () => fail(req.error)
        req.onsuccess = () => {
          const tx = req.result.transaction('lists', 'readwrite')
          tx.objectStore('lists').put({ id: 'L1', name: 'Marco Walkers', edition: '11e', battleSize: 'bs', pointsLimit: 1000, status: 'planned', detachmentIds: [], entries: [{ id: 'e1', datasheetId: 'u-walker', models: 1, wargear: [] }], createdAt: 't', updatedAt: 't' })
          tx.oncomplete = () => done()
          tx.onerror = () => fail(tx.error)
        }
      }),
  )
  await them.reload()
  await them.getByRole('button', { name: 'Armies' }).click()
  await them.getByText('Marco Walkers').first().click()
  await them.getByText('⬇ Export').click()
  await them.getByRole('button', { name: '📱 Show as QR' }).click()
  const sender = them.getByRole('dialog', { name: 'QR: Marco Walkers' })
  await sender.getByLabel('Speed').selectOption('fast')
  await expect(sender.getByRole('status')).toContainText('of')
  const total = Number((await sender.getByRole('status').innerText()).match(/of (\d+)/)![1])
  const frames = new Map<number, string>()
  while (frames.size < total) {
    const n = Number((await sender.getByRole('status').innerText()).match(/Frame (\d+)/)![1])
    const svg = await sender.getByLabel('QR frame').innerHTML()
    if (svg && !frames.has(n)) frames.set(n, svg)
    await them.waitForTimeout(40)
  }

  await me.goto('./')
  await me.evaluate((svgs: string[]) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 640
    const ctx = canvas.getContext('2d')!
    const imgs = svgs.map((s) => Object.assign(new Image(), { src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s) }))
    let i = 0
    setInterval(() => {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, 640, 640)
      if (imgs[i].complete) ctx.drawImage(imgs[i], 20, 20, 600, 600)
      i = (i + 1) % imgs.length
    }, 120)
    navigator.mediaDevices.getUserMedia = async () => canvas.captureStream(15)
  }, [...frames.keys()].sort((a, b) => a - b).map((k) => frames.get(k)!))
  await me.getByRole('button', { name: 'Games' }).click()
  await me.getByRole('button', { name: '▶ New game' }).click()
  await me.getByRole('button', { name: '📷 Read QR' }).click()
  await expect(me.getByLabel('Their list', { exact: true })).toContainText('Marco Walkers: 1 units', { timeout: 60_000 })
})
