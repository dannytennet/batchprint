import { promises as fs } from 'node:fs'
import { PDFDocument } from 'pdf-lib'

export async function pdfPageCount(path: string): Promise<number> {
  const bytes = await fs.readFile(path)
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
    return doc.getPageCount()
  } catch (err) {
    throw new Error(`Could not read the PDF: ${(err as Error).message}`)
  }
}
