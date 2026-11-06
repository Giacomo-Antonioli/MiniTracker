import { describe, expect, it, vi } from 'vitest'
import { downloadDataFiles, latestCommit, listDataFiles } from './fetch'

const SHA = 'a'.repeat(40)
const tree = { tree: [{ path: 'Game.gst', type: 'blob' }, { path: 'Faction A.cat', type: 'blob' }, { path: 'README.md', type: 'blob' }, { path: 'dir', type: 'tree' }] }

function fakeFetch(routes: Record<string, () => Response>) {
  return vi.fn(async (url: string | URL | Request) => {
    const key = String(url)
    const hit = Object.keys(routes).find((k) => key.endsWith(k))
    return hit ? routes[hit]() : new Response('nope', { status: 404 })
  }) as unknown as typeof fetch
}

describe('BSData fetch', () => {
  it('reads the latest commit sha', async () => {
    const f = fakeFetch({ '/commits/HEAD': () => new Response(SHA + '\n') })
    expect(await latestCommit('o/r', f)).toBe(SHA)
  })

  it('rejects odd answers and HTTP errors with readable messages', async () => {
    await expect(latestCommit('o/r', fakeFetch({ '/commits/HEAD': () => new Response('<html>') }))).rejects.toThrow(/Unexpected answer/)
    await expect(latestCommit('o/r', fakeFetch({}))).rejects.toThrow(/HTTP 404/)
  })

  it('lists only .gst and .cat files', async () => {
    const f = fakeFetch({ [`/git/trees/${SHA}`]: () => Response.json(tree) })
    expect(await listDataFiles('o/r', SHA, f)).toEqual(['Game.gst', 'Faction A.cat'])
  })

  it('accepts JSON repositories (wh40k-11e)', async () => {
    const f = fakeFetch({ [`/git/trees/${SHA}`]: () => Response.json({ tree: [{ path: 'Warhammer 40,000.json', type: 'blob' }, { path: "T'au Empire.json", type: 'blob' }, { path: '.github', type: 'tree' }] }) })
    expect(await listDataFiles('o/r', SHA, f)).toEqual(['Warhammer 40,000.json', "T'au Empire.json"])
  })

  it('keeps only the 2024 Kill Team files from a repository with several editions (#99)', async () => {
    const files = ['2021 - Kill Team.gst', '2021 - Kasrkin.cat', '2024 - Kill Team.gst', '2024 - Kasrkin.cat', 'Warhammer 40,000 Kill Team.gst']
    const f = fakeFetch({ [`/git/trees/${SHA}`]: () => Response.json({ tree: files.map((path) => ({ path, type: 'blob' })) }) })
    expect(await listDataFiles('BSData/wh40k-killteam', SHA, f)).toEqual(['2024 - Kill Team.gst', '2024 - Kasrkin.cat'])
  })

  it('fails if the game system file is missing', async () => {
    const f = fakeFetch({ [`/git/trees/${SHA}`]: () => Response.json({ tree: [{ path: 'x.cat', type: 'blob' }] }) })
    await expect(listDataFiles('o/r', SHA, f)).rejects.toThrow(/game system/)
  })

  it('downloads every file at the pinned commit and reports progress', async () => {
    const f = fakeFetch({
      [`/git/trees/${SHA}`]: () => Response.json(tree),
      [`/${SHA}/Game.gst`]: () => new Response('<gst/>'),
      [`/${SHA}/Faction%20A.cat`]: () => new Response('<cat/>'),
    })
    const progress: [number, number][] = []
    const files = await downloadDataFiles('o/r', SHA, (d, t) => progress.push([d, t]), f)
    expect(files).toEqual([{ name: 'Game.gst', text: '<gst/>' }, { name: 'Faction A.cat', text: '<cat/>' }])
    expect(progress[0]).toEqual([0, 2])
    expect(progress.at(-1)).toEqual([2, 2])
  })
})
