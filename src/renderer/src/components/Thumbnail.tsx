import { useEffect, useRef, useState } from 'react'
import type { BatchItem } from '@shared/types'
import { getThumbnail } from '../pdf'

const KIND_LABEL: Record<BatchItem['kind'], string> = { pdf: 'PDF', image: 'IMG', office: 'DOC' }

/** First-page thumbnail, loaded only once the row scrolls into view. */
export function Thumbnail({ batchId, item }: { batchId: string; item: BatchItem }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const version = `${item.status}:${item.pageCount ?? ''}`
  useEffect(() => {
    if (!visible || item.status !== 'ready') return
    let stale = false
    setFailed(false)
    getThumbnail(batchId, item.id, version)
      .then((url) => !stale && setSrc(url))
      .catch(() => !stale && setFailed(true))
    return () => {
      stale = true
    }
  }, [visible, batchId, item.id, item.status, version])

  return (
    <div ref={ref} className={`thumb thumb-${item.kind}`}>
      {src && !failed ? (
        <img src={src} alt="" draggable={false} onError={() => setFailed(true)} />
      ) : (
        <span className="thumb-label">{item.status === 'preparing' ? '…' : KIND_LABEL[item.kind]}</span>
      )}
    </div>
  )
}
