import type { SourceFile } from './bsdata'

/** Where the 40k data lives. The daily CI check (bsdata-check.yml) verifies this still works. */
export const BSDATA_40K = { repo: 'BSData/wh40k-10e' } as const

type Fetch = typeof fetch

async function ok(res: Response, what: string): Promise<Response> {
  if (!res.ok) throw new Error(`Could not ${what} (HTTP ${res.status})`)
  return res
}

/** Latest commit SHA of the repo's default branch. */
export async function latestCommit(repo: string, f: Fetch = fetch): Promise<string> {
  const res = await ok(await f(`https://api.github.com/repos/${repo}/commits/HEAD`, { headers: { Accept: 'application/vnd.github.sha' } }), 'reach BSData on GitHub')
  const sha = (await res.text()).trim()
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('Unexpected answer from GitHub when checking for updates')
  return sha
}

/** Data file paths (.gst and .cat) at a commit. */
export async function listDataFiles(repo: string, commit: string, f: Fetch = fetch): Promise<string[]> {
  const res = await ok(await f(`https://api.github.com/repos/${repo}/git/trees/${commit}`), 'list the BSData files')
  const tree = (await res.json()) as { tree?: { path: string; type: string }[] }
  const paths = (tree.tree ?? []).filter((t) => t.type === 'blob' && /\.(gst|cat)$/.test(t.path)).map((t) => t.path)
  if (!paths.some((p) => p.endsWith('.gst'))) throw new Error('The BSData repository no longer contains a game system file')
  return paths
}

/** Download all data files at a commit. Reports progress as (done, total). */
export async function downloadDataFiles(
  repo: string,
  commit: string,
  onProgress: (done: number, total: number) => void = () => {},
  f: Fetch = fetch,
): Promise<SourceFile[]> {
  const paths = await listDataFiles(repo, commit, f)
  let done = 0
  onProgress(0, paths.length)
  return Promise.all(
    paths.map(async (path) => {
      const url = `https://raw.githubusercontent.com/${repo}/${commit}/${path.split('/').map(encodeURIComponent).join('/')}`
      const text = await (await ok(await f(url), `download ${path}`)).text()
      onProgress(++done, paths.length)
      return { name: path, text }
    }),
  )
}
