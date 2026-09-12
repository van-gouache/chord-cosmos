import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_PREFS, loadPrefs, PREFS_KEY, savePrefs, updatePrefs } from './prefs'

describe('app prefs', () => {
  const store: Record<string, string> = {}

  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key]
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value
      },
      removeItem: (key: string) => {
        delete store[key]
      },
    })
  })

  it('defaults to showing next-chord targets', () => {
    expect(loadPrefs()).toEqual(DEFAULT_PREFS)
  })

  it('round-trips the New in X toggle', () => {
    savePrefs({
      ...DEFAULT_PREFS,
      showForwardTargets: false,
      showLickOutline: false,
    })
    expect(store[PREFS_KEY]).toBeTruthy()
    expect(loadPrefs().showForwardTargets).toBe(false)
  })

  it('keeps build fret clicks audible until muted', () => {
    expect(loadPrefs().muteBuildFretClicks).toBe(false)
    updatePrefs({ muteBuildFretClicks: true })
    expect(loadPrefs().muteBuildFretClicks).toBe(true)
  })

  it('remembers playback volume and keeps it inside 0 to 1', () => {
    expect(loadPrefs().volume).toBe(DEFAULT_PREFS.volume)
    updatePrefs({ volume: 0.25 })
    expect(loadPrefs().volume).toBe(0.25)
    store[PREFS_KEY] = JSON.stringify({ volume: 4 })
    expect(loadPrefs().volume).toBe(1)
    store[PREFS_KEY] = JSON.stringify({ volume: 'loud' })
    expect(loadPrefs().volume).toBe(DEFAULT_PREFS.volume)
  })

  it('remembers notebook page style', () => {
    expect(loadPrefs().notebookStyle).toBe('cream')
    updatePrefs({ notebookStyle: 'legal' })
    expect(loadPrefs().notebookStyle).toBe('legal')
  })

  it('maps older notebook style names onto cream paper', () => {
    store[PREFS_KEY] = JSON.stringify({ notebookStyle: 'boxes' })
    expect(loadPrefs().notebookStyle).toBe('cream')
    store[PREFS_KEY] = JSON.stringify({ notebookStyle: 'realbook' })
    expect(loadPrefs().notebookStyle).toBe('cream')
  })

  it('falls back when a notebook style is unknown', () => {
    store[PREFS_KEY] = JSON.stringify({ notebookStyle: 'spiral' })
    expect(loadPrefs().notebookStyle).toBe('cream')
  })
})
