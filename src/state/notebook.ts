export type NotebookStyle = 'cream' | 'legal' | 'staff' | 'night'

export const NOTEBOOK_STYLES: {
  id: NotebookStyle
  label: string
  hint: string
}[] = [
  { id: 'cream', label: 'Cream', hint: 'Cream practice paper' },
  { id: 'legal', label: 'Legal', hint: 'Yellow ruled pad' },
  { id: 'staff', label: 'Staff', hint: 'Manuscript paper' },
  { id: 'night', label: 'Night', hint: 'Dark notebook' },
]

export const DEFAULT_NOTEBOOK_STYLE: NotebookStyle = 'cream'

export function isNotebookStyle(value: unknown): value is NotebookStyle {
  return NOTEBOOK_STYLES.some((style) => style.id === value)
}

/** Accepts current ids and older saved names. */
export function notebookStyleFromUnknown(value: unknown): NotebookStyle {
  if (value === 'boxes' || value === 'realbook') return 'cream'
  return isNotebookStyle(value) ? value : DEFAULT_NOTEBOOK_STYLE
}
