import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { expandPaths } from '../src/main/scan'

let root: string

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'bp-scan-'))
  const files = [
    'page10.pdf',
    'page2.pdf',
    'notes.zip',
    '~$report.docx',
    'report.docx',
    'sub/photo.JPG',
    'sub/deeper/sheet.xlsx',
    'node_modules/x.pdf',
    '.hidden/y.pdf'
  ]
  for (const f of files) {
    mkdirSync(join(root, f, '..'), { recursive: true })
    writeFileSync(join(root, f), 'x')
  }
})

const rel = (files: string[]) => files.map((f) => relative(root, f).replace(/\\/g, '/'))

describe('expandPaths', () => {
  it('finds printable files in natural order, folders after files, skipping junk', async () => {
    const res = await expandPaths([root], { includeSubfolders: true, skipFolders: ['node_modules'] })
    expect(rel(res.files)).toEqual(['page2.pdf', 'page10.pdf', 'report.docx', 'sub/photo.JPG', 'sub/deeper/sheet.xlsx'])
    expect(res.skipped).toBe(2) // notes.zip and the Office lock file
  })

  it('stays in the top folder when subfolders are off', async () => {
    const res = await expandPaths([root], { includeSubfolders: false, skipFolders: [] })
    expect(rel(res.files)).toEqual(['page2.pdf', 'page10.pdf', 'report.docx'])
  })

  it('keeps the order files were given in and drops duplicates', async () => {
    const a = join(root, 'report.docx')
    const b = join(root, 'page2.pdf')
    const res = await expandPaths([a, b, a, join(root, 'missing.pdf')], { includeSubfolders: true, skipFolders: [] })
    expect(rel(res.files)).toEqual(['report.docx', 'page2.pdf'])
    expect(res.skipped).toBe(1)
  })

  it('stops at the file limit', async () => {
    const res = await expandPaths([root], { includeSubfolders: true, skipFolders: [], maxFiles: 2 })
    expect(res.files).toHaveLength(2)
    expect(res.truncated).toBe(true)
  })
})
