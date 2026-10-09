/// <reference types="vite/client" />
import type { BatchPrintApi } from '@shared/api'

declare global {
  interface Window {
    batchPrint: BatchPrintApi
  }
}
