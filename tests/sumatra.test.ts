import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { buildSumatraArgs } from '../src/main/sumatra'

describe('buildSumatraArgs', () => {
  it('prints to the default printer with minimal settings', () => {
    expect(buildSumatraArgs(DEFAULT_SETTINGS, 'C:\\a.pdf')).toEqual([
      '-print-to-default',
      '-print-settings',
      '1x,fit',
      '-silent',
      'C:\\a.pdf'
    ])
  })

  it('maps every setting to its SumatraPDF token', () => {
    const args = buildSumatraArgs(
      {
        printer: 'HP LaserJet, 2nd floor',
        copies: 3,
        duplex: 'short',
        color: 'mono',
        paperSize: '9',
        tray: '260',
        pageRange: '1-2,5-',
        orientation: 'landscape',
        scaling: 'noscale'
      },
      'C:\\docs\\b.pdf'
    )
    expect(args).toEqual([
      '-print-to',
      'HP LaserJet, 2nd floor',
      '-print-settings',
      '1-2,5--1,3x,duplexshort,monochrome,paper=9,bin=260,landscape,noscale',
      '-silent',
      'C:\\docs\\b.pdf'
    ])
  })
})
