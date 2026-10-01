import { describe, expect, it } from 'vitest'

import { tryParseChord } from './chords'
import { polychordFamilies, type PolychordStack } from './polychord'

function familiesFor(symbol: string, key?: string) {
  const chord = tryParseChord(symbol).chord
  expect(chord).toBeTruthy()
  return polychordFamilies(
    chord!,
    key ? { keyRoot: key, mode: 'ionian' } : undefined
  )
}

function stacks(symbol: string, key?: string): PolychordStack[] {
  return familiesFor(symbol, key).flatMap((family) => family.stacks)
}

function inCategory(symbol: string, category: string, key?: string) {
  return (
    familiesFor(symbol, key).find((family) => family.id === category)?.stacks ??
    []
  )
}

describe('polychord stacks', () => {
  it('pairs a minor 7th with the major 9th a major 3rd lower', () => {
    const substitutes = inCategory('A-7', 'substitutes')
    const stack = substitutes.find((item) => item.symbol === 'FΔ9')
    expect(stack).toMatchObject({ workshop: 'vsystem' })
    expect(stack?.reason).toMatch(/three of its four notes/)
    expect(stack?.reason).toMatch(/A, E, and G/)
    expect(stack?.reason).toMatch(/major 9th built a major 3rd lower/)
  })

  it('pairs a major 9th with the minor 7th a major 3rd higher', () => {
    const stack = inCategory('FΔ9', 'substitutes').find(
      (item) => item.symbol === 'A-7'
    )
    expect(stack?.reason).toMatch(/minor 7th built a major 3rd higher/)
    expect(stack?.reason).toMatch(/three of FΔ9's four notes/)
  })

  it('offers a tritone sub and the ii for a dominant', () => {
    const substitutes = inCategory('G7', 'substitutes')
    expect(substitutes.map((item) => item.symbol)).toEqual(
      expect.arrayContaining(['D♭7', 'D-7'])
    )
    expect(substitutes.find((item) => item.symbol === 'D♭7')?.reason).toMatch(
      /tritone substitute/
    )
  })

  it('stacks extensions that add color above the chord', () => {
    const extensions = inCategory('CΔ7', 'extensions')
    const ninth = extensions.find((item) => item.symbol === 'G')
    expect(ninth).toMatchObject({ workshop: 'triads' })
    expect(ninth?.reason).toMatch(/Major triad on the 5th/)
    expect(ninth?.addedDegrees).toContain('9')

    const dominant = inCategory('C7', 'extensions')
    expect(dominant.map((item) => item.symbol)).toEqual(
      expect.arrayContaining(['G-', 'D', 'G♭'])
    )
    expect(dominant.map((item) => item.symbol)).not.toContain('G')
  })

  it('uses the group key for diatonic stacks', () => {
    const diatonic = inCategory('A-7', 'diatonic', 'C')
    expect(diatonic.length).toBeGreaterThan(0)
    expect(familiesFor('A-7', 'C').find((family) => family.id === 'diatonic')?.hint).toMatch(
      /C Ionian/
    )
    expect(diatonic.every((item) => item.sharedNames.length >= 2)).toBe(true)
  })

  it('falls back to the chord scale when the group has no key', () => {
    const family = familiesFor('A-7').find((item) => item.id === 'diatonic')
    expect(family?.hint).toMatch(/A Dorian/)
    expect(family?.hint).toMatch(/No group key/)
  })

  it('keeps every suggestion playable and distinct from the lower chord', () => {
    for (const symbol of ['A-7', 'CΔ7', 'G7', 'FΔ9', 'Bø7']) {
      const seen = new Set<string>()
      const order = ['diatonic', 'common-tones', 'extensions', 'substitutes']
      const families = familiesFor(symbol)
      const ids = families.map((family) => family.id)
      expect(ids).toEqual([...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b)))
      for (const stack of families.flatMap((family) => family.stacks)) {
        expect(seen.has(stack.symbol)).toBe(false)
        seen.add(stack.symbol)
        const parsed = tryParseChord(stack.symbol).chord
        expect(parsed?.symbol).toBe(stack.symbol)
        expect(stack.symbol).not.toBe(symbol)
        expect(stack.midiNotes.length).toBeGreaterThan(0)
        if (stack.category === 'common-tones') {
          expect(stack.sharedNames).toHaveLength(3)
          expect(stack.reason).toMatch(/three of/)
        }
      }
    }
  })

  it('lists common-tone chords separately from the named substitutes', () => {
    const symbols = stacks('A-7').map((item) => item.symbol)
    expect(new Set(symbols).size).toBe(symbols.length)
    expect(inCategory('A-7', 'common-tones').length).toBeGreaterThan(0)
    expect(inCategory('A-7', 'substitutes').some((item) => item.symbol === 'FΔ9')).toBe(
      true
    )
    expect(inCategory('A-7', 'common-tones').some((item) => item.symbol === 'FΔ9')).toBe(
      false
    )
  })
})
