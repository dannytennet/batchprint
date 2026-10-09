import { randomUUID } from 'node:crypto'
import type { HistoryEntry } from '@shared/types'
import { DebouncedWriter, readJsonSync } from './jsonFile'

const MAX_ENTRIES = 5000

export class History {
  private entries: HistoryEntry[]
  private writer = new DebouncedWriter(500)

  constructor(private path: string) {
    this.entries = readJsonSync<HistoryEntry[]>(path, [])
    if (!Array.isArray(this.entries)) this.entries = []
  }

  add(entry: Omit<HistoryEntry, 'id' | 'at'>): HistoryEntry {
    const full: HistoryEntry = { id: randomUUID(), at: Date.now(), ...entry }
    this.entries.unshift(full)
    if (this.entries.length > MAX_ENTRIES) this.entries.length = MAX_ENTRIES
    this.writer.schedule(this.path, () => this.entries)
    return full
  }

  list(): HistoryEntry[] {
    return this.entries
  }

  clear(): void {
    this.entries = []
    this.writer.schedule(this.path, () => this.entries)
  }

  flush(): Promise<void> {
    return this.writer.flushAll()
  }
}
