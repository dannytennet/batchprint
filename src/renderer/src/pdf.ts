import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PreviewSource } from '@shared/types'
import { api } from './api'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export interface LoadedPreview {
  kind: 'pdf' | 'image'
  pdf?: PDFDocumentProxy
  imageUrl?: string
  pageCount: number
}

const previews = new Map<string, Promise<LoadedPreview>>()
const thumbs = new Map<string, Promise<string | null>>()

// Only a few previews load at once so a big batch does not flood the main process.
let active = 0
const waiting: Array<() => void> = []
async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 3) await new Promise<void>((r) => waiting.push(r))
  active++
  try {
    return await fn()
  } finally {
    active--
    waiting.shift()?.()
  }
}

async function load(src: PreviewSource): Promise<LoadedPreview> {
  if (src.kind === 'image') {
    const url = URL.createObjectURL(new Blob([src.data as BlobPart], { type: src.mime }))
    return { kind: 'image', imageUrl: url, pageCount: 1 }
  }
  const pdf = await pdfjs.getDocument({ data: src.data }).promise
  return { kind: 'pdf', pdf, pageCount: pdf.numPages }
}

/** Loads (and caches) an item's preview. `version` changes when the item is re-prepared. */
export function getPreview(batchId: string, itemId: string, version: string): Promise<LoadedPreview> {
  const key = `${itemId}:${version}`
  let p = previews.get(key)
  if (!p) {
    p = limited(() => api.getPreview(batchId, itemId).then(load))
    previews.set(key, p)
    p.catch(() => previews.delete(key))
  }
  return p
}

export async function renderPage(
  preview: LoadedPreview,
  page: number,
  canvas: HTMLCanvasElement,
  maxWidth: number,
  maxHeight: number
): Promise<void> {
  if (!preview.pdf) return
  const p = await preview.pdf.getPage(page)
  const base = p.getViewport({ scale: 1 })
  const scale = Math.min(maxWidth / base.width, maxHeight / base.height)
  const ratio = window.devicePixelRatio || 1
  const viewport = p.getViewport({ scale: scale * ratio })
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  canvas.style.width = `${Math.floor(viewport.width / ratio)}px`
  canvas.style.height = `${Math.floor(viewport.height / ratio)}px`
  await p.render({ canvas, viewport }).promise
}

/** A small image of the first page, as a data or blob URL. */
export function getThumbnail(batchId: string, itemId: string, version: string): Promise<string | null> {
  const key = `${itemId}:${version}`
  let t = thumbs.get(key)
  if (!t) {
    t = getPreview(batchId, itemId, version).then(async (preview) => {
      if (preview.kind === 'image') return preview.imageUrl ?? null
      const canvas = document.createElement('canvas')
      await renderPage(preview, 1, canvas, 96, 96)
      return canvas.toDataURL('image/png')
    })
    thumbs.set(key, t)
    t.catch(() => thumbs.delete(key))
  }
  return t
}
