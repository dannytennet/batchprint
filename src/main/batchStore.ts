import { promises as fs, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DEFAULT_SETTINGS, SETTING_KEYS, applyOverridePatch } from '@shared/settings'
import type { OverridePatch } from '@shared/api'
import type { Batch, BatchItem, BatchSummary, PrintSettings } from '@shared/types'
import { DebouncedWriter, readJsonSync } from './jsonFile'


/**
 * Owns every batch. All mutations go through here so the renderer and the
 * Explorer context menu can both change batches without stepping on each other.
 */
export class BatchStore {
  private batches = new Map<string, Batch>()
  private writer = new DebouncedWriter()
  private listeners: Array<(batch: Batch | null, id: string) => void> = []

  constructor(private dir: string) {}

  load(): void {
    let files: string[] = []
    try {
      files = readdirSync(this.dir).filter((f) => f.endsWith('.json'))
    } catch {
      return
    }
    for (const f of files) {
      const b = readJsonSync<Batch | null>(join(this.dir, f), null)
      if (b && b.id && Array.isArray(b.items)) this.batches.set(b.id, normaliseBatch(b))
    }
  }

  onChange(fn: (batch: Batch | null, id: string) => void): void {
    this.listeners.push(fn)
  }

  list(): BatchSummary[] {
    return [...this.batches.values()]
      .map((b) => ({ id: b.id, name: b.name, itemCount: b.items.length, updatedAt: b.updatedAt }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
  }

  get(id: string): Batch | undefined {
    return this.batches.get(id)
  }

  require(id: string): Batch {
    const b = this.batches.get(id)
    if (!b) throw new Error('That batch no longer exists.')
    return b
  }

  create(name: string, defaults: PrintSettings = DEFAULT_SETTINGS): Batch {
    const now = Date.now()
    const batch: Batch = {
      id: randomUUID(),
      name: this.uniqueName(name.trim() || 'New batch'),
      createdAt: now,
      updatedAt: now,
      defaults: { ...defaults },
      items: []
    }
    this.batches.set(batch.id, batch)
    this.changed(batch)
    return batch
  }

  /** Imports a batch from an exported file, giving it and its items fresh ids. */
  import(raw: unknown): Batch {
    const src = raw as Partial<Batch>
    if (!src || typeof src !== 'object' || !Array.isArray(src.items)) {
      throw new Error('That file is not a Batch Print export.')
    }
    const batch = normaliseBatch({
      ...(src as Batch),
      id: randomUUID(),
      name: this.uniqueName(String(src.name ?? 'Imported batch')),
      createdAt: Date.now(),
      items: src.items.map((i) => ({ ...i, id: randomUUID(), status: 'preparing' as const }))
    })
    this.batches.set(batch.id, batch)
    this.changed(batch)
    return batch
  }

  duplicate(id: string): Batch {
    const src = this.require(id)
    const copy = this.create(`${src.name} (copy)`, src.defaults)
    copy.items = src.items.map((i) => ({ ...i, id: randomUUID(), overrides: { ...i.overrides } }))
    this.changed(copy)
    return copy
  }

  rename(id: string, name: string): void {
    const b = this.require(id)
    const trimmed = name.trim()
    if (!trimmed || trimmed === b.name) return
    b.name = this.uniqueName(trimmed, id)
    this.changed(b)
  }

  async delete(id: string): Promise<void> {
    if (!this.batches.delete(id)) return
    await this.writer.flushAll()
    await fs.rm(this.file(id), { force: true })
    for (const l of this.listeners) l(null, id)
  }

  setDefaults(id: string, patch: Partial<PrintSettings>): void {
    const b = this.require(id)
    b.defaults = { ...b.defaults, ...patch }
    this.changed(b)
  }

  addItems(id: string, items: BatchItem[]): void {
    const b = this.require(id)
    b.items.push(...items)
    this.changed(b)
  }

  removeItems(id: string, itemIds: string[]): void {
    const b = this.require(id)
    const drop = new Set(itemIds)
    b.items = b.items.filter((i) => !drop.has(i.id))
    this.changed(b)
  }

  /** Reorders to match `orderedIds`. Unknown ids are ignored and missing items keep their relative order at the end. */
  reorder(id: string, orderedIds: string[]): void {
    const b = this.require(id)
    const byId = new Map(b.items.map((i) => [i.id, i]))
    const next: BatchItem[] = []
    for (const itemId of orderedIds) {
      const item = byId.get(itemId)
      if (item) {
        next.push(item)
        byId.delete(itemId)
      }
    }
    next.push(...byId.values())
    b.items = next
    this.changed(b)
  }

  patchOverrides(id: string, itemIds: string[], patch: OverridePatch): void {
    const b = this.require(id)
    const ids = new Set(itemIds)
    for (const item of b.items) {
      if (ids.has(item.id)) item.overrides = applyOverridePatch(item.overrides, patch)
    }
    this.changed(b)
  }

  updateItem(id: string, itemId: string, patch: Partial<BatchItem>): void {
    const b = this.batches.get(id)
    const item = b?.items.find((i) => i.id === itemId)
    if (!b || !item) return
    Object.assign(item, patch)
    this.changed(b, false)
  }

  setEnabled(id: string, itemIds: string[], enabled: boolean): void {
    const b = this.require(id)
    const ids = new Set(itemIds)
    for (const item of b.items) if (ids.has(item.id)) item.enabled = enabled
    this.changed(b)
  }

  flush(): Promise<void> {
    return this.writer.flushAll()
  }

  private file(id: string): string {
    return join(this.dir, `${id}.json`)
  }

  private uniqueName(name: string, exceptId?: string): string {
    const taken = new Set(
      [...this.batches.values()].filter((b) => b.id !== exceptId).map((b) => b.name.toLowerCase())
    )
    if (!taken.has(name.toLowerCase())) return name
    for (let n = 2; ; n++) {
      const candidate = `${name} ${n}`
      if (!taken.has(candidate.toLowerCase())) return candidate
    }
  }

  private changed(b: Batch, touch = true): void {
    if (touch) b.updatedAt = Date.now()
    this.writer.schedule(this.file(b.id), () => b)
    for (const l of this.listeners) l(b, b.id)
  }
}

/** Fills in anything missing from older or hand-edited batch files. */
export function normaliseBatch(b: Batch): Batch {
  const defaults = { ...DEFAULT_SETTINGS }
  for (const k of SETTING_KEYS) {
    const v = b.defaults?.[k]
    if (v !== undefined && typeof v === typeof DEFAULT_SETTINGS[k]) (defaults as Record<string, unknown>)[k] = v
  }
  return {
    ...b,
    name: String(b.name ?? 'Batch'),
    createdAt: b.createdAt ?? Date.now(),
    updatedAt: b.updatedAt ?? Date.now(),
    defaults,
    items: b.items
      .filter((i) => i && typeof i.path === 'string')
      .map((i) => ({
        ...i,
        enabled: i.enabled !== false,
        overrides: i.overrides ?? {},
        // Preparation state is recomputed on load.
        status: 'preparing' as const,
        error: undefined
      }))
  }
}
