import { describe, expect, it } from 'vitest'

import {
  COALESCE_MS,
  MAX_HISTORY,
  canRedo,
  canUndo,
  emptyHistory,
  recordChange,
  redoChange,
  undoChange,
} from './history'
import { createSong, type Song } from './songs'

function song(name: string): Song {
  return { ...createSong(name), id: name }
}

describe('sequencer history', () => {
  it('undoes then redoes a recorded change', () => {
    const first = song('one')
    const second = song('two')
    const recorded = recordChange(emptyHistory(), first)
    expect(canUndo(recorded)).toBe(true)
    expect(canRedo(recorded)).toBe(false)

    const undone = undoChange(recorded, second)
    expect(undone?.song).toBe(first)
    expect(canUndo(undone?.history)).toBe(false)
    expect(canRedo(undone?.history)).toBe(true)

    const redone = undoChange(undone!.history, undone!.song)
    expect(redone).toBeNull()

    const restored = redoChange(undone!.history, undone!.song)
    expect(restored?.song).toBe(second)
    expect(canUndo(restored?.history)).toBe(true)
    expect(canRedo(restored?.history)).toBe(false)
  })

  it('clears redo when a new change is recorded', () => {
    const a = song('a')
    const b = song('b')
    const c = song('c')
    const undone = undoChange(recordChange(emptyHistory(), a), b)!
    const next = recordChange(undone.history, undone.song)
    expect(canRedo(next)).toBe(false)
    expect(undoChange(next, c)?.song).toBe(undone.song)
  })

  it('coalesces rapid edits into a single undo step', () => {
    const start = song('start')
    const mid = song('mid')
    let history = recordChange(emptyHistory(), start, { coalesce: true, now: 0 })
    history = recordChange(history, mid, { coalesce: true, now: 100 })
    expect(history.past).toHaveLength(1)
    expect(history.past[0]).toBe(start)

    history = recordChange(history, mid, {
      coalesce: true,
      now: COALESCE_MS + 200,
    })
    expect(history.past).toHaveLength(2)
  })

  it('caps the undo stack', () => {
    let history = emptyHistory()
    for (let i = 0; i < MAX_HISTORY + 5; i += 1) {
      history = recordChange(history, song(`s${i}`))
    }
    expect(history.past).toHaveLength(MAX_HISTORY)
    expect(history.past[0].id).toBe('s5')
  })

  it('returns null when there is nothing to undo or redo', () => {
    const current = song('now')
    expect(undoChange(emptyHistory(), current)).toBeNull()
    expect(redoChange(emptyHistory(), current)).toBeNull()
  })
})
