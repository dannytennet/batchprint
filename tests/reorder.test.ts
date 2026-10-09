import { describe, expect, it } from 'vitest'
import { moveItems, shiftItems } from '@shared/reorder'

const ids = ['a', 'b', 'c', 'd', 'e']

describe('moveItems', () => {
  it('moves a single item like a normal drag', () => {
    expect(moveItems(ids, new Set(), 'a', 'c')).toEqual(['b', 'c', 'a', 'd', 'e'])
    expect(moveItems(ids, new Set(), 'd', 'a')).toEqual(['d', 'a', 'b', 'c', 'e'])
  })

  it('moves the whole selection when dragging a selected item', () => {
    expect(moveItems(ids, new Set(['b', 'd']), 'b', 'e')).toEqual(['a', 'c', 'e', 'b', 'd'])
    expect(moveItems(ids, new Set(['c', 'e']), 'e', 'a')).toEqual(['c', 'e', 'a', 'b', 'd'])
  })

  it('ignores dropping onto a moving item', () => {
    expect(moveItems(ids, new Set(['b', 'c']), 'b', 'c')).toBe(ids)
  })
})

describe('shiftItems', () => {
  it('moves selected items up and down one step as a group', () => {
    expect(shiftItems(ids, new Set(['c', 'e']), 'up')).toEqual(['a', 'c', 'b', 'e', 'd'])
    expect(shiftItems(ids, new Set(['a', 'b']), 'up')).toEqual(ids)
    expect(shiftItems(ids, new Set(['a', 'c']), 'down')).toEqual(['b', 'a', 'd', 'c', 'e'])
  })

  it('moves selected items to the top or bottom in their current order', () => {
    expect(shiftItems(ids, new Set(['d', 'b']), 'top')).toEqual(['b', 'd', 'a', 'c', 'e'])
    expect(shiftItems(ids, new Set(['a', 'c']), 'bottom')).toEqual(['b', 'd', 'e', 'a', 'c'])
  })
})
