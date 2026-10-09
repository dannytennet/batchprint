import { execFile } from 'node:child_process'
import type { WebContents } from 'electron'
import type { PrinterCapabilities, PrinterInfo } from '@shared/types'

export async function listPrinters(wc: WebContents): Promise<PrinterInfo[]> {
  const printers = await wc.getPrintersAsync()
  return printers
    .map((p) => ({ name: p.name, isDefault: Boolean((p as { isDefault?: boolean }).isDefault) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// Uses .NET's PrinterSettings, which reads paper sizes and trays from the
// printer driver. The printer name comes in through an environment variable so
// it is never interpolated into the script.
const CAPS_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$p = New-Object System.Drawing.Printing.PrinterSettings
if ($env:BATCHPRINT_PRINTER) { $p.PrinterName = $env:BATCHPRINT_PRINTER }
$o = [ordered]@{
  valid = $p.IsValid
  canDuplex = $p.CanDuplex
  supportsColor = $p.SupportsColor
  paperSizes = @($p.PaperSizes | ForEach-Object { [ordered]@{ value = [string]$_.RawKind; label = $_.PaperName } })
  trays = @($p.PaperSources | ForEach-Object { [ordered]@{ value = [string]$_.RawKind; label = $_.SourceName } })
}
$o | ConvertTo-Json -Depth 4 -Compress
`

const EMPTY_CAPS: PrinterCapabilities = { paperSizes: [], trays: [], canDuplex: true, supportsColor: true }

const cache = new Map<string, Promise<PrinterCapabilities>>()

export function printerCapabilities(printer: string): Promise<PrinterCapabilities> {
  if (process.platform !== 'win32') return Promise.resolve(EMPTY_CAPS)
  let p = cache.get(printer)
  if (!p) {
    p = queryCapabilities(printer).catch(() => EMPTY_CAPS)
    cache.set(printer, p)
  }
  return p
}

export function clearCapabilitiesCache(): void {
  cache.clear()
}

function queryCapabilities(printer: string): Promise<PrinterCapabilities> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', CAPS_SCRIPT],
      { windowsHide: true, timeout: 20000, env: { ...process.env, BATCHPRINT_PRINTER: printer } },
      (err, stdout) => {
        if (err) return reject(err)
        try {
          resolve(parseCapabilities(stdout))
        } catch (e) {
          reject(e)
        }
      }
    )
  })
}

export function parseCapabilities(json: string): PrinterCapabilities {
  const raw = JSON.parse(json.trim()) as {
    valid?: boolean
    canDuplex?: boolean
    supportsColor?: boolean
    paperSizes?: Array<{ value: string; label: string }> | { value: string; label: string }
    trays?: Array<{ value: string; label: string }> | { value: string; label: string }
  }
  if (raw.valid === false) return EMPTY_CAPS
  // ConvertTo-Json collapses single-element arrays to an object.
  const arr = <T,>(v: T[] | T | undefined): T[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v])
  const dedupe = (opts: Array<{ value: string; label: string }>) => {
    const seen = new Set<string>()
    return opts.filter((o) => o && o.value && !seen.has(o.value) && seen.add(o.value))
  }
  return {
    canDuplex: raw.canDuplex !== false,
    supportsColor: raw.supportsColor !== false,
    paperSizes: dedupe(arr(raw.paperSizes)),
    trays: dedupe(arr(raw.trays))
  }
}
