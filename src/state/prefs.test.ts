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
    savePrefs({ showForwardTargets: false, showLickOutline: false })
    expect(store[PREFS_KEY]).toBeTruthy()
    expect(loadPrefs().showForwardTargets).toBe(false)
  })

  it('keeps lick-outline charts off until enabled', () => {
    expect(loadPrefs().showLickOutline).toBe(false)
    updatePrefs({ showLickOutline: true })
    expect(loadPrefs().showLickOutline).toBe(true)
  })
})
