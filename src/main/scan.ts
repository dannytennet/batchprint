import { promises as fs } from 'node:fs'
import { basename, join } from 'node:path'
import { isJunkFile, kindOf } from '@shared/fileTypes'

export interface ScanOptions {
  includeSubfolders: boolean
  skipFolders: string[]
  /** Safety valve for accidentally dropping a whole drive. */
  maxFiles?: number
}

export interface ScanResult {
  files: string[]
  skipped: number
  truncated: boolean
}

const naturalCompare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })

/**
 * Expands a mix of files and folders into printable files. Files keep the order
 * they were given in; folder contents are sorted naturally (2 before 10), with
 * each folder's own files before its subfolders.
 */
export async function expandPaths(paths: string[], opts: ScanOptions): Promise<ScanResult> {
  const max = opts.maxFiles ?? 5000
  const skip = new Set(opts.skipFolders.map((s) => s.trim().toLowerCase()).filter(Boolean))
  const result: ScanResult = { files: [], skipped: 0, truncated: false }
  const seen = new Set<string>()

  const addFile = (p: string) => {
    const key = p.toLowerCase()
    if (seen.has(key)) return
    if (isJunkFile(basename(p)) || !kindOf(p)) {
      result.skipped++
      return
    }
    if (result.files.length >= max) {
      result.truncated = true
      return
    }
    seen.add(key)
    result.files.push(p)
  }

  const walk = async (dir: string): Promise<void> => {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    const files = entries.filter((e) => e.isFile()).map((e) => e.name).sort(naturalCompare)
    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !skip.has(e.name.toLowerCase()))
      .map((e) => e.name)
      .sort(naturalCompare)
    for (const f of files) {
      if (f.startsWith('.')) continue
      addFile(join(dir, f))
    }
    if (!opts.includeSubfolders) return
    for (const d of dirs) {
      if (result.truncated) return
      await walk(join(dir, d))
    }
  }

  for (const p of paths) {
    let stat
    try {
      stat = await fs.stat(p)
    } catch {
      result.skipped++
      continue
    }
    if (stat.isDirectory()) await walk(p)
    else if (stat.isFile()) addFile(p)
    if (result.truncated) break
  }
  return result
}
