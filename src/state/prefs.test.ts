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

  it('keeps lick-outline charts off until enabled', () => {
    expect(loadPrefs().showLickOutline).toBe(false)
    updatePrefs({ showLickOutline: true })
    expect(loadPrefs().showLickOutline).toBe(true)
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

  it('remembers the chosen audio input', () => {
    expect(loadPrefs().audioInputId).toBe('')
    updatePrefs({ audioInputId: 'mic-2' })
    expect(loadPrefs().audioInputId).toBe('mic-2')
  })
})
