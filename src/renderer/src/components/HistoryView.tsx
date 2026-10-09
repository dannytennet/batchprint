import { useEffect, useMemo, useState } from 'react'
import type { HistoryEntry } from '@shared/types'
import type { Run } from '../App'
import { api } from '../api'

export function HistoryView({ run }: { run: Run }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [filter, setFilter] = useState('')
  const [onlyFailed, setOnlyFailed] = useState(false)

  useEffect(() => {
    const load = () => void api.listHistory().then(setEntries)
    load()
    return api.onHistoryChanged(load)
  }, [])

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return entries.filter(
      (e) =>
        (!onlyFailed || e.status !== 'printed') &&
        (!q || e.file.toLowerCase().includes(q) || e.batchName.toLowerCase().includes(q) || e.printer.toLowerCase().includes(q))
    )
  }, [entries, filter, onlyFailed])

  const clear = async () => {
    if (window.confirm('Clear the whole print history?')) await run(() => api.clearHistory())
  }

  return (
    <div className="history-view">
      <header className="toolbar">
        <h1 className="batch-title">Print history</h1>
        <input
          className="search"
          placeholder="Search file, batch or printer"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <label className="check">
          <input type="checkbox" checked={onlyFailed} onChange={(e) => setOnlyFailed(e.target.checked)} />
          Problems only
        </label>
        <button onClick={clear} disabled={!entries.length}>
          Clear history
        </button>
      </header>
      {shown.length === 0 ? (
        <div className="empty-main">{entries.length ? 'Nothing matches.' : 'Nothing has been printed yet.'}</div>
      ) : (
        <div className="table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>When</th>
                <th>File</th>
                <th>Batch</th>
                <th>Printer</th>
                <th>Pages</th>
                <th>Settings</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.id} className={`history-${e.status}`}>
                  <td className="nowrap">{new Date(e.at).toLocaleString()}</td>
                  <td title={e.file}>
                    <button className="link-btn" onClick={() => run(() => api.showInFolder(e.file))}>
                      {e.file.split(/[\\/]/).pop()}
                    </button>
                  </td>
                  <td>{e.batchName}</td>
                  <td>{e.printer}</td>
                  <td>{e.pages ?? '–'}</td>
                  <td className="muted">{e.settings}</td>
                  <td title={e.error}>
                    <span className={`badge badge-${e.status === 'printed' ? 'done' : e.status}`}>
                      {e.status === 'printed' ? 'Sent' : e.status === 'failed' ? 'Failed' : 'Cancelled'}
                    </span>
                    {e.error && <div className="error-text small">{e.error}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
