/**
 * Moves the dragged item, or the whole selection when the dragged item is part
 * of a multi-selection, so it lands where the dragged item was dropped.
 */
export function moveItems(ids: string[], selection: Set<string>, activeId: string, overId: string): string[] {
  if (activeId === overId) return ids
  const moving = selection.has(activeId) && selection.size > 1 ? ids.filter((id) => selection.has(id)) : [activeId]
  const movingSet = new Set(moving)
  const from = ids.indexOf(activeId)
  const to = ids.indexOf(overId)
  const rest = ids.filter((id) => !movingSet.has(id))
  if (movingSet.has(overId)) return ids
  let insertAt = rest.indexOf(overId)
  if (to > from) insertAt += 1
  return [...rest.slice(0, insertAt), ...moving, ...rest.slice(insertAt)]
}

/** Moves the given ids one step up or down (or to the top or bottom), keeping their relative order. */
export function shiftItems(ids: string[], selection: Set<string>, direction: 'up' | 'down' | 'top' | 'bottom'): string[] {
  const moving = ids.filter((id) => selection.has(id))
  if (moving.length === 0) return ids
  const rest = ids.filter((id) => !selection.has(id))
  if (direction === 'top') return [...moving, ...rest]
  if (direction === 'bottom') return [...rest, ...moving]
  const out = [...ids]
  if (direction === 'up') {
    for (let i = 1; i < out.length; i++) {
      if (selection.has(out[i]) && !selection.has(out[i - 1])) [out[i - 1], out[i]] = [out[i], out[i - 1]]
    }
  } else {
    for (let i = out.length - 2; i >= 0; i--) {
      if (selection.has(out[i]) && !selection.has(out[i + 1])) [out[i], out[i + 1]] = [out[i + 1], out[i]]
    }
  }
  return out
}
