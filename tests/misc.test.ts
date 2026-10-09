import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PRINTABLE_EXTENSIONS, kindOf } from '@shared/fileTypes'
import { pathsFromArgv } from '../src/main/argv'
import { parseCapabilities } from '../src/main/printers'

describe('pathsFromArgv', () => {
  it('reads paths after --add, ignoring other flags', () => {
    expect(pathsFromArgv(['C:\\app\\Batch Print.exe', '--add', 'C:\\a.pdf', 'D:\\folder'])).toEqual(['C:\\a.pdf', 'D:\\folder'])
    expect(pathsFromArgv(['electron', '.', '--inspect'])).toEqual([])
    expect(pathsFromArgv(['app.exe', '--add', '--allow-file-access', 'C:\\x.pdf'])).toEqual(['C:\\x.pdf'])
  })
})

describe('kindOf', () => {
  it('classifies by extension, case-insensitively', () => {
    expect(kindOf('C:\\A.PDF')).toBe('pdf')
    expect(kindOf('photo.Jpeg')).toBe('image')
    expect(kindOf('budget.xlsx')).toBe('office')
    expect(kindOf('archive.zip')).toBeNull()
    expect(kindOf('.pdf')).toBeNull()
  })
})

describe('parseCapabilities', () => {
  it('handles PowerShell collapsing one-element arrays and duplicate ids', () => {
    const caps = parseCapabilities(
      JSON.stringify({
        valid: true,
        canDuplex: false,
        supportsColor: true,
        paperSizes: [
          { value: '9', label: 'A4' },
          { value: '9', label: 'A4 (again)' },
          { value: '1', label: 'Letter' }
        ],
        trays: { value: '15', label: 'Automatically Select' }
      })
    )
    expect(caps).toEqual({
      canDuplex: false,
      supportsColor: true,
      paperSizes: [
        { value: '9', label: 'A4' },
        { value: '1', label: 'Letter' }
      ],
      trays: [{ value: '15', label: 'Automatically Select' }]
    })
  })
})

describe('installer', () => {
  it('registers the Explorer menu for every printable file type', () => {
    const nsh = readFileSync('build/installer.nsh', 'utf8')
    const installed = [...nsh.matchAll(/BatchPrintVerb "SystemFileAssociations\\(\.[a-z0-9]+)"/g)].map((m) => m[1])
    const removed = [...nsh.matchAll(/BatchPrintRemoveVerb "SystemFileAssociations\\(\.[a-z0-9]+)"/g)].map((m) => m[1])
    expect(installed.sort()).toEqual([...PRINTABLE_EXTENSIONS].sort())
    expect(removed.sort()).toEqual([...PRINTABLE_EXTENSIONS].sort())
  })
})

describe('pathsFromArgv in development', () => {
  it('ignores the app folder Electron passes along', () => {
    expect(pathsFromArgv(['electron', '/repo', '--add', '/repo', '/files/a.pdf'], ['/repo'])).toEqual(['/files/a.pdf'])
  })
})
