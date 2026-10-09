import { promises as fs } from 'node:fs'
import type { BatchItem } from '@shared/types'
import type { OfficeConverter } from './convert'
import { pdfPageCount } from './pdf'

/**
 * Turns a batch item into something the print engine and previewer can use:
 * PDFs and images as they are, Office documents converted to PDF.
 */
export class Preparer {
  private pageCounts = new Map<string, Promise<number | undefined>>()

  constructor(private converter: OfficeConverter) {}

  async printablePath(item: BatchItem): Promise<string> {
    try {
      await fs.access(item.path)
    } catch {
      throw new Error('The file has been moved or deleted.')
    }
    if (item.kind === 'office') return this.converter.toPdf(item.path)
    return item.path
  }

  /** Page count, or undefined when it cannot be known up front (multi-page TIFFs aside, images are one page). */
  async pageCount(item: BatchItem): Promise<number | undefined> {
    const printable = await this.printablePath(item)
    if (item.kind === 'image') return 1
    const stat = await fs.stat(printable)
    const key = `${printable}|${stat.mtimeMs}`
    let p = this.pageCounts.get(key)
    if (!p) {
      p = pdfPageCount(printable)
      this.pageCounts.set(key, p)
      p.catch(() => this.pageCounts.delete(key))
    }
    return p
  }
}
