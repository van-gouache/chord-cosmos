import { describe, expect, it } from 'vitest'

import { suggestNextChords } from './nextChord'

describe('next chord suggestions', () => {
  it('opens a major key on I, vi, ii, and IV', () => {
    const plan = suggestNextChords([], 'C', 'ionian')
    expect(plan?.inferred).toBe(false)
    expect(plan?.suggestions.map((item) => item.step.symbol)).toEqual([
      'CΔ7',
      'A-7',
      'D-7',
      'FΔ7',
    ])
    expect(plan?.suggestions[0]?.reason).toBe('Start on the tonic')
  })

  it('follows ii with V', () => {
    const plan = suggestNextChords(['D-7'], 'C', 'ionian')
    expect(plan?.suggestions[0]).toMatchObject({
      reason: 'ii–V',
      step: { symbol: 'G7', roman: 'V7' },
    })
    expect(plan?.suggestions.map((item) => item.step.symbol)).not.toContain('D-7')
  })

  it('resolves V to I, and names a ii–V–I when both came before', () => {
    expect(suggestNextChords(['G7'], 'C', 'ionian')?.suggestions[0]).toMatchObject({
      reason: 'Resolves to I',
      step: { symbol: 'CΔ7' },
    })
    expect(suggestNextChords(['D-7', 'G7'], 'C', 'ionian')?.suggestions[0]).toMatchObject({
      reason: 'ii–V–I',
      step: { symbol: 'CΔ7' },
    })
  })

  it('resolves an applied dominant to its target', () => {
    const plan = suggestNextChords(['A7'], 'C', 'ionian')
    expect(plan?.suggestions[0]).toMatchObject({
      reason: 'Resolves to II',
      step: { symbol: 'D-7' },
    })
  })

  it('sends a minor ii to V7', () => {
    const plan = suggestNextChords(['Bø7'], 'A', 'aeolian')
    expect(plan?.suggestions[0]?.step.symbol).toBe('E7')
    expect(plan?.suggestions[0]?.reason).toBe('ii–V')
  })

  it('infers the key from the chords when the group has none', () => {
    const plan = suggestNextChords(['E-7'], null)
    expect(plan?.inferred).toBe(true)
    expect(plan?.keyRoot).toBe('D')
    expect(plan?.suggestions[0]?.step.symbol).toBe('A7')
  })

  it('suggests nothing until there is a key or a chord', () => {
    expect(suggestNextChords([], null)).toBeNull()
  })
})