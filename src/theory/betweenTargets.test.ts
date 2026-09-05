import { describe, expect, it } from 'vitest'

import { parseChord } from './chords'
import { suggestForwardTargets } from './betweenTargets'

function labels(from: string, to: string) {
  return suggestForwardTargets(parseChord(from), parseChord(to)).map(
    (target) => `${target.degree}:${target.name}:${target.context}`
  )
}

describe('forward chord targets', () => {
  it('keeps only next-chord tones that Em7 does not already have', () => {
    const next = labels('E-7', 'DΔ7')
    expect(next).toContain('3:F♯:in DΔ7')
    expect(next).toContain('5:A:in DΔ7')
    expect(next).toContain('7:C♯:in DΔ7')
    expect(next.some((item) => item.startsWith('R:'))).toBe(false)
  })

  it('aims Em7 at the new tones of A7', () => {
    const next = labels('E-7', 'A7')
    expect(next).toContain('R:A:in A7')
    expect(next).toContain('3:C♯:in A7')
    expect(next.some((item) => item.startsWith('5:'))).toBe(false)
    expect(next.some((item) => item.startsWith('♭7:'))).toBe(false)
  })

  it('offers D♯ when Em7 moves to B7', () => {
    const next = labels('Em7', 'B7')
    expect(next).toContain('3:D♯:in B7')
    expect(next).toContain('5:F♯:in B7')
    expect(next).toContain('♭7:A:in B7')
    expect(next.some((item) => item.startsWith('R:'))).toBe(false)
  })

  it('uses every possible tone of the current chord, not only four voices', () => {
    const next = labels('E13', 'A7')
    expect(next.some((item) => item.startsWith('R:A'))).toBe(true)
    expect(next.some((item) => item.includes(':E:'))).toBe(false)
  })
})
