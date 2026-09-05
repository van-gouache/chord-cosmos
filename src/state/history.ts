import type { Song } from './songs'

export const MAX_HISTORY = 50
export const COALESCE_MS = 800

export interface SongHistory {
  past: Song[]
  future: Song[]
  lastWasCoalesce: boolean
  lastAt: number
}

export function emptyHistory(): SongHistory {
  return { past: [], future: [], lastWasCoalesce: false, lastAt: 0 }
}

/** Pushes `before` onto the undo stack and clears redo. Coalesced edits share one step. */
export function recordChange(
  history: SongHistory,
  before: Song,
  options?: { coalesce?: boolean; now?: number }
): SongHistory {
  const coalesce = Boolean(options?.coalesce)
  const now = options?.now ?? Date.now()
  if (
    coalesce &&
    history.lastWasCoalesce &&
    now - history.lastAt < COALESCE_MS &&
    history.past.length > 0
  ) {
    return { ...history, future: [], lastWasCoalesce: true, lastAt: now }
  }

  return {
    past: [...history.past, before].slice(-MAX_HISTORY),
    future: [],
    lastWasCoalesce: coalesce,
    lastAt: now,
  }
}

export function undoChange(
  history: SongHistory,
  current: Song
): { history: SongHistory; song: Song } | null {
  if (history.past.length === 0) return null
  const past = history.past.slice(0, -1)
  const song = history.past[history.past.length - 1]
  return {
    song,
    history: {
      past,
      future: [...history.future, current],
      lastWasCoalesce: false,
      lastAt: 0,
    },
  }
}

export function redoChange(
  history: SongHistory,
  current: Song
): { history: SongHistory; song: Song } | null {
  if (history.future.length === 0) return null
  const future = history.future.slice(0, -1)
  const song = history.future[history.future.length - 1]
  return {
    song,
    history: {
      past: [...history.past, current],
      future,
      lastWasCoalesce: false,
      lastAt: 0,
    },
  }
}

export function canUndo(history: SongHistory | undefined): boolean {
  return (history?.past.length ?? 0) > 0
}

export function canRedo(history: SongHistory | undefined): boolean {
  return (history?.future.length ?? 0) > 0
}
