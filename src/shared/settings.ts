import type { BatchItem, PrintSettings, SettingKey, SettingsOverride } from './types'

export const DEFAULT_SETTINGS: PrintSettings = {
  printer: '',
  copies: 1,
  duplex: 'printer',
  color: 'printer',
  paperSize: '',
  tray: '',
  pageRange: '',
  orientation: 'auto',
  scaling: 'fit'
}

export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as SettingKey[]

export function effectiveSettings(defaults: PrintSettings, overrides: SettingsOverride): PrintSettings {
  const out = { ...defaults }
  for (const key of SETTING_KEYS) {
    const v = overrides[key]
    if (v !== undefined) (out as Record<SettingKey, unknown>)[key] = v
  }
  return out
}

/** Applies a patch to overrides, where `null` clears an override back to inherited. */
export function applyOverridePatch(
  overrides: SettingsOverride,
  patch: { [K in SettingKey]?: PrintSettings[K] | null }
): SettingsOverride {
  const out: SettingsOverride = { ...overrides }
  for (const key of SETTING_KEYS) {
    if (!(key in patch)) continue
    const v = patch[key]
    if (v === null || v === undefined) delete out[key]
    else (out as Record<SettingKey, unknown>)[key] = v
  }
  return out
}

export function clampCopies(n: number): number {
  if (!Number.isFinite(n)) return 1
  return Math.min(999, Math.max(1, Math.round(n)))
}

export const DUPLEX_LABELS: Record<PrintSettings['duplex'], string> = {
  printer: 'Printer default',
  simplex: 'One-sided',
  long: 'Two-sided (long edge)',
  short: 'Two-sided (short edge)'
}

export const COLOR_LABELS: Record<PrintSettings['color'], string> = {
  printer: 'Printer default',
  color: 'Colour',
  mono: 'Black & white'
}

export const ORIENTATION_LABELS: Record<PrintSettings['orientation'], string> = {
  auto: 'Automatic',
  portrait: 'Portrait',
  landscape: 'Landscape'
}

export const SCALING_LABELS: Record<PrintSettings['scaling'], string> = {
  fit: 'Fit to page',
  shrink: 'Shrink oversized pages',
  noscale: 'Actual size'
}

/** Short human readable description of settings, used in lists and the history log. */
export function describeSettings(s: PrintSettings, labels?: { paper?: string; tray?: string }): string {
  const parts: string[] = []
  parts.push(`${s.copies}×`)
  if (s.pageRange.trim()) parts.push(`pages ${s.pageRange.trim()}`)
  if (s.duplex !== 'printer') parts.push(DUPLEX_LABELS[s.duplex])
  if (s.color !== 'printer') parts.push(COLOR_LABELS[s.color])
  if (s.paperSize) parts.push(labels?.paper ?? s.paperSize)
  if (s.tray) parts.push(`tray: ${labels?.tray ?? s.tray}`)
  if (s.orientation !== 'auto') parts.push(ORIENTATION_LABELS[s.orientation])
  parts.push(SCALING_LABELS[s.scaling])
  return parts.join(', ')
}

export function overriddenKeys(item: BatchItem): SettingKey[] {
  return SETTING_KEYS.filter((k) => item.overrides[k] !== undefined)
}
