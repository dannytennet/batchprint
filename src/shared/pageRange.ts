export interface ParsedRange {
  ok: boolean
  error?: string
  /** Normalised range string, e.g. "1-3,5". Empty for all pages. */
  normalized: string
}

/**
 * Validates a page range like "1-3, 5, 8-". Blank means all pages.
 * An open-ended range ("8-") runs to the last page.
 */
export function parsePageRange(input: string): ParsedRange {
  const text = input.trim()
  if (!text) return { ok: true, normalized: '' }
  const parts = text.split(/[,;]/).map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return { ok: true, normalized: '' }
  const out: string[] = []
  for (const part of parts) {
    let m = /^(\d+)$/.exec(part)
    if (m) {
      const n = Number(m[1])
      if (n < 1) return { ok: false, error: `Page numbers start at 1 ("${part}")`, normalized: '' }
      out.push(String(n))
      continue
    }
    m = /^(\d+)\s*-\s*(\d*)$/.exec(part)
    if (m) {
      const from = Number(m[1])
      if (from < 1) return { ok: false, error: `Page numbers start at 1 ("${part}")`, normalized: '' }
      if (m[2] === '') {
        out.push(`${from}-`)
        continue
      }
      const to = Number(m[2])
      if (to < from) return { ok: false, error: `"${part}" runs backwards`, normalized: '' }
      out.push(from === to ? String(from) : `${from}-${to}`)
      continue
    }
    return { ok: false, error: `"${part}" is not a page or range`, normalized: '' }
  }
  return { ok: true, normalized: out.join(',') }
}

/** Pages selected by a range within a document of `pageCount` pages. */
export function selectedPages(range: string, pageCount: number): number[] {
  const parsed = parsePageRange(range)
  if (!parsed.ok || !parsed.normalized) return Array.from({ length: pageCount }, (_, i) => i + 1)
  const pages: number[] = []
  for (const part of parsed.normalized.split(',')) {
    const [a, b] = part.split('-')
    const from = Number(a)
    const to = b === undefined ? from : b === '' ? pageCount : Number(b)
    for (let p = from; p <= Math.min(to, pageCount); p++) pages.push(p)
  }
  return pages
}

/**
 * Converts a normalised range to SumatraPDF -print-settings tokens. Open-ended
 * ranges use Sumatra's "-1" (last page) notation.
 */
export function rangeToSumatraTokens(range: string): string[] {
  const parsed = parsePageRange(range)
  if (!parsed.ok || !parsed.normalized) return []
  return parsed.normalized.split(',').map((p) => (p.endsWith('-') ? `${p}-1` : p))
}
