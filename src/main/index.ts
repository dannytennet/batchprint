import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import { promises as fs } from 'node:fs'
import { basename, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { OverridePatch, Toast } from '@shared/api'
import { PRINTABLE_EXTENSIONS, imageMime, kindOf } from '@shared/fileTypes'
import { clampCopies, describeSettings } from '@shared/settings'
import type { AppSettings, Batch, BatchItem, PrintSettings } from '@shared/types'
import { pathsFromArgv } from './argv'
import { BatchStore } from './batchStore'
import { OfficeConverter } from './convert'
import { History } from './history'
import { DebouncedWriter, readJsonSync, writeJsonAtomic } from './jsonFile'
import { Preparer } from './prepare'
import { clearCapabilitiesCache, listPrinters, printerCapabilities } from './printers'
import { PrintRunner } from './printRunner'
import { expandPaths } from './scan'
import { findSoffice, findSumatra, toolStatus } from './tools'

// Chromium may reorder a second instance's argv, so the original is passed along untouched.
interface InstanceData {
  argv: string[]
}

if (!app.requestSingleInstanceLock({ argv: process.argv } satisfies InstanceData)) {
  app.quit()
} else {
  void main()
}

async function main(): Promise<void> {
  const userData = app.getPath('userData')
  const settingsPath = join(userData, 'settings.json')
  const settingsWriter = new DebouncedWriter()
  const settings: AppSettings = {
    sofficePath: '',
    sumatraPath: '',
    includeSubfolders: true,
    skipFolders: ['node_modules', '$RECYCLE.BIN', 'System Volume Information'],
    activeBatchId: null,
    ...readJsonSync<Partial<AppSettings>>(settingsPath, {})
  }
  const saveSettings = () => settingsWriter.schedule(settingsPath, () => settings)

  const store = new BatchStore(join(userData, 'batches'))
  store.load()
  const history = new History(join(userData, 'history.json'))
  const converter = new OfficeConverter(join(userData, 'converted'), () => findSoffice(settings))
  const preparer = new Preparer(converter)
  let win: BrowserWindow | null = null

  const send = (channel: string, payload?: unknown) => {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
  }
  const toast = (t: Toast) => send('toast', t)

  const runner = new PrintRunner({
    store,
    history,
    preparer,
    getSumatra: () => findSumatra(settings),
    describe: async (s) => {
      const caps = await printerCapabilities(s.printer)
      return describeSettings(s, {
        paper: caps.paperSizes.find((o) => o.value === s.paperSize)?.label,
        tray: caps.trays.find((o) => o.value === s.tray)?.label
      })
    },
    onProgress: (p) => {
      send('print:progress', p)
      send('history:changed')
    }
  })

  store.onChange((batch) => {
    send('batches:changed', store.list())
    if (batch) send('batch:changed', batch)
  })

  // Works out page counts and converts Office files in the background, a few at a time.
  const prepQueue: Array<{ batchId: string; itemId: string }> = []
  let prepActive = 0
  const pumpPrep = () => {
    while (prepActive < 3 && prepQueue.length) {
      const { batchId, itemId } = prepQueue.shift()!
      const item = store.get(batchId)?.items.find((i) => i.id === itemId)
      if (!item) continue
      prepActive++
      store.updateItem(batchId, itemId, { status: 'preparing', error: undefined })
      preparer
        .pageCount(item)
        .then((pageCount) => store.updateItem(batchId, itemId, { status: 'ready', pageCount }))
        .catch((err: Error) => store.updateItem(batchId, itemId, { status: 'error', error: err.message }))
        .finally(() => {
          prepActive--
          pumpPrep()
        })
    }
  }
  const prepare = (batchId: string, items: BatchItem[]) => {
    for (const i of items) prepQueue.push({ batchId, itemId: i.id })
    pumpPrep()
  }
  for (const b of store.list()) prepare(b.id, store.require(b.id).items)

  const ensureActiveBatch = (): Batch => {
    const existing = settings.activeBatchId && store.get(settings.activeBatchId)
    if (existing) return existing
    const first = store.list()[0]
    const batch = first ? store.require(first.id) : store.create('My batch')
    settings.activeBatchId = batch.id
    saveSettings()
    return batch
  }
  ensureActiveBatch()

  const addPaths = async (batchId: string, paths: string[]) => {
    const scan = await expandPaths(paths, {
      includeSubfolders: settings.includeSubfolders,
      skipFolders: settings.skipFolders
    })
    const items: BatchItem[] = scan.files.map((path) => ({
      id: randomUUID(),
      path,
      name: basename(path),
      kind: kindOf(path)!,
      enabled: true,
      overrides: {},
      status: 'preparing'
    }))
    if (items.length) {
      store.addItems(batchId, items)
      prepare(batchId, items)
    }
    if (scan.truncated) toast({ kind: 'error', message: 'Stopped after 5000 files. Add large folders in smaller pieces.' })
    return { added: items.length, skipped: scan.skipped }
  }

  /** Files sent from Explorer go to the batch that is open in the window. */
  const addFromShell = async (argv: string[]) => {
    const paths = pathsFromArgv(argv, app.isPackaged ? [] : [app.getAppPath()])
    if (!paths.length) return
    const batch = ensureActiveBatch()
    const { added, skipped } = await addPaths(batch.id, paths)
    const extra = skipped ? ` (${skipped} skipped, not printable)` : ''
    toast({
      kind: added ? 'info' : 'error',
      message: added ? `Added ${added} file${added === 1 ? '' : 's'} to "${batch.name}"${extra}` : `Nothing printable found${extra}`
    })
  }

  // Each Explorer selection launches a new process; the lock hands its arguments to this one.
  app.on('second-instance', (_e, argv, _cwd, data) => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
    const original = (data as InstanceData | undefined)?.argv
    void addFromShell(Array.isArray(original) ? original : argv)
  })

  const handle = <A extends unknown[], R>(channel: string, fn: (...args: A) => R | Promise<R>) =>
    ipcMain.handle(channel, (_e, ...args) => fn(...(args as A)))

  handle('batches:list', () => store.list())
  handle('batches:get', (id: string) => store.get(id) ?? null)
  handle('batches:create', (name: string) => store.create(name))
  handle('batches:rename', (id: string, name: string) => store.rename(id, name))
  handle('batches:duplicate', (id: string) => {
    const copy = store.duplicate(id)
    prepare(copy.id, copy.items)
    return copy
  })
  handle('batches:delete', async (id: string) => {
    if (runner.state().running && runner.state().batchId === id) throw new Error('This batch is printing.')
    await store.delete(id)
    if (settings.activeBatchId === id) {
      settings.activeBatchId = null
      send('batches:active', ensureActiveBatch().id)
    }
  })
  handle('batches:export', async (id: string) => {
    const batch = store.require(id)
    const res = await dialog.showSaveDialog(win!, {
      title: 'Export batch',
      defaultPath: `${batch.name}.batchprint.json`,
      filters: [{ name: 'Batch Print batch', extensions: ['json'] }]
    })
    if (res.canceled || !res.filePath) return false
    const { id: _id, ...rest } = batch
    await writeJsonAtomic(res.filePath, {
      ...rest,
      items: batch.items.map(({ status: _s, error: _e, ...i }) => i)
    })
    return true
  })
  handle('batches:import', async () => {
    const res = await dialog.showOpenDialog(win!, {
      title: 'Import batch',
      filters: [{ name: 'Batch Print batch', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (res.canceled || !res.filePaths[0]) return null
    const batch = store.import(JSON.parse(await fs.readFile(res.filePaths[0], 'utf8')))
    prepare(batch.id, batch.items)
    return batch
  })
  handle('batches:setDefaults', (id: string, patch: Partial<PrintSettings>) => {
    if (patch.copies !== undefined) patch.copies = clampCopies(patch.copies)
    store.setDefaults(id, patch)
  })

  handle('items:addPaths', (batchId: string, paths: string[]) => addPaths(batchId, paths))
  handle('items:remove', (batchId: string, ids: string[]) => store.removeItems(batchId, ids))
  handle('items:reorder', (batchId: string, ids: string[]) => store.reorder(batchId, ids))
  handle('items:patchOverrides', (batchId: string, ids: string[], patch: OverridePatch) => {
    if (typeof patch.copies === 'number') patch.copies = clampCopies(patch.copies)
    store.patchOverrides(batchId, ids, patch)
  })
  handle('items:setEnabled', (batchId: string, ids: string[], enabled: boolean) =>
    store.setEnabled(batchId, ids, enabled)
  )
  handle('items:refresh', (batchId: string, ids: string[]) => {
    const set = new Set(ids)
    prepare(batchId, store.require(batchId).items.filter((i) => set.has(i.id)))
  })
  handle('items:preview', async (batchId: string, itemId: string) => {
    const item = store.require(batchId).items.find((i) => i.id === itemId)
    if (!item) throw new Error('Item not found')
    const path = await preparer.printablePath(item)
    const data = new Uint8Array(await fs.readFile(path))
    return item.kind === 'image'
      ? { kind: 'image', mime: imageMime(item.path), data }
      : { kind: 'pdf', mime: 'application/pdf', data }
  })

  handle('dialog:pickFiles', async () => {
    const res = await dialog.showOpenDialog(win!, {
      title: 'Add files',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Printable files', extensions: PRINTABLE_EXTENSIONS.map((e) => e.slice(1)) },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    return res.canceled ? [] : res.filePaths
  })
  handle('dialog:pickFolder', async () => {
    const res = await dialog.showOpenDialog(win!, {
      title: 'Add folder',
      properties: ['openDirectory', 'multiSelections']
    })
    return res.canceled ? [] : res.filePaths
  })
  handle('dialog:pickExecutable', async (title: string) => {
    const res = await dialog.showOpenDialog(win!, {
      title,
      properties: ['openFile'],
      filters: [{ name: 'Programs', extensions: ['exe'] }]
    })
    return res.canceled ? null : res.filePaths[0]
  })

  handle('printers:list', () => {
    clearCapabilitiesCache()
    return listPrinters(win!.webContents)
  })
  handle('printers:capabilities', (printer: string) => printerCapabilities(printer))

  handle('print:start', (batchId: string, itemIds?: string[]) => runner.start(batchId, itemIds))
  handle('print:cancel', () => runner.cancel())
  handle('print:progress', () => runner.state())

  handle('history:list', () => history.list())
  handle('history:clear', () => {
    history.clear()
    send('history:changed')
  })

  handle('settings:get', () => settings)
  handle('settings:set', (patch: Partial<AppSettings>) => {
    Object.assign(settings, patch)
    saveSettings()
    if (patch.activeBatchId) send('batches:active', patch.activeBatchId)
    return settings
  })
  handle('tools:status', () => toolStatus(settings))
  // Files passed on the very first launch are added once the window is listening, so the toast shows.
  let startupHandled = false
  handle('app:ready', async () => {
    if (startupHandled) return
    startupHandled = true
    await addFromShell(process.argv)
  })

  handle('shell:showInFolder', (path: string) => shell.showItemInFolder(path))
  handle('shell:openFile', async (path: string) => {
    const err = await shell.openPath(path)
    if (err) throw new Error(err)
  })

  await app.whenReady()
  Menu.setApplicationMenu(null)

  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 560,
    show: false,
    title: 'Batch Print',
    backgroundColor: '#f6f7f9',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })
  win.once('ready-to-show', () => win?.show())
  // Dropped files are handled by the page; never let a drop navigate the window away.
  win.webContents.on('will-navigate', (e) => e.preventDefault())
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (process.env['ELECTRON_RENDERER_URL']) await win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else await win.loadFile(join(__dirname, '../renderer/index.html'))

  let quitting = false
  app.on('before-quit', (e) => {
    if (quitting) return
    e.preventDefault()
    quitting = true
    void Promise.all([store.flush(), history.flush(), settingsWriter.flushAll()]).finally(() => app.quit())
  })
  app.on('window-all-closed', () => app.quit())
}
