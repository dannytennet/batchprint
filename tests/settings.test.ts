import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, applyOverridePatch, clampCopies, describeSettings, effectiveSettings } from '@shared/settings'

describe('effectiveSettings', () => {
  it('uses batch defaults where an item has no override', () => {
    const defaults = { ...DEFAULT_SETTINGS, printer: 'Office', copies: 2 }
    expect(effectiveSettings(defaults, { copies: 5 })).toEqual({ ...defaults, copies: 5 })
  })

  it('treats an empty-string override as a real value, not inherit', () => {
    const defaults = { ...DEFAULT_SETTINGS, pageRange: '1-2' }
    expect(effectiveSettings(defaults, { pageRange: '' }).pageRange).toBe('')
  })
})

describe('applyOverridePatch', () => {
  it('sets values and clears overrides with null', () => {
    const out = applyOverridePatch({ copies: 3, duplex: 'long' }, { copies: null, color: 'mono' })
    expect(out).toEqual({ duplex: 'long', color: 'mono' })
  })

  it('leaves keys that are not in the patch alone', () => {
    expect(applyOverridePatch({ tray: '2' }, {})).toEqual({ tray: '2' })
  })
})

describe('clampCopies', () => {
  it('keeps copies between 1 and 999', () => {
    expect(clampCopies(0)).toBe(1)
    expect(clampCopies(2.6)).toBe(3)
    expect(clampCopies(5000)).toBe(999)
    expect(clampCopies(Number.NaN)).toBe(1)
  })
})

describe('describeSettings', () => {
  it('summarises the settings that differ from printer defaults', () => {
    const text = describeSettings({ ...DEFAULT_SETTINGS, copies: 2, pageRange: '1-3', duplex: 'long', color: 'mono' })
    expect(text).toBe('2×, pages 1-3, Two-sided (long edge), Black & white, Fit to page')
  })
})
