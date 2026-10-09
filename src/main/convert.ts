import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const CONVERT_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Converts Office documents to PDF with LibreOffice so they can be previewed,
 * counted and printed with the same settings as any other PDF. Results are
 * cached by path, size and modified time, so an edited file is reconverted.
 */
export class OfficeConverter {
  private queue: Promise<unknown> = Promise.resolve()
  private inFlight = new Map<string, Promise<string>>()

  constructor(
    private cacheDir: string,
    private getSoffice: () => string | null
  ) {}

  async toPdf(source: string): Promise<string> {
    const stat = await fs.stat(source)
    const key = createHash('sha1')
      .update(`${source.toLowerCase()}|${stat.size}|${stat.mtimeMs}`)
      .digest('hex')
    const target = join(this.cacheDir, `${key}.pdf`)
    try {
      await fs.access(target)
      return target
    } catch {
      // not cached yet
    }
    const existing = this.inFlight.get(key)
    if (existing) return existing

    // LibreOffice copes badly with parallel conversions, so they run one at a time.
    const job = this.queue.then(() => this.convert(source, target))
    this.queue = job.catch(() => undefined)
    this.inFlight.set(key, job)
    try {
      return await job
    } finally {
      this.inFlight.delete(key)
    }
  }

  private async convert(source: string, target: string): Promise<string> {
    const soffice = this.getSoffice()
    if (!soffice) {
      throw new Error('LibreOffice was not found. Install it or set its location in Settings.')
    }
    const outDir = join(this.cacheDir, `tmp-${process.pid}-${Date.now()}`)
    await fs.mkdir(outDir, { recursive: true })
    // A private profile stops conversions clashing with a LibreOffice window the user has open.
    const profile = pathToFileURL(join(this.cacheDir, 'lo-profile')).href
    try {
      await new Promise<void>((resolve, reject) => {
        execFile(
          soffice,
          [
            `-env:UserInstallation=${profile}`,
            '--headless',
            '--norestore',
            '--nologo',
            '--nodefault',
            '--convert-to',
            'pdf',
            '--outdir',
            outDir,
            source
          ],
          { timeout: CONVERT_TIMEOUT_MS, windowsHide: true },
          (err, _stdout, stderr) => {
            if (err) reject(new Error(`LibreOffice could not convert the file. ${String(stderr || err.message).trim()}`))
            else resolve()
          }
        )
      })
      const produced = join(outDir, `${basename(source, extname(source))}.pdf`)
      try {
        await fs.rename(produced, target)
      } catch {
        throw new Error('LibreOffice finished without producing a PDF. The file may be damaged or password protected.')
      }
      return target
    } finally {
      await fs.rm(outDir, { recursive: true, force: true })
    }
  }
}
