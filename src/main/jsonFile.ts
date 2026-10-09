import { promises as fs, readFileSync } from 'node:fs'
import { dirname } from 'node:path'

export function readJsonSync<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    return fallback
  }
}

/** Writes via a temp file and rename so a crash mid-write never leaves a truncated file. */
export async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.tmp`
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8')
  await fs.rename(tmp, path)
}

/** Serialises writes per file and coalesces bursts of changes into one write. */
export class DebouncedWriter {
  private timers = new Map<string, NodeJS.Timeout>()
  private pending = new Map<string, () => unknown>()
  private chain: Promise<void> = Promise.resolve()

  constructor(private delayMs = 250) {}

  schedule(path: string, getValue: () => unknown): void {
    this.pending.set(path, getValue)
    clearTimeout(this.timers.get(path))
    this.timers.set(path, setTimeout(() => this.flushOne(path), this.delayMs))
  }

  private flushOne(path: string): Promise<void> {
    clearTimeout(this.timers.get(path))
    this.timers.delete(path)
    const get = this.pending.get(path)
    this.pending.delete(path)
    if (!get) return this.chain
    const value = get()
    this.chain = this.chain.then(() => writeJsonAtomic(path, value)).catch((err) => {
      console.error(`Failed to save ${path}`, err)
    })
    return this.chain
  }

  async flushAll(): Promise<void> {
    await Promise.all([...this.pending.keys()].map((p) => this.flushOne(p)))
    await this.chain
  }
}
