/**
 * Live check against the real BSData repository (run daily by .github/workflows/bsdata-check.yml).
 * Verifies the link still works, the files are where the app expects them, and the parser still reads real data.
 * Run locally with: npm run check:bsdata
 */
import { describe, expect, it } from 'vitest'
import { parseBsData, type SourceFile } from '../src/data/catalogue/bsdata'
import { EDITIONS, downloadDataFiles, latestCommit } from '../src/data/catalogue/fetch'

// In CI, authenticate GitHub API calls to avoid shared-runner rate limits.
const token = process.env.GITHUB_TOKEN
const f: typeof fetch = (url, init) =>
  fetch(url, token && String(url).startsWith('https://api.github.com') ? { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` } } : init)

describe.each(EDITIONS)('BSData live check ($label, $repo)', (edition) => {
  let commit = ''
  let files: SourceFile[] = []

  it('the repository is reachable and has a latest commit', async () => {
    commit = await latestCommit(edition.repo, f)
    expect(commit).toMatch(/^[0-9a-f]{40}$/)
  })

  it('the data files download at that commit', async () => {
    files = await downloadDataFiles(edition.repo, commit, undefined, f)
    // 10th edition: .gst + .cat XML; 11th edition: the same data as .json.
    expect(files.length).toBeGreaterThanOrEqual(30)
    for (const file of files) expect(/^\s*(<\?xml|\{)/.test(file.text), file.name).toBe(true)
  })

  it('the parser still reads real data correctly', () => {
    const c = parseBsData(files, { repo: edition.repo, commit, fetchedAt: new Date().toISOString() })
    expect(c.gameName).toMatch(/Warhammer 40,000/)
    expect(c.factions.length).toBeGreaterThanOrEqual(25)
    expect(c.datasheets.length).toBeGreaterThanOrEqual(1000)

    // A long-lived reference unit: shape must stay sane even if points change.
    const intercessors = c.datasheets.find((d) => d.name === 'Intercessor Squad')
    expect(intercessors).toBeDefined()
    expect(intercessors).toMatchObject({ minModels: 5, maxModels: 10, role: 'Battleline' })
    expect(intercessors!.points[0].points).toBeGreaterThan(0)

    // Rules (catalogue format 2): core rules with text, and units linked to them.
    expect(c.rules!.filter((r) => r.kind === 'core' && r.text).length).toBeGreaterThanOrEqual(25)
    expect(c.rules!.length).toBeGreaterThanOrEqual(200)
    expect(intercessors!.ruleIds?.length).toBeGreaterThan(0)
    expect(Object.keys(intercessors!.abilityTexts ?? {}).length).toBeGreaterThan(0)

    const unpriced = c.datasheets.filter((d) => d.points[0].points === 0).length / c.datasheets.length
    expect(unpriced, 'share of units without points').toBeLessThan(0.05)
  })
}, 120_000)
