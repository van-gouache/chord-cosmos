import { DEFAULT_VOLUME } from '../audio/player'
import {
  DEFAULT_NOTEBOOK_STYLE,
  notebookStyleFromUnknown,
  type NotebookStyle,
} from './notebook'

export const PREFS_KEY = 'chord-cosmos.prefs.v1'

export interface AppPrefs {
  showForwardTargets: boolean
  showLickOutline: boolean
  showCircleOfFifths: boolean
  muteBuildFretClicks: boolean
  /** Hides the sequence toolbar so the grid gets the whole panel. */
  sequenceToolbarCollapsed: boolean
  notebookStyle: NotebookStyle
  /** Playback level, 0 to 1. */
  volume: number
}

export const DEFAULT_PREFS: AppPrefs = {
  showForwardTargets: true,
  showLickOutline: false,
  showCircleOfFifths: false,
  muteBuildFretClicks: false,
  sequenceToolbarCollapsed: false,
  notebookStyle: DEFAULT_NOTEBOOK_STYLE,
  volume: DEFAULT_VOLUME,
}

export function clampVolume(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_VOLUME
  return Math.min(1, Math.max(0, value))
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
    showCircleOfFifths:
      typeof raw?.showCircleOfFifths === 'boolean'
        ? raw.showCircleOfFifths
        : DEFAULT_PREFS.showCircleOfFifths,
    muteBuildFretClicks:
      typeof raw?.muteBuildFretClicks === 'boolean'
        ? raw.muteBuildFretClicks
        : DEFAULT_PREFS.muteBuildFretClicks,
    sequenceToolbarCollapsed:
      typeof raw?.sequenceToolbarCollapsed === 'boolean'
        ? raw.sequenceToolbarCollapsed
        : DEFAULT_PREFS.sequenceToolbarCollapsed,
    notebookStyle: notebookStyleFromUnknown(raw?.notebookStyle),
    volume: clampVolume(raw?.volume),
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
