import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { selectedPages } from '@shared/pageRange'
import { moveItems } from '@shared/reorder'
import { effectiveSettings, overriddenKeys } from '@shared/settings'
import type { Batch, BatchItem, JobItemState, PrintSettings } from '@shared/types'
import { Thumbnail } from './Thumbnail'

interface Props {
  batch: Batch
  selection: Set<string>
  jobStates: Record<string, JobItemState>
  jobErrors: Record<string, string>
  onRowClick: (id: string, e: React.MouseEvent) => void
  onReorder: (orderedIds: string[]) => void
  onToggleEnabled: (item: BatchItem) => void
  onContextMenu: (id: string, e: React.MouseEvent) => void
}

export function ItemList(props: Props) {
  const { batch } = props
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const ids = batch.items.map((i) => i.id)

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return
    const next = moveItems(ids, props.selection, String(e.active.id), String(e.over.id))
    if (next !== ids) props.onReorder(next)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className="item-list" aria-label="Items in this batch">
          {batch.items.map((item, index) => (
            <Row
              key={item.id}
              index={index}
              item={item}
              batch={batch}
              selected={props.selection.has(item.id)}
              jobState={props.jobStates[item.id]}
              jobError={props.jobErrors[item.id]}
              onClick={(e) => props.onRowClick(item.id, e)}
              onToggleEnabled={() => props.onToggleEnabled(item)}
              onContextMenu={(e) => props.onContextMenu(item.id, e)}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}

const JOB_LABEL: Record<JobItemState, string> = {
  queued: 'Queued',
  preparing: 'Preparing',
  printing: 'Printing',
  done: 'Sent to printer',
  failed: 'Failed',
  cancelled: 'Cancelled'
}

function Row(props: {
  index: number
  item: BatchItem
  batch: Batch
  selected: boolean
  jobState?: JobItemState
  jobError?: string
  onClick: (e: React.MouseEvent) => void
  onToggleEnabled: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const { item, batch } = props
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const settings = effectiveSettings(batch.defaults, item.overrides)
  const overridden = overriddenKeys(item)
  const folder = item.path.slice(0, item.path.length - item.name.length).replace(/[\\/]$/, '')

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[
        'item-row',
        props.selected && 'selected',
        !item.enabled && 'disabled',
        isDragging && 'dragging',
        props.jobState && `job-${props.jobState}`
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={props.onClick}
      onContextMenu={props.onContextMenu}
      aria-selected={props.selected}
      {...attributes}
      {...listeners}
    >
      <span className="row-index">{props.index + 1}</span>
      <input
        type="checkbox"
        checked={item.enabled}
        title={item.enabled ? 'Included when the batch prints' : 'Skipped when the batch prints'}
        onChange={props.onToggleEnabled}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      />
      <Thumbnail batchId={batch.id} item={item} />
      <div className="row-main">
        <div className="row-name" title={item.path}>
          {item.name}
        </div>
        <div className="row-path" title={item.path}>
          {/* The folder is truncated from the left (rtl); the marks keep its slashes in place. */}
          {`\u200E${folder}\u200E`}
        </div>
        {overridden.length > 0 && (
          <div className="row-chips">
            {overridden.map((k) => (
              <span key={k} className="chip">
                {chipText(k, settings)}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="row-pages">{pagesText(item, settings)}</div>
      <div className="row-status">
        {props.jobState ? (
          <span className={`badge badge-${props.jobState}`} title={props.jobError}>
            {JOB_LABEL[props.jobState]}
          </span>
        ) : item.status === 'preparing' ? (
          <span className="badge badge-preparing">{item.kind === 'office' ? 'Converting' : 'Reading'}</span>
        ) : item.status === 'error' ? (
          <span className="badge badge-failed" title={item.error}>
            Problem
          </span>
        ) : null}
      </div>
    </li>
  )
}

function pagesText(item: BatchItem, s: PrintSettings): string {
  if (item.pageCount === undefined) return ''
  const printed = selectedPages(s.pageRange, item.pageCount).length
  const base = printed === item.pageCount ? `${item.pageCount} pg` : `${printed} of ${item.pageCount} pg`
  return s.copies > 1 ? `${base} × ${s.copies}` : base
}

function chipText(key: keyof PrintSettings, s: PrintSettings): string {
  switch (key) {
    case 'printer':
      return s.printer || 'Default printer'
    case 'copies':
      return `${s.copies} copies`
    case 'pageRange':
      return s.pageRange ? `Pages ${s.pageRange}` : 'All pages'
    case 'duplex':
      return { printer: 'Sides: default', simplex: '1-sided', long: '2-sided', short: '2-sided short' }[s.duplex]
    case 'color':
      return { printer: 'Colour: default', color: 'Colour', mono: 'B&W' }[s.color]
    case 'paperSize':
      return s.paperSize ? 'Paper set' : 'Paper: default'
    case 'tray':
      return s.tray ? 'Tray set' : 'Tray: default'
    case 'orientation':
      return { auto: 'Auto orientation', portrait: 'Portrait', landscape: 'Landscape' }[s.orientation]
    case 'scaling':
      return { fit: 'Fit', shrink: 'Shrink', noscale: 'Actual size' }[s.scaling]
  }
}
