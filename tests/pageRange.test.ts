import { describe, expect, it } from 'vitest'
import { parsePageRange, rangeToSumatraTokens, selectedPages } from '@shared/pageRange'

describe('parsePageRange', () => {
  it('accepts blank as all pages', () => {
    expect(parsePageRange('  ')).toEqual({ ok: true, normalized: '' })
  })

  it('normalises spacing, separators and single-page ranges', () => {
    expect(parsePageRange(' 1 - 3 ; 5,7-7, 9- ').normalized).toBe('1-3,5,7,9-')
  })

  it('rejects backwards ranges, zero and junk', () => {
    expect(parsePageRange('5-2').ok).toBe(false)
    expect(parsePageRange('0').ok).toBe(false)
    expect(parsePageRange('1,abc').error).toContain('abc')
  })
})

describe('selectedPages', () => {
  it('returns every page for a blank range', () => {
    expect(selectedPages('', 3)).toEqual([1, 2, 3])
  })

  it('clips to the document and expands open-ended ranges', () => {
    expect(selectedPages('2,4-', 6)).toEqual([2, 4, 5, 6])
    expect(selectedPages('5-9', 6)).toEqual([5, 6])
    expect(selectedPages('8', 6)).toEqual([])
  })
})

describe('rangeToSumatraTokens', () => {
  it('uses -1 for "to the last page"', () => {
    expect(rangeToSumatraTokens('1-3, 8-')).toEqual(['1-3', '8--1'])
    expect(rangeToSumatraTokens('')).toEqual([])
  })
})
