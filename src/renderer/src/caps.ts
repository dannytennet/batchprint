import { useEffect, useState } from 'react'
import type { PrinterCapabilities, PrinterOption } from '@shared/types'
import { api } from './api'

const cache = new Map<string, Promise<PrinterCapabilities>>()

export function usePrinterCaps(printer: string): PrinterCapabilities | null {
  const [caps, setCaps] = useState<PrinterCapabilities | null>(null)
  useEffect(() => {
    let p = cache.get(printer)
    if (!p) {
      p = api.printerCapabilities(printer)
      cache.set(printer, p)
      p.catch(() => cache.delete(printer))
    }
    let stale = false
    setCaps(null)
    void p.then((c) => !stale && setCaps(c)).catch(() => undefined)
    return () => {
      stale = true
    }
  }, [printer])
  return caps
}

export function clearCapsCache(): void {
  cache.clear()
}

// Standard Windows paper (DMPAPER_*) and tray (DMBIN_*) ids, used when the driver can't be queried.
export const STANDARD_PAPERS: PrinterOption[] = [
  { value: '9', label: 'A4' },
  { value: '8', label: 'A3' },
  { value: '11', label: 'A5' },
  { value: '1', label: 'Letter' },
  { value: '5', label: 'Legal' },
  { value: '3', label: 'Tabloid' }
]

export const STANDARD_TRAYS: PrinterOption[] = [
  { value: '7', label: 'Automatic' },
  { value: '1', label: 'Upper / Tray 1' },
  { value: '2', label: 'Lower / Tray 2' },
  { value: '3', label: 'Middle / Tray 3' },
  { value: '4', label: 'Manual feed' },
  { value: '5', label: 'Envelope' },
  { value: '11', label: 'Large capacity' }
]

export function paperOptions(caps: PrinterCapabilities | null): PrinterOption[] {
  return caps && caps.paperSizes.length ? caps.paperSizes : STANDARD_PAPERS
}

export function trayOptions(caps: PrinterCapabilities | null): PrinterOption[] {
  return caps && caps.trays.length ? caps.trays : STANDARD_TRAYS
}

export function labelFor(options: PrinterOption[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? `#${value}`
}
