import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/settings'
import type { BatchItem, JobProgress } from '@shared/types'
import { BatchStore } from '../src/main/batchStore'
import { OfficeConverter } from '../src/main/convert'
import { History } from '../src/main/history'
import { Preparer } from '../src/main/prepare'
import { PrintRunner } from '../src/main/printRunner'

const isWindows = process.platform === 'win32'

let dir: string
let log: string
let fakeSumatra: string

async function makePdf(name: string, pages: number): Promise<string> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage()
  const path = join(dir, name)
  writeFileSync(path, await doc.save())
  return path
}

function item(path: string, extra: Partial<BatchItem> = {}): BatchItem {
  return {
    id: path,
    path,
    name: path.split('/').pop()!,
    kind: 'pdf',
    enabled: true,
    overrides: {},
    status: 'ready',
    ...extra
  }
}

function waitForIdle(runner: PrintRunner, seen: JobProgress[]): Promise<void> {
  return new Promise((resolve) => {
    const check = () => (seen.length && !runner.state().running ? resolve() : setTimeout(check, 10))
    check()
  })
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bp-run-'))
  log = join(dir, 'calls.log')
  fakeSumatra = join(dir, 'sumatra.sh')
  // Records each call; fails for any file with "bad" in its name.
  writeFileSync(
    fakeSumatra,
    `#!/bin/sh\necho "$@" >> "${log}"\ncase "$*" in *bad*) exit 1;; esac\nexit 0\n`
  )
  chmodSync(fakeSumatra, 0o755)
})

describe.skipIf(isWindows)('PrintRunner', () => {
  it('prints enabled items in order with merged settings and logs history', async () => {
    const store = new BatchStore(join(dir, 'batches'))
    const history = new History(join(dir, 'history.json'))
    const batch = store.create('Test', { ...DEFAULT_SETTINGS, printer: 'Office', copies: 2 })
    const a = await makePdf('a.pdf', 3)
    const b = await makePdf('b.pdf', 1)
    const c = await makePdf('c.pdf', 2)
    const bad = await makePdf('bad.pdf', 1)
    store.addItems(batch.id, [
      item(c, { overrides: { copies: 1, pageRange: '2' } }),
      item(b, { enabled: false }),
      item(bad),
      item(a, { overrides: { duplex: 'long', printer: 'Colour' } })
    ])

    const seen: JobProgress[] = []
    const runner = new PrintRunner({
      store,
      history,
      preparer: new Preparer(new OfficeConverter(join(dir, 'cache'), () => null)),
      getSumatra: () => fakeSumatra,
      onProgress: (p) => seen.push(p)
    })
    runner.start(batch.id)
    await waitForIdle(runner, seen)

    const calls = readFileSync(log, 'utf8').trim().split('\n')
    expect(calls).toEqual([
      `-print-to Office -print-settings 2,1x,fit -silent ${c}`,
      `-print-to Office -print-settings 2x,fit -silent ${bad}`,
      `-print-to Colour -print-settings 2x,duplexlong,fit -silent ${a}`
    ])
    const final = seen[seen.length - 1]
    expect(final).toMatchObject({ running: false, total: 3, completed: 2, failed: 1 })
    expect(final.itemStates[b]).toBeUndefined()
    expect(final.itemStates[bad]).toBe('failed')

    const entries = history.list()
    expect(entries.map((e) => [e.file, e.status, e.pages])).toEqual([
      [a, 'printed', 6],
      [bad, 'failed', 2],
      [c, 'printed', 1]
    ])
  })

  it('prints only the chosen items, even if they are skipped in the batch', async () => {
    const store = new BatchStore(join(dir, 'batches'))
    const batch = store.create('Test')
    const a = await makePdf('a.pdf', 1)
    const b = await makePdf('b.pdf', 1)
    store.addItems(batch.id, [item(a), item(b, { enabled: false })])
    const seen: JobProgress[] = []
    const runner = new PrintRunner({
      store,
      history: new History(join(dir, 'history.json')),
      preparer: new Preparer(new OfficeConverter(join(dir, 'cache'), () => null)),
      getSumatra: () => fakeSumatra,
      onProgress: (p) => seen.push(p)
    })
    runner.start(batch.id, [b])
    await waitForIdle(runner, seen)
    expect(readFileSync(log, 'utf8').trim()).toBe(`-print-to-default -print-settings 1x,fit -silent ${b}`)
  })

  it('reports a missing file and an Office file without LibreOffice as failures', async () => {
    const store = new BatchStore(join(dir, 'batches'))
    const history = new History(join(dir, 'history.json'))
    const batch = store.create('Test')
    const doc = join(dir, 'letter.docx')
    writeFileSync(doc, 'not really a docx')
    store.addItems(batch.id, [item(join(dir, 'gone.pdf')), item(doc, { kind: 'office' })])
    const seen: JobProgress[] = []
    const runner = new PrintRunner({
      store,
      history,
      preparer: new Preparer(new OfficeConverter(join(dir, 'cache'), () => null)),
      getSumatra: () => fakeSumatra,
      onProgress: (p) => seen.push(p)
    })
    runner.start(batch.id)
    await waitForIdle(runner, seen)
    expect(history.list().map((e) => e.error)).toEqual([
      expect.stringContaining('LibreOffice was not found'),
      'The file has been moved or deleted.'
    ])
  })
})

describe('BatchStore', () => {
  it('persists batches and reloads them, resetting preparation state', async () => {
    const batchesDir = join(dir, 'batches')
    const store = new BatchStore(batchesDir)
    const b = store.create('Weekly')
    store.addItems(b.id, [item('/x/a.pdf', { pageCount: 4 }), item('/x/b.pdf')])
    store.patchOverrides(b.id, ['/x/b.pdf'], { copies: 3, color: 'mono' })
    store.patchOverrides(b.id, ['/x/b.pdf'], { color: null })
    store.reorder(b.id, ['/x/b.pdf'])
    expect(store.create('Weekly').name).toBe('Weekly 2')
    await store.flush()

    const reloaded = new BatchStore(batchesDir)
    reloaded.load()
    const again = reloaded.require(b.id)
    expect(again.items.map((i) => i.path)).toEqual(['/x/b.pdf', '/x/a.pdf'])
    expect(again.items[0].overrides).toEqual({ copies: 3 })
    expect(again.items.every((i) => i.status === 'preparing')).toBe(true)
    expect(reloaded.list().map((s) => s.name)).toEqual(['Weekly', 'Weekly 2'])
  })
})
