import { describeSettings, effectiveSettings } from '@shared/settings'
import { selectedPages } from '@shared/pageRange'
import type { Batch, JobItemState, JobProgress, PrintSettings } from '@shared/types'
import type { BatchStore } from './batchStore'
import type { History } from './history'
import type { Preparer } from './prepare'
import { buildSumatraArgs, runSumatra, type RunningPrint } from './sumatra'

const idle = (): JobProgress => ({
  running: false,
  batchId: null,
  total: 0,
  completed: 0,
  failed: 0,
  currentItemId: null,
  itemStates: {},
  itemErrors: {}
})

export interface PrintRunnerDeps {
  store: BatchStore
  history: History
  preparer: Preparer
  getSumatra: () => string | null
  /** Human readable settings for the history log, e.g. with paper and tray names. */
  describe?: (settings: PrintSettings) => Promise<string>
  onProgress: (p: JobProgress) => void
}

/** Prints a batch one item at a time, in batch order, logging each item to the history. */
export class PrintRunner {
  private progress: JobProgress = idle()
  private current: RunningPrint | null = null
  private cancelled = false

  constructor(private deps: PrintRunnerDeps) {}

  state(): JobProgress {
    return this.progress
  }

  /** Starts printing. With `itemIds`, prints just those items (even if disabled); otherwise every enabled item. */
  start(batchId: string, itemIds?: string[]): void {
    if (this.progress.running) throw new Error('A batch is already printing.')
    const sumatra = this.deps.getSumatra()
    if (!sumatra) throw new Error('SumatraPDF (the print engine) was not found. Reinstall Batch Print or set its location in Settings.')
    const batch = this.deps.store.require(batchId)
    const pick = itemIds ? new Set(itemIds) : null
    const items = batch.items.filter((i) => (pick ? pick.has(i.id) : i.enabled))
    if (items.length === 0) throw new Error('There is nothing to print.')

    this.cancelled = false
    this.progress = {
      ...idle(),
      running: true,
      batchId,
      total: items.length,
      itemStates: Object.fromEntries(items.map((i) => [i.id, 'queued' as JobItemState]))
    }
    this.emit()
    void this.run(batch, items.map((i) => i.id), sumatra)
  }

  cancel(): void {
    if (!this.progress.running) return
    this.cancelled = true
    this.current?.cancel()
  }

  private async run(batch: Batch, itemIds: string[], sumatra: string): Promise<void> {
    for (const id of itemIds) {
      // Re-read each time so edits made while printing earlier items still apply.
      const item = batch.items.find((i) => i.id === id)
      if (!item) continue
      if (this.cancelled) {
        this.setItem(id, 'cancelled')
        continue
      }
      const settings = effectiveSettings(batch.defaults, item.overrides)
      const base = {
        batchName: batch.name,
        file: item.path,
        printer: settings.printer || 'Default printer',
        settings: await (this.deps.describe?.(settings) ?? Promise.resolve(describeSettings(settings))).catch(() =>
          describeSettings(settings)
        )
      }
      let pages: number | null = null
      this.progress.currentItemId = id
      try {
        this.setItem(id, 'preparing')
        const file = await this.deps.preparer.printablePath(item)
        const count = await this.deps.preparer.pageCount(item).catch(() => undefined)
        if (count !== undefined) pages = selectedPages(settings.pageRange, count).length * settings.copies
        if (this.cancelled) throw new Error('Cancelled')
        this.setItem(id, 'printing')
        this.current = runSumatra(sumatra, buildSumatraArgs(settings, file))
        await this.current.done
        this.progress.completed++
        this.setItem(id, 'done')
        this.deps.history.add({ ...base, pages, status: 'printed' })
      } catch (err) {
        const message = (err as Error).message
        if (this.cancelled) {
          this.setItem(id, 'cancelled')
          this.deps.history.add({ ...base, pages, status: 'cancelled' })
        } else {
          this.progress.failed++
          this.progress.itemErrors[id] = message
          this.setItem(id, 'failed')
          this.deps.history.add({ ...base, pages, status: 'failed', error: message })
        }
      } finally {
        this.current = null
      }
    }
    this.progress.running = false
    this.progress.currentItemId = null
    this.emit()
  }

  private setItem(id: string, state: JobItemState): void {
    this.progress.itemStates[id] = state
    this.emit()
  }

  private emit(): void {
    this.deps.onProgress({
      ...this.progress,
      itemStates: { ...this.progress.itemStates },
      itemErrors: { ...this.progress.itemErrors }
    })
  }
}
