import {
  DEFAULT_NOTEBOOK_STYLE,
  notebookStyleFromUnknown,
  type NotebookStyle,
} from './notebook'

export const PREFS_KEY = 'chord-cosmos.prefs.v1'

export interface AppPrefs {
  showForwardTargets: boolean
  showLickOutline: boolean
  notebookStyle: NotebookStyle
  audioInputId: string
}

export const DEFAULT_PREFS: AppPrefs = {
  showForwardTargets: true,
  showLickOutline: false,
  notebookStyle: DEFAULT_NOTEBOOK_STYLE,
  audioInputId: '',
}

function readJson(key: string): unknown {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function loadPrefs(): AppPrefs {
  const raw = readJson(PREFS_KEY) as Partial<AppPrefs> | null
  return {
    showForwardTargets:
      typeof raw?.showForwardTargets === 'boolean'
        ? raw.showForwardTargets
        : DEFAULT_PREFS.showForwardTargets,
    showLickOutline:
      typeof raw?.showLickOutline === 'boolean'
        ? raw.showLickOutline
        : DEFAULT_PREFS.showLickOutline,
    notebookStyle: notebookStyleFromUnknown(raw?.notebookStyle),
    audioInputId: typeof raw?.audioInputId === 'string' ? raw.audioInputId : '',
  }
}

export function savePrefs(prefs: AppPrefs): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Quota or private-mode writes can fail; keep the in-memory value.
  }
}

export function updatePrefs(patch: Partial<AppPrefs>): AppPrefs {
  const next = { ...loadPrefs(), ...patch }
  savePrefs(next)
  return next
}
