import { useState } from 'react'
import type { BatchSummary } from '@shared/types'
import type { Run, View } from '../App'
import { api } from '../api'

interface Props {
  batches: BatchSummary[]
  activeId: string | null
  view: View
  printingBatchId: string | null
  onSelect: (id: string) => void
  onView: (v: View) => void
  run: Run
}

export function Sidebar({ batches, activeId, view, printingBatchId, onSelect, onView, run }: Props) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [menuFor, setMenuFor] = useState<string | null>(null)

  const create = async () => {
    const b = await run(() => api.createBatch('New batch'))
    if (b) {
      onSelect(b.id)
      setRenaming(b.id)
      setDraft(b.name)
    }
  }

  const commitRename = async () => {
    if (renaming) await run(() => api.renameBatch(renaming, draft))
    setRenaming(null)
  }

  const action = async (id: string, what: 'rename' | 'duplicate' | 'export' | 'delete') => {
    setMenuFor(null)
    const b = batches.find((x) => x.id === id)
    if (!b) return
    if (what === 'rename') {
      setRenaming(id)
      setDraft(b.name)
    } else if (what === 'duplicate') {
      const copy = await run(() => api.duplicateBatch(id))
      if (copy) onSelect(copy.id)
    } else if (what === 'export') {
      await run(() => api.exportBatch(id))
    } else if (what === 'delete') {
      const msg = b.itemCount
        ? `Delete "${b.name}" and its ${b.itemCount} item${b.itemCount === 1 ? '' : 's'}? Your files are not touched.`
        : `Delete "${b.name}"?`
      if (window.confirm(msg)) await run(() => api.deleteBatch(id))
    }
  }

  const importBatch = async () => {
    const b = await run(() => api.importBatch())
    if (b) onSelect(b.id)
  }

  return (
    <aside className="sidebar" onClick={() => setMenuFor(null)}>
      <div className="sidebar-head">
        <span className="brand">Batch Print</span>
      </div>
      <div className="sidebar-section-title">
        <span>Batches</span>
        <button className="icon-btn" title="New batch" onClick={create} aria-label="New batch">
          +
        </button>
      </div>
      <ul className="batch-list">
        {batches.map((b) => (
          <li
            key={b.id}
            className={`batch-entry ${view === 'batch' && b.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(b.id)}
            onDoubleClick={() => action(b.id, 'rename')}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setMenuFor(b.id)
            }}
          >
            {renaming === b.id ? (
              <input
                className="rename-input"
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void commitRename()
                  if (e.key === 'Escape') setRenaming(null)
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <span className="batch-name">{b.name}</span>
                {printingBatchId === b.id && <span className="dot-printing" title="Printing" />}
                <span className="batch-count">{b.itemCount}</span>
                <button
                  className="icon-btn more"
                  aria-label={`More actions for ${b.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuFor(menuFor === b.id ? null : b.id)
                  }}
                >
                  ⋯
                </button>
              </>
            )}
            {menuFor === b.id && (
              <div className="menu" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => action(b.id, 'rename')}>Rename</button>
                <button onClick={() => action(b.id, 'duplicate')}>Duplicate</button>
                <button onClick={() => action(b.id, 'export')}>Export to file…</button>
                <button className="danger" onClick={() => action(b.id, 'delete')}>
                  Delete
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <button className="link-btn" onClick={importBatch}>
        Import batch from file…
      </button>
      <div className="sidebar-foot">
        <button className={`nav-btn ${view === 'history' ? 'active' : ''}`} onClick={() => onView('history')}>
          Print history
        </button>
        <button className={`nav-btn ${view === 'settings' ? 'active' : ''}`} onClick={() => onView('settings')}>
          Settings
        </button>
      </div>
    </aside>
  )
}
