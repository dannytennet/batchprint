import { useEffect, useRef, useState } from 'react'
import { selectedPages } from '@shared/pageRange'
import type { BatchItem } from '@shared/types'
import { getPreview, renderPage, type LoadedPreview } from '../pdf'

interface Props {
  batchId: string
  item: BatchItem
  pageRange: string
}

export function PreviewPane({ batchId, item, pageRange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [preview, setPreview] = useState<LoadedPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const version = `${item.status}:${item.pageCount ?? ''}`
  useEffect(() => {
    setPreview(null)
    setError(null)
    setPage(1)
    if (item.status !== 'ready') return
    let stale = false
    getPreview(batchId, item.id, version)
      .then((p) => !stale && setPreview(p))
      .catch((e: Error) => !stale && setError(e.message))
    return () => {
      stale = true
    }
  }, [batchId, item.id, item.status, version])

  useEffect(() => {
    if (!preview || preview.kind !== 'pdf' || !canvasRef.current || !boxRef.current) return
    const box = boxRef.current
    void renderPage(preview, page, canvasRef.current, box.clientWidth - 16, 360).catch((e: Error) => setError(e.message))
  }, [preview, page])

  if (item.status === 'preparing') return <div className="preview preview-msg">Preparing preview…</div>
  if (item.status === 'error') return <div className="preview preview-msg error-text">{item.error}</div>
  if (error) return <div className="preview preview-msg">No preview available</div>
  if (!preview) return <div className="preview preview-msg">Loading…</div>

  const printed = new Set(selectedPages(pageRange, preview.pageCount))
  const excluded = !printed.has(page)

  return (
    <div className="preview" ref={boxRef}>
      <div className={`preview-page ${excluded ? 'excluded' : ''}`}>
        {preview.kind === 'image' ? (
          <img src={preview.imageUrl} alt={item.name} onError={() => setError('unsupported')} />
        ) : (
          <canvas ref={canvasRef} />
        )}
        {excluded && <span className="excluded-badge">Not printed</span>}
      </div>
      {preview.pageCount > 1 && (
        <div className="preview-nav">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Previous page">
            ‹
          </button>
          <span>
            Page {page} of {preview.pageCount}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(preview.pageCount, p + 1))}
            disabled={page >= preview.pageCount}
            aria-label="Next page"
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}
