import type {
  AddResult,
  AppSettings,
  Batch,
  BatchSummary,
  HistoryEntry,
  JobProgress,
  PreviewSource,
  PrintSettings,
  PrinterCapabilities,
  PrinterInfo,
  SettingKey,
  ToolStatus
} from './types'

export type OverridePatch = { [K in SettingKey]?: PrintSettings[K] | null }

export interface Toast {
  kind: 'info' | 'error'
  message: string
}

/** Everything the window can ask of the main process, exposed as `window.batchPrint`. */
export interface BatchPrintApi {
  /** Called once the window is ready to receive events. */
  appReady(): Promise<void>
  listBatches(): Promise<BatchSummary[]>
  getBatch(id: string): Promise<Batch | null>
  createBatch(name: string): Promise<Batch>
  renameBatch(id: string, name: string): Promise<void>
  duplicateBatch(id: string): Promise<Batch>
  deleteBatch(id: string): Promise<void>
  exportBatch(id: string): Promise<boolean>
  importBatch(): Promise<Batch | null>
  setDefaults(id: string, patch: Partial<PrintSettings>): Promise<void>

  addPaths(batchId: string, paths: string[]): Promise<AddResult>
  pickFiles(): Promise<string[]>
  pickFolder(): Promise<string[]>
  pickExecutable(title: string): Promise<string | null>
  removeItems(batchId: string, itemIds: string[]): Promise<void>
  reorderItems(batchId: string, orderedIds: string[]): Promise<void>
  patchOverrides(batchId: string, itemIds: string[], patch: OverridePatch): Promise<void>
  setEnabled(batchId: string, itemIds: string[], enabled: boolean): Promise<void>
  refreshItems(batchId: string, itemIds: string[]): Promise<void>
  getPreview(batchId: string, itemId: string): Promise<PreviewSource>

  listPrinters(): Promise<PrinterInfo[]>
  printerCapabilities(printer: string): Promise<PrinterCapabilities>

  startPrint(batchId: string, itemIds?: string[]): Promise<void>
  cancelPrint(): Promise<void>
  getProgress(): Promise<JobProgress>

  listHistory(): Promise<HistoryEntry[]>
  clearHistory(): Promise<void>

  getSettings(): Promise<AppSettings>
  setSettings(patch: Partial<AppSettings>): Promise<AppSettings>
  getToolStatus(): Promise<ToolStatus>

  showInFolder(path: string): Promise<void>
  openFile(path: string): Promise<void>
  getPathForFile(file: File): string

  onBatchesChanged(fn: (list: BatchSummary[]) => void): () => void
  onBatchChanged(fn: (batch: Batch) => void): () => void
  onProgress(fn: (p: JobProgress) => void): () => void
  onActiveBatch(fn: (id: string) => void): () => void
  onToast(fn: (t: Toast) => void): () => void
  onHistoryChanged(fn: () => void): () => void
}
