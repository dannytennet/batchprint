import { useEffect, useState } from 'react'
import type { OverridePatch } from '@shared/api'
import { parsePageRange } from '@shared/pageRange'
import {
  COLOR_LABELS,
  DUPLEX_LABELS,
  ORIENTATION_LABELS,
  SCALING_LABELS,
  effectiveSettings
} from '@shared/settings'
import type { BatchItem, PrintSettings, PrinterInfo, PrinterOption, SettingKey } from '@shared/types'
import { labelFor, paperOptions, trayOptions, usePrinterCaps } from '../caps'

const INHERIT = '__inherit__'
const MIXED = '__mixed__'

type Props =
  | {
      mode: 'defaults'
      defaults: PrintSettings
      printers: PrinterInfo[]
      onChange: (patch: Partial<PrintSettings>) => void
    }
  | {
      mode: 'items'
      defaults: PrintSettings
      items: BatchItem[]
      printers: PrinterInfo[]
      onPatch: (patch: OverridePatch) => void
    }

interface FieldState<K extends SettingKey> {
  /** The value shown, or null when the selection has different values. */
  value: PrintSettings[K] | null
  overridden: boolean
  mixed: boolean
}

export function SettingsEditor(props: Props) {
  const { defaults, printers } = props
  const items = props.mode === 'items' ? props.items : []

  function field<K extends SettingKey>(key: K): FieldState<K> {
    if (props.mode === 'defaults') return { value: defaults[key], overridden: false, mixed: false }
    const vals = items.map((i) => i.overrides[key])
    const first = vals[0]
    if (vals.every((v) => v === first)) {
      return first === undefined
        ? { value: defaults[key], overridden: false, mixed: false }
        : { value: first as PrintSettings[K], overridden: true, mixed: false }
    }
    return { value: null, overridden: vals.some((v) => v !== undefined), mixed: true }
  }

  const set = <K extends SettingKey>(key: K, value: PrintSettings[K] | null) => {
    if (props.mode === 'defaults') {
      if (value !== null) props.onChange({ [key]: value } as Partial<PrintSettings>)
    } else {
      props.onPatch({ [key]: value } as OverridePatch)
    }
  }

  // Paper sizes and trays depend on the printer the items will actually print on.
  const printerForCaps =
    props.mode === 'defaults' ? defaults.printer : effectiveSettings(defaults, items[0]?.overrides ?? {}).printer
  const caps = usePrinterCaps(printerForCaps)
  const papers = paperOptions(caps)
  const trays = trayOptions(caps)
  const defaultPrinterName = printers.find((p) => p.isDefault)?.name

  const printerOptions: PrinterOption[] = [
    { value: '', label: defaultPrinterName ? `System default (${defaultPrinterName})` : 'System default printer' },
    ...printers.map((p) => ({ value: p.name, label: p.name }))
  ]
  const enumOptions = (labels: Record<string, string>): PrinterOption[] =>
    Object.entries(labels).map(([value, label]) => ({ value, label }))

  const inheritLabel = (key: SettingKey, options?: PrinterOption[]) => {
    const v = defaults[key]
    if (key === 'paperSize' || key === 'tray') return v ? labelFor(options ?? [], String(v)) : 'Printer default'
    return options?.find((o) => o.value === String(v))?.label ?? String(v)
  }

  const select = (key: SettingKey, label: string, options: PrinterOption[], help?: string) => {
    const f = field(key)
    let opts = options
    const current = f.value === null ? null : String(f.value)
    if (current && !opts.some((o) => o.value === current)) {
      opts = [...opts, { value: current, label: key === 'printer' ? `${current} (not found)` : `#${current}` }]
    }
    const selected = f.mixed ? MIXED : props.mode === 'items' && !f.overridden ? INHERIT : (current ?? '')
    return (
      <Row label={label} overridden={f.overridden} onReset={props.mode === 'items' ? () => set(key, null) : undefined} help={help}>
        <select
          value={selected}
          onChange={(e) => {
            const v = e.target.value
            if (v === MIXED) return
            if (v === INHERIT) return set(key, null)
            set(key, v as PrintSettings[typeof key])
          }}
        >
          {f.mixed && <option value={MIXED}>Mixed values</option>}
          {props.mode === 'items' && <option value={INHERIT}>Batch default ({inheritLabel(key, options)})</option>}
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Row>
    )
  }

  const copies = field('copies')
  const range = field('pageRange')

  return (
    <div className="settings-editor">
      {select('printer', 'Printer', printerOptions)}
      <Row
        label="Copies"
        overridden={copies.overridden}
        onReset={props.mode === 'items' ? () => set('copies', null) : undefined}
      >
        <CommitInput
          type="number"
          min={1}
          max={999}
          value={props.mode === 'items' && !copies.overridden ? '' : copies.value === null ? '' : String(copies.value)}
          placeholder={copies.mixed ? 'Mixed' : props.mode === 'items' ? `${defaults.copies} (batch default)` : ''}
          onCommit={(text) => {
            if (text.trim() === '') return props.mode === 'items' ? set('copies', null) : undefined
            const n = Number(text)
            if (Number.isFinite(n) && n >= 1) set('copies', Math.round(n))
          }}
        />
      </Row>
      <Row
        label="Pages"
        overridden={range.overridden}
        onReset={props.mode === 'items' ? () => set('pageRange', null) : undefined}
        help={props.mode === 'items' ? 'e.g. 1-3, 5, 8-  (type "all" for every page)' : 'e.g. 1-3, 5, 8-  (blank for all pages)'}
      >
        <PageRangeInput
          value={
            props.mode === 'items' && !range.overridden ? '' : range.value === '' && props.mode === 'items' ? 'all' : (range.value ?? '')
          }
          placeholder={
            range.mixed
              ? 'Mixed'
              : props.mode === 'items'
                ? `${defaults.pageRange || 'All pages'} (batch default)`
                : 'All pages'
          }
          onCommit={(text) => {
            const t = text.trim()
            if (props.mode === 'items' && t === '') return set('pageRange', null)
            if (t.toLowerCase() === 'all') return set('pageRange', '')
            const parsed = parsePageRange(t)
            if (parsed.ok) set('pageRange', parsed.normalized)
          }}
        />
      </Row>
      {select('duplex', 'Sides', enumOptions(DUPLEX_LABELS), caps && !caps.canDuplex ? 'This printer does not report two-sided support.' : undefined)}
      {select('color', 'Colour', enumOptions(COLOR_LABELS), caps && !caps.supportsColor ? 'This printer is black & white only.' : undefined)}
      {select('paperSize', 'Paper size', [{ value: '', label: 'Printer default' }, ...papers])}
      {select('tray', 'Tray', [{ value: '', label: 'Printer default' }, ...trays])}
      {select('orientation', 'Orientation', enumOptions(ORIENTATION_LABELS))}
      {select('scaling', 'Scaling', enumOptions(SCALING_LABELS))}
    </div>
  )
}

function Row(props: {
  label: string
  overridden: boolean
  onReset?: () => void
  help?: string
  children: React.ReactNode
}) {
  return (
    <div className={`field ${props.overridden ? 'overridden' : ''}`}>
      <label className="field-label">
        <span>{props.label}</span>
        {props.onReset && props.overridden && (
          <button type="button" className="reset-btn" onClick={props.onReset} title="Go back to the batch default">
            Reset
          </button>
        )}
      </label>
      {props.children}
      {props.help && <div className="field-help">{props.help}</div>}
    </div>
  )
}

/** A text input that only reports its value on Enter or blur, so typing doesn't save every keystroke. */
function CommitInput(
  props: { value: string; onCommit: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>
) {
  const { value, onCommit, ...rest } = props
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  return (
    <input
      {...rest}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== value && onCommit(text)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') setText(value)
      }}
    />
  )
}

function PageRangeInput(props: { value: string; placeholder: string; onCommit: (v: string) => void }) {
  const [text, setText] = useState(props.value)
  useEffect(() => setText(props.value), [props.value])
  const t = text.trim()
  const error = t && t.toLowerCase() !== 'all' ? parsePageRange(t).error : undefined
  return (
    <>
      <input
        value={text}
        placeholder={props.placeholder}
        className={error ? 'invalid' : ''}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => !error && text !== props.value && props.onCommit(text)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') setText(props.value)
        }}
      />
      {error && <div className="field-error">{error}</div>}
    </>
  )
}
