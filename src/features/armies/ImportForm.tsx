import { useState } from 'react'
import { catalogueFor, ctx, useStore } from '../../app/store'
import { EDITIONS } from '../../data/catalogue/fetch'
import { readRoster } from '../../data/lists/rosz'
import { listFromJson, listFromRoster, listFromText, type ImportResult } from '../../domain/lists/io'
import type { EditionKey } from '../../domain/lists/types'
import type { Catalogue } from '../../domain/catalogue/types'
import { useTx } from '../../i18n'

/** A list from a file: BattleScribe / NewRecruit .rosz/.ros, MiniTracker .json or text. */
export async function importListFile(f: File, cat: Catalogue, edition: EditionKey): Promise<ImportResult> {
  const name = f.name.toLowerCase()
  if (name.endsWith('.json')) return listFromJson(await f.text(), ctx())
  if (name.endsWith('.txt')) return listFromText(await f.text(), cat, edition, ctx())
  return listFromRoster(readRoster(new Uint8Array(await f.arrayBuffer())), cat, edition, ctx())
}

/** Import a list: BattleScribe / NewRecruit .rosz/.ros, MiniTracker .json, or text (file or pasted). */
export function ImportForm({ onCancel, onOpen }: { onCancel: () => void; onOpen: (id: string) => void }) {
  const tx = useTx()
  const { catalogues, catalogue: active, saveList } = useStore()
  const installed = EDITIONS.filter((e) => catalogueFor(catalogues, e.key))
  const [edition, setEdition] = useState<EditionKey | undefined>(installed.find((e) => catalogueFor(catalogues, e.key) === active)?.key ?? installed[0]?.key)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState<ImportResult | null>(null)
  const cat = edition ? catalogueFor(catalogues, edition) : undefined

  const run = async (make: () => Promise<ImportResult> | ImportResult) => {
    setError('')
    try {
      const r = await make()
      await saveList(r.list)
      if (r.warnings.length) setDone(r)
      else onOpen(r.list.id)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const fromFile = (f: File) =>
    run(async () => {
      if (!cat || !edition) throw new Error(tx('Install a catalogue first'))
      return importListFile(f, cat, edition)
    })

  if (done) {
    return (
      <section className="panel grid gap-2 p-3" aria-label={tx('Import result')}>
        <p className="font-semibold">{tx('Imported “{{name}}” with {{n}} units. Check these:', { name: done.list.name, n: done.list.entries.length })}</p>
        <ul className="list-disc pl-5 text-sm">
          {done.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => onOpen(done.list.id)}>{tx('Open list')}</button>
          <button className="btn" onClick={onCancel}>{tx('Close')}</button>
        </div>
      </section>
    )
  }

  return (
    <section className="panel grid gap-3 p-3" aria-label={tx('Import list')}>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          {tx('Match with')}
          <select className="input" value={edition} onChange={(e) => setEdition(e.target.value as EditionKey)}>
            {installed.map((e) => (
              <option key={e.key} value={e.key}>{e.label}</option>
            ))}
          </select>
        </label>
        <label className="btn">
          {tx('📂 Choose file (.rosz, .ros, .json, .txt)')}
          <input
            type="file"
            className="sr-only"
            aria-label={tx('List file')}
            accept=".rosz,.ros,.json,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void fromFile(f)
            }}
          />
        </label>
      </div>
      <label className="grid gap-1 text-sm">
        {tx('…or paste a list (GW app, NewRecruit, MiniTracker text)')}
        <textarea className="input min-h-32 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button
          className="btn btn-primary"
          disabled={!text.trim() || !cat}
          onClick={() => void run(() => listFromText(text, cat!, edition!, ctx()))}
        >
          {tx('Import text')}
        </button>
        <button className="btn" onClick={onCancel}>{tx('Cancel')}</button>
      </div>
    </section>
  )
}
