import { spawn, type ChildProcess } from 'node:child_process'
import { rangeToSumatraTokens } from '@shared/pageRange'
import type { PrintSettings } from '@shared/types'

const PRINT_TIMEOUT_MS = 10 * 60 * 1000

/**
 * Builds SumatraPDF command line arguments for one file.
 * Paper size and tray are passed as the driver's numeric ids, which avoids
 * problems with names containing commas.
 */
export function buildSumatraArgs(settings: PrintSettings, file: string): string[] {
  const tokens: string[] = [...rangeToSumatraTokens(settings.pageRange)]
  tokens.push(`${Math.max(1, Math.round(settings.copies))}x`)
  if (settings.duplex === 'simplex') tokens.push('simplex')
  else if (settings.duplex === 'long') tokens.push('duplexlong')
  else if (settings.duplex === 'short') tokens.push('duplexshort')
  if (settings.color === 'color') tokens.push('color')
  else if (settings.color === 'mono') tokens.push('monochrome')
  if (settings.paperSize) tokens.push(`paper=${settings.paperSize}`)
  if (settings.tray) tokens.push(`bin=${settings.tray}`)
  if (settings.orientation !== 'auto') tokens.push(settings.orientation)
  tokens.push(settings.scaling)

  const args = settings.printer ? ['-print-to', settings.printer] : ['-print-to-default']
  args.push('-print-settings', tokens.join(','), '-silent', file)
  return args
}

export interface RunningPrint {
  done: Promise<void>
  cancel: () => void
}

export function runSumatra(exe: string, args: string[]): RunningPrint {
  let child: ChildProcess | null = null
  let cancelled = false
  const done = new Promise<void>((resolve, reject) => {
    child = spawn(exe, args, { windowsHide: true, stdio: 'ignore' })
    const timer = setTimeout(() => {
      child?.kill()
      reject(new Error('Printing timed out.'))
    }, PRINT_TIMEOUT_MS)
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(new Error(`Could not start SumatraPDF: ${err.message}`))
    })
    child.on('exit', (code) => {
      clearTimeout(timer)
      if (cancelled) reject(new Error('Cancelled'))
      else if (code === 0) resolve()
      else reject(new Error(`SumatraPDF reported a printing error (exit code ${code}). Check the printer name and that the printer is online.`))
    })
  })
  return {
    done,
    cancel: () => {
      cancelled = true
      child?.kill()
    }
  }
}
