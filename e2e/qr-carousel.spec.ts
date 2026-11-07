import { expect, test, type Page } from '@playwright/test'

async function addUnit(page: Page, name: string) {
  await page.getByRole('button', { name: '+ Add unit' }).click()
  const d = page.getByRole('dialog', { name: 'Add unit' })
  await d.getByLabel('Name *').fill(name)
  await d.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('cell', { name })).toBeVisible()
}

// The receiver's camera is replaced by a canvas that plays the sender's real QR frames.
test('QR carousel moves data from one device to another with no network', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'one run is enough')
  test.setTimeout(90_000)
  const state = { cookies: [], origins: [{ origin: 'http://localhost:4173', localStorage: [{ name: 'startPage', value: 'backlog' }, { name: 'welcomeDone', value: '1' }] }] }
  const pc = await (await browser.newContext({ storageState: state })).newPage()
  const phone = await (await browser.newContext({ storageState: state })).newPage()
  await pc.goto('./')
  for (const n of ['Rhino', 'Predator', 'Land Raider']) await addUnit(pc, n)
  await phone.goto('./')
  await addUnit(phone, 'Termagants')

  // collect every frame the sender shows
  await pc.getByRole('button', { name: '⇄ Sync' }).click()
  await pc.getByRole('button', { name: '▶ Show QR carousel' }).click()
  const sender = pc.getByRole('dialog', { name: 'QR carousel: send' })
  await sender.getByLabel('Speed').selectOption('fast')
  await expect(sender.getByRole('status')).toContainText('of')
  const total = Number((await sender.getByRole('status').innerText()).match(/of (\d+)/)![1])
  const frames = new Map<number, string>()
  while (frames.size < total) {
    const n = Number((await sender.getByRole('status').innerText()).match(/Frame (\d+)/)![1])
    const svg = await sender.getByLabel('QR frame').innerHTML()
    if (svg && !frames.has(n)) frames.set(n, svg)
    await pc.waitForTimeout(40)
  }

  // fake camera on the other device, playing the frames in a loop
  await phone.evaluate((svgs: string[]) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 640
    const ctx = canvas.getContext('2d')!
    const imgs = svgs.map((s) => {
      const img = new Image()
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s)
      return img
    })
    let i = 0
    setInterval(() => {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, 640, 640)
      if (imgs[i].complete) ctx.drawImage(imgs[i], 20, 20, 600, 600)
      i = (i + 1) % imgs.length
    }, 120)
    navigator.mediaDevices.getUserMedia = async () => canvas.captureStream(15)
  }, [...frames.keys()].sort((a, b) => a - b).map((k) => frames.get(k)!))

  await phone.getByRole('button', { name: '⇄ Sync' }).click()
  await phone.getByRole('button', { name: '📷 Read QR carousel' }).click()
  const apply = phone.getByRole('dialog', { name: 'Apply the sync file?' })
  await expect(apply).toBeVisible({ timeout: 60_000 })
  await expect(apply.getByRole('table', { name: 'Changes' })).toContainText('Units3')
  await apply.getByRole('button', { name: 'Apply' }).click()
  await phone.getByRole('button', { name: 'Backlog' }).click()
  for (const n of ['Rhino', 'Predator', 'Land Raider', 'Termagants']) await expect(phone.getByRole('cell', { name: n })).toBeVisible()
})
