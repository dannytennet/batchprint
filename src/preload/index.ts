import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { BatchPrintApi } from '@shared/api'

const invoke =
  (channel: string) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args)

function on<T>(channel: string) {
  return (fn: (payload: T) => void) => {
    const listener = (_e: unknown, payload: T) => fn(payload)
    ipcRenderer.on(channel, listener)
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  }
}

const api: BatchPrintApi = {
  appReady: invoke('app:ready'),
  listBatches: invoke('batches:list'),
  getBatch: invoke('batches:get'),
  createBatch: invoke('batches:create'),
  renameBatch: invoke('batches:rename'),
  duplicateBatch: invoke('batches:duplicate'),
  deleteBatch: invoke('batches:delete'),
  exportBatch: invoke('batches:export'),
  importBatch: invoke('batches:import'),
  setDefaults: invoke('batches:setDefaults'),

  addPaths: invoke('items:addPaths'),
  pickFiles: invoke('dialog:pickFiles'),
  pickFolder: invoke('dialog:pickFolder'),
  pickExecutable: invoke('dialog:pickExecutable'),
  removeItems: invoke('items:remove'),
  reorderItems: invoke('items:reorder'),
  patchOverrides: invoke('items:patchOverrides'),
  setEnabled: invoke('items:setEnabled'),
  refreshItems: invoke('items:refresh'),
  getPreview: invoke('items:preview'),

  listPrinters: invoke('printers:list'),
  printerCapabilities: invoke('printers:capabilities'),

  startPrint: invoke('print:start'),
  cancelPrint: invoke('print:cancel'),
  getProgress: invoke('print:progress'),

  listHistory: invoke('history:list'),
  clearHistory: invoke('history:clear'),

  getSettings: invoke('settings:get'),
  setSettings: invoke('settings:set'),
  getToolStatus: invoke('tools:status'),

  showInFolder: invoke('shell:showInFolder'),
  openFile: invoke('shell:openFile'),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),

  onBatchesChanged: on('batches:changed'),
  onBatchChanged: on('batch:changed'),
  onProgress: on('print:progress'),
  onActiveBatch: on('batches:active'),
  onToast: on('toast'),
  onHistoryChanged: on('history:changed')
} as BatchPrintApi

contextBridge.exposeInMainWorld('batchPrint', api)
