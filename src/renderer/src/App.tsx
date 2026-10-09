import { useCallback, useEffect, useState } from 'react'
import type { Toast } from '@shared/api'
import type { AppSettings, Batch, BatchSummary, JobProgress, PrinterInfo } from '@shared/types'
import { api } from './api'
import { Sidebar } from './components/Sidebar'
import { BatchView } from './components/BatchView'
import { HistoryView } from './components/HistoryView'
import { AppSettingsView } from './components/AppSettingsView'

export type View = 'batch' | 'history' | 'settings'

interface ToastItem extends Toast {
  id: number
}

let toastId = 0

export function App() {
  const [batches, setBatches] = useState<BatchSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [batch, setBatch] = useState<Batch | null>(null)
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [progress, setProgress] = useState<JobProgress | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [view, setView] = useState<View>('batch')
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const notify = useCallback((t: Toast) => {
    const id = ++toastId
    setToasts((list) => [...list, { ...t, id }])
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), t.kind === 'error' ? 8000 : 4000)
  }, [])

  /** Runs an action and shows any error as a toast instead of failing silently. */
  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await fn()
      } catch (err) {
        notify({ kind: 'error', message: cleanError(err) })
        return undefined
      }
    },
    [notify]
  )

  const refreshPrinters = useCallback(() => run(() => api.listPrinters().then(setPrinters)), [run])

  useEffect(() => {
    const offs = [
      api.onBatchesChanged(setBatches),
      api.onBatchChanged((b) => setBatch((cur) => (cur && cur.id === b.id ? b : cur))),
      api.onProgress(setProgress),
      api.onActiveBatch((id) => setActiveId(id)),
      api.onToast(notify)
    ]
    void (async () => {
      const [list, s, p] = await Promise.all([api.listBatches(), api.getSettings(), api.getProgress()])
      setBatches(list)
      setSettings(s)
      setProgress(p)
      setActiveId(s.activeBatchId ?? list[0]?.id ?? null)
      await refreshPrinters()
      await api.appReady()
    })()
    return () => offs.forEach((off) => off())
  }, [notify, refreshPrinters])

  useEffect(() => {
    if (!activeId) {
      setBatch(null)
      return
    }
    let stale = false
    void api.getBatch(activeId).then((b) => {
      if (!stale) setBatch(b)
    })
    void api.setSettings({ activeBatchId: activeId }).then(setSettings)
    return () => {
      stale = true
    }
  }, [activeId])

  const selectBatch = (id: string) => {
    setActiveId(id)
    setView('batch')
  }

  return (
    <div className="app">
      <Sidebar
        batches={batches}
        activeId={activeId}
        view={view}
        printingBatchId={progress?.running ? progress.batchId : null}
        onSelect={selectBatch}
        onView={setView}
        run={run}
      />
      <main className="main">
        {view === 'batch' && batch && (
          <BatchView
            key={batch.id}
            batch={batch}
            printers={printers}
            progress={progress?.batchId === batch.id ? progress : null}
            anyJobRunning={Boolean(progress?.running)}
            run={run}
            notify={notify}
            onRefreshPrinters={refreshPrinters}
          />
        )}
        {view === 'batch' && !batch && <div className="empty-main">Create a batch to get started.</div>}
        {view === 'history' && <HistoryView run={run} />}
        {view === 'settings' && settings && (
          <AppSettingsView settings={settings} onChange={setSettings} run={run} />
        )}
      </main>
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}

export type Run = <T>(fn: () => Promise<T>) => Promise<T | undefined>

export function cleanError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  // Strip Electron's "Error invoking remote method 'x': Error: " prefix.
  return msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}
