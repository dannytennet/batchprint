import type { FileKind } from './types'

const PDF = ['.pdf']
const IMAGE = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tif', '.tiff', '.webp']
const OFFICE = [
  '.doc', '.docx', '.docm', '.dot', '.dotx', '.rtf', '.odt', '.txt',
  '.xls', '.xlsx', '.xlsm', '.xlsb', '.ods', '.csv',
  '.ppt', '.pptx', '.pptm', '.pps', '.ppsx', '.odp'
]

export const PRINTABLE_EXTENSIONS = [...PDF, ...IMAGE, ...OFFICE]

export function extensionOf(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? ''
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot).toLowerCase() : ''
}

export function kindOf(path: string): FileKind | null {
  const ext = extensionOf(path)
  if (PDF.includes(ext)) return 'pdf'
  if (IMAGE.includes(ext)) return 'image'
  if (OFFICE.includes(ext)) return 'office'
  return null
}

export function imageMime(path: string): string {
  const ext = extensionOf(path)
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.tif':
    case '.tiff':
      return 'image/tiff'
    default:
      return `image/${ext.slice(1)}`
  }
}

/** Office lock files ("~$report.docx") and similar temp files that should never be batched. */
export function isJunkFile(name: string): boolean {
  return name.startsWith('~$') || name.startsWith('.~lock') || name.toLowerCase() === 'thumbs.db'
}
