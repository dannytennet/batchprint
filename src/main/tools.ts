import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import type { AppSettings, ToolStatus } from '@shared/types'

function firstExisting(candidates: Array<string | undefined>): string | null {
  for (const c of candidates) if (c && existsSync(c)) return c
  return null
}

const programDirs = () =>
  [process.env['ProgramFiles'], process.env['ProgramW6432'], process.env['ProgramFiles(x86)']].filter(
    (d): d is string => Boolean(d)
  )

export function findSoffice(settings: AppSettings): string | null {
  return firstExisting([
    settings.sofficePath || undefined,
    ...programDirs().map((d) => join(d, 'LibreOffice', 'program', 'soffice.exe')),
    // Non-Windows fallbacks so the converter can be exercised during development.
    '/usr/bin/soffice',
    '/usr/bin/libreoffice',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice'
  ])
}

export function findSumatra(settings: AppSettings): string | null {
  const bundled = app.isPackaged
    ? join(process.resourcesPath, 'bin', 'SumatraPDF.exe')
    : join(app.getAppPath(), 'resources', 'bin', 'SumatraPDF.exe')
  return firstExisting([
    settings.sumatraPath || undefined,
    bundled,
    ...programDirs().map((d) => join(d, 'SumatraPDF', 'SumatraPDF.exe')),
    process.env['LOCALAPPDATA'] && join(process.env['LOCALAPPDATA'], 'SumatraPDF', 'SumatraPDF.exe')
  ])
}

export function toolStatus(settings: AppSettings): ToolStatus {
  return { sofficePath: findSoffice(settings), sumatraPath: findSumatra(settings) }
}
