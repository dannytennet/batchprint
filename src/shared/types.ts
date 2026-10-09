export type Duplex = 'printer' | 'simplex' | 'long' | 'short'
export type ColorMode = 'printer' | 'color' | 'mono'
export type Orientation = 'auto' | 'portrait' | 'landscape'
export type Scaling = 'fit' | 'shrink' | 'noscale'

/**
 * Full set of print settings. Empty strings for printer, paperSize, tray and
 * pageRange mean "use the default" (system default printer, the printer's own
 * paper and tray defaults, all pages).
 */
export interface PrintSettings {
  printer: string
  copies: number
  duplex: Duplex
  color: ColorMode
  paperSize: string
  tray: string
  pageRange: string
  orientation: Orientation
  scaling: Scaling
}

export type SettingKey = keyof PrintSettings

/** Per-item overrides. A missing key means "inherit from the batch defaults". */
export type SettingsOverride = Partial<PrintSettings>

export type FileKind = 'pdf' | 'image' | 'office'

export type ItemStatus = 'preparing' | 'ready' | 'error'

export interface BatchItem {
  id: string
  path: string
  name: string
  kind: FileKind
  /** Skipped when the batch is printed. */
  enabled: boolean
  overrides: SettingsOverride
  pageCount?: number
  status: ItemStatus
  error?: string
}

export interface Batch {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  defaults: PrintSettings
  items: BatchItem[]
}

export interface BatchSummary {
  id: string
  name: string
  itemCount: number
  updatedAt: number
}

export interface PrinterOption {
  /** Value passed to the print engine (driver id). */
  value: string
  label: string
}

export interface PrinterInfo {
  name: string
  isDefault: boolean
}

export interface PrinterCapabilities {
  paperSizes: PrinterOption[]
  trays: PrinterOption[]
  canDuplex: boolean
  supportsColor: boolean
}

export interface AppSettings {
  sofficePath: string
  sumatraPath: string
  includeSubfolders: boolean
  /** Folder names skipped when scanning, compared case-insensitively. */
  skipFolders: string[]
  activeBatchId: string | null
}

export interface ToolStatus {
  sofficePath: string | null
  sumatraPath: string | null
}

export type HistoryStatus = 'printed' | 'failed' | 'cancelled'

export interface HistoryEntry {
  id: string
  at: number
  batchName: string
  file: string
  printer: string
  settings: string
  pages: number | null
  status: HistoryStatus
  error?: string
}

export type JobItemState = 'queued' | 'preparing' | 'printing' | 'done' | 'failed' | 'cancelled'

export interface JobProgress {
  running: boolean
  batchId: string | null
  total: number
  completed: number
  failed: number
  currentItemId: string | null
  itemStates: Record<string, JobItemState>
  itemErrors: Record<string, string>
}

export interface AddResult {
  added: number
  skipped: number
}

export interface PreviewSource {
  kind: 'pdf' | 'image'
  mime: string
  data: Uint8Array
}
