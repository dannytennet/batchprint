import { useCallback, useEffect, useMemo, useState } from 'react'
import type { OverridePatch, Toast } from '@shared/api'
import { selectedPages } from '@shared/pageRange'
import { shiftItems } from '@shared/reorder'
import { effectiveSettings } from '@shared/settings'
import type { Batch, BatchItem, JobProgress, PrintSettings, PrinterInfo } from '@shared/types'
import type { Run } from '../App'
import { api } from '../api'
import { clearCapsCache } from '../caps'
import { ItemList } from './ItemList'
import { PreviewPane } from './PreviewPane'
import { SettingsEditor } from './SettingsEditor'

interface Props {
  batch: Batch
  printers: PrinterInfo[]
  progress: JobProgress | null
  anyJobRunning: boolean
  run: Run
  notify: (t: Toast) => void
  onRefreshPrinters: () => void
}

interface MenuState {
  x: number
  y: number
}

export function BatchView({ batch, printers, progress, anyJobRunning, run, notify, onRefreshPrinters }: Props) {
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [anchor, setAnchor] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [menu, setMenu] = useState<MenuState | null>(null)

  // Drop selections for items that have been removed.
  useEffect(() => {
    const ids = new Set(batch.items.map((i) => i.id))
    setSelection((sel) => {
      const next = new Set([...sel].filter((id) => ids.has(id)))
      return next.size === sel.size ? sel : next
    })
  }, [batch.items])

  const selectedItems = useMemo(() => batch.items.filter((i) => selection.has(i.id)), [batch.items, selection])
  const ids = batch.items.map((i) => i.id)

  const addPaths = useCallback(
    async (paths: string[]) => {
      if (!paths.length) return
      const res = await run(() => api.addPaths(batch.id, paths))
      if (!res) return
      const skipped = res.skipped ? `, ${res.skipped} skipped (not printable)` : ''
      notify({
        kind: res.added ? 'info' : 'error',
        message: res.added ? `Added ${res.added} file${res.added === 1 ? '' : 's'}${skipped}` : `No printable files found${skipped}`
      })
    },
    [batch.id, run, notify]
  )

  const onRowClick = (id: string, e: React.MouseEvent) => {
    setMenu(null)
    if (e.shiftKey && anchor) {
      const a = ids.indexOf(anchor)
      const b = ids.indexOf(id)
      const range = ids.slice(Math.min(a, b), Math.max(a, b) + 1)
      setSelection(new Set(e.ctrlKey || e.metaKey ? [...selection, ...range] : range))
      return
    }
    if (e.ctrlKey || e.metaKey) {
      const next = new Set(selection)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setSelection(next)
    } else {
      setSelection(new Set([id]))
    }
    setAnchor(id)
  }

  const onContextMenu = (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    if (!selection.has(id)) {
      setSelection(new Set([id]))
      setAnchor(id)
    }
    setMenu({ x: e.clientX, y: e.clientY })
  }

  const selectedIds = () => [...selection]
  const remove = () => selection.size && run(() => api.removeItems(batch.id, selectedIds()))
  const move = (dir: 'up' | 'down' | 'top' | 'bottom') =>
    selection.size && run(() => api.reorderItems(batch.id, shiftItems(ids, selection, dir)))
  const setEnabled = (enabled: boolean) => run(() => api.setEnabled(batch.id, selectedIds(), enabled))
  const sortByName = () =>
    run(() =>
      api.reorderItems(
        batch.id,
        [...batch.items]
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
          .map((i) => i.id)
      )
    )

  const print = (itemIds?: string[]) => run(() => api.startPrint(batch.id, itemIds))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, select, textarea')) return
      if (e.key === 'Delete' && selection.size) {
        e.preventDefault()
        void remove()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setSelection(new Set(ids))
      } else if (e.key === 'Escape') {
        setSelection(new Set())
        setMenu(null)
      } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        void move(e.key === 'ArrowUp' ? 'up' : 'down')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Files dragged in from Explorer. Internal row dragging uses pointer events, so it never reaches here.
  const isFileDrag = (e: React.DragEvent) => e.dataTransfer.types.includes('Files')
  const onDragOver = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOver(true)
  }
  const onDrop = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
    setDragOver(false)
    const paths = [...e.dataTransfer.files].map((f) => api.getPathForFile(f)).filter(Boolean)
    void addPaths(paths)
  }

  const totals = useMemo(() => {
    let pages = 0
    let unknown = 0
    const included = batch.items.filter((i) => i.enabled)
    for (const item of included) {
      const s = effectiveSettings(batch.defaults, item.overrides)
      if (item.pageCount === undefined) unknown++
      else pages += selectedPages(s.pageRange, item.pageCount).length * s.copies
    }
    return { included: included.length, pages, unknown }
  }, [batch])

  const running = Boolean(progress?.running)
  const single = selectedItems.length === 1 ? selectedItems[0] : null

  return (
    <div
      className="batch-view"
      onDragOver={onDragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false)
      }}
      onDrop={onDrop}
      onClick={() => setMenu(null)}
    >
      <header className="toolbar">
        <h1 className="batch-title">{batch.name}</h1>
        <div className="toolbar-group">
          <button onClick={async () => addPaths((await run(() => api.pickFiles())) ?? [])}>Add files</button>
          <button onClick={async () => addPaths((await run(() => api.pickFolder())) ?? [])}>Add folder</button>
        </div>
        <div className="toolbar-group">
          <button onClick={() => move('top')} disabled={!selection.size} title="Move to top">
            ⤒
          </button>
          <button onClick={() => move('up')} disabled={!selection.size} title="Move up (Alt+↑)">
            ↑
          </button>
          <button onClick={() => move('down')} disabled={!selection.size} title="Move down (Alt+↓)">
            ↓
          </button>
          <button onClick={() => move('bottom')} disabled={!selection.size} title="Move to bottom">
            ⤓
          </button>
          <button onClick={sortByName} disabled={batch.items.length < 2} title="Sort by file name">
            A→Z
          </button>
        </div>
        <div className="toolbar-group">
          <button onClick={remove} disabled={!selection.size} title="Remove from batch (Delete)">
            Remove
          </button>
        </div>
      </header>

      <div className="batch-body">
        <section className="list-pane">
          {batch.items.length === 0 ? (
            <div className="empty-list">
              <p className="empty-title">Drop files or folders here</p>
              <p>
                PDFs, images, Word, Excel and PowerPoint files are supported. Folders are scanned
                {` `}for printable files. You can also right-click files in Explorer and choose <b>Add to print batch</b>.
              </p>
            </div>
          ) : (
            <ItemList
              batch={batch}
              selection={selection}
              jobStates={progress?.itemStates ?? {}}
              jobErrors={progress?.itemErrors ?? {}}
              onRowClick={onRowClick}
              onReorder={(order) => run(() => api.reorderItems(batch.id, order))}
              onToggleEnabled={(item: BatchItem) => run(() => api.setEnabled(batch.id, [item.id], !item.enabled))}
              onContextMenu={onContextMenu}
            />
          )}
          {dragOver && <div className="drop-overlay">Drop to add to “{batch.name}”</div>}
        </section>

        <aside className="details-pane">
          {selectedItems.length === 0 ? (
            <>
              <div className="details-head">
                <h2>Batch defaults</h2>
                <button className="link-btn" onClick={() => { clearCapsCache(); onRefreshPrinters() }}>
                  Refresh printers
                </button>
              </div>
              <p className="details-note">Every item uses these unless you change it individually. Select items to override.</p>
              <SettingsEditor
                mode="defaults"
                defaults={batch.defaults}
                printers={printers}
                onChange={(patch: Partial<PrintSettings>) => run(() => api.setDefaults(batch.id, patch))}
              />
            </>
          ) : (
            <>
              <div className="details-head">
                <h2>{single ? single.name : `${selectedItems.length} items selected`}</h2>
                <button className="link-btn" onClick={() => setSelection(new Set())}>
                  Batch defaults
                </button>
              </div>
              {single && (
                <>
                  <PreviewPane
                    batchId={batch.id}
                    item={single}
                    pageRange={effectiveSettings(batch.defaults, single.overrides).pageRange}
                  />
                  <div className="file-actions">
                    <button className="link-btn" onClick={() => run(() => api.openFile(single.path))}>
                      Open
                    </button>
                    <button className="link-btn" onClick={() => run(() => api.showInFolder(single.path))}>
                      Show in folder
                    </button>
                  </div>
                </>
              )}
              <p className="details-note">
                Changes apply to {single ? 'this item' : 'all selected items'}. “Batch default” follows the batch settings.
              </p>
              <SettingsEditor
                mode="items"
                defaults={batch.defaults}
                items={selectedItems}
                printers={printers}
                onPatch={(patch: OverridePatch) => run(() => api.patchOverrides(batch.id, selectedIds(), patch))}
              />
            </>
          )}
        </aside>
      </div>

      <footer className="footer">
        <div className="footer-stats">
          {batch.items.length} item{batch.items.length === 1 ? '' : 's'}
          {totals.included !== batch.items.length && ` · ${totals.included} included`}
          {` · ${totals.pages} page${totals.pages === 1 ? '' : 's'} to print`}
          {totals.unknown > 0 && ` (+${totals.unknown} not counted yet)`}
        </div>
        {running && progress ? (
          <div className="footer-progress">
            <progress max={progress.total} value={progress.completed + progress.failed} />
            <span>
              Printing {Math.min(progress.completed + progress.failed + 1, progress.total)} of {progress.total}
            </span>
            <button onClick={() => run(() => api.cancelPrint())}>Cancel</button>
          </div>
        ) : (
          <div className="footer-actions">
            {progress && progress.total > 0 && (
              <span className={progress.failed ? 'error-text' : 'muted'}>
                Last run: {progress.completed} sent{progress.failed ? `, ${progress.failed} failed` : ''}
              </span>
            )}
            <button onClick={() => print(selectedIds())} disabled={!selection.size || anyJobRunning}>
              Print selected{selection.size ? ` (${selection.size})` : ''}
            </button>
            <button className="primary" onClick={() => print()} disabled={!totals.included || anyJobRunning}>
              Print batch
            </button>
          </div>
        )}
      </footer>

      {menu && (
        <div className="menu context-menu" style={{ left: Math.min(menu.x, window.innerWidth - 230), top: Math.min(menu.y, window.innerHeight - 380) }} onClick={(e) => e.stopPropagation()}>
          {single && (
            <>
              <button onClick={() => { setMenu(null); void run(() => api.openFile(single.path)) }}>Open</button>
              <button onClick={() => { setMenu(null); void run(() => api.showInFolder(single.path)) }}>Show in folder</button>
              <hr />
            </>
          )}
          <button disabled={anyJobRunning} onClick={() => { setMenu(null); void print(selectedIds()) }}>
            Print {single ? 'this item' : `${selection.size} items`}
          </button>
          <button onClick={() => { setMenu(null); void setEnabled(true) }}>Include in batch</button>
          <button onClick={() => { setMenu(null); void setEnabled(false) }}>Skip when printing</button>
          <button onClick={() => { setMenu(null); void run(() => api.patchOverrides(batch.id, selectedIds(), RESET_ALL)) }}>
            Reset to batch defaults
          </button>
          <button onClick={() => { setMenu(null); void run(() => api.refreshItems(batch.id, selectedIds())) }}>
            Reload from disk
          </button>
          <hr />
          <button onClick={() => { setMenu(null); void move('top') }}>Move to top</button>
          <button onClick={() => { setMenu(null); void move('bottom') }}>Move to bottom</button>
          <hr />
          <button className="danger" onClick={() => { setMenu(null); void remove() }}>
            Remove
          </button>
        </div>
      )}
    </div>
  )
}

const RESET_ALL: OverridePatch = {
  printer: null,
  copies: null,
  duplex: null,
  color: null,
  paperSize: null,
  tray: null,
  pageRange: null,
  orientation: null,
  scaling: null
}
