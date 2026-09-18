export const UNDO_SHORTCUT = /Mac|iPhone|iPad/.test(
  typeof navigator === 'undefined' ? '' : navigator.platform
)
  ? { undo: '⌘Z', redo: '⇧⌘Z' }
  : { undo: 'Ctrl+Z', redo: 'Ctrl+Y' }

export function undoRedoAction(event: KeyboardEvent): 'undo' | 'redo' | null {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return null
  const key = event.key.toLowerCase()
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo'
  if (key === 'y' && !event.shiftKey) return 'redo'
  return null
}
