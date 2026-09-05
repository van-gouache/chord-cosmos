import { describe, expect, it } from 'vitest'

import { parseChord } from './chords'
import {
  VERTICAL_FRET_SPAN,
  arpeggioTones,
  threeNpsPattern,
  threeNpsStarts,
  verticalPattern,
  verticalWindow,
} from './arpeggio'

describe('3NPS arpeggio', () => {
  it('uses every implied tone, root first', () => {
    const chord = parseChord('Em7')
    expect(arpeggioTones(chord).map((tone) => tone.degree)).toEqual([
      'R',
      '♭3',
      '5',
      '♭7',
    ])
  })

  it('places three notes on the first strings of an open Em7', () => {
    const chord = parseChord('Em7')
    const pattern = threeNpsPattern(chord, { startToneIndex: 0, minFret: 0 })
    const lowE = pattern.filter((note) => note.string === 0)
    expect(lowE.map((note) => note.fret)).toEqual([0, 3, 7])
    expect(lowE.map((note) => note.tone.degree)).toEqual(['R', '♭3', '5'])

    const aString = pattern.filter((note) => note.string === 1)
    expect(aString).toHaveLength(3)
    expect(aString.map((note) => note.tone.degree)).toEqual(['♭7', 'R', '♭3'])
    expect(aString[0].fret).toBe(5)
  })

  it('stays strictly ascending so the path can be played as one arp', () => {
    const chord = parseChord('CΔ7')
    const pattern = threeNpsPattern(chord)
    const midis = pattern.map((note) => note.midi)
    for (let i = 1; i < midis.length; i++) {
      expect(midis[i]).toBeGreaterThan(midis[i - 1])
    }
    const perString = new Map<number, number>()
    for (const note of pattern) {
      perString.set(note.string, (perString.get(note.string) ?? 0) + 1)
    }
    for (const [string, count] of perString) {
      if (string === pattern[pattern.length - 1].string) {
        expect(count).toBeLessThanOrEqual(3)
      } else {
        expect(count).toBe(3)
      }
    }
  })

  it('can start from the next chord tone up the neck', () => {
    const chord = parseChord('Em7')
    const pattern = threeNpsPattern(chord, { startToneIndex: 1, minFret: 3 })
    expect(pattern[0]).toMatchObject({ string: 0, fret: 3, tone: { degree: '♭3' } })
    expect(pattern.slice(0, 3).map((note) => note.tone.degree)).toEqual([
      '♭3',
      '5',
      '♭7',
    ])
  })

  it('lists start frets on the low E that still fill two strings', () => {
    const chord = parseChord('Em7')
    const starts = threeNpsStarts(chord, 0, 0)
    expect(starts[0]?.fret).toBe(0)
    expect(starts.some((start) => start.fret === 12)).toBe(true)
  })
})

describe('vertical in-position arpeggio', () => {
  it('keeps every note inside a 6-fret window', () => {
    const chord = parseChord('Em7')
    const { from, to } = verticalWindow(5)
    expect(to - from + 1).toBe(VERTICAL_FRET_SPAN)
    const pattern = verticalPattern(chord, { startFret: 5 })
    expect(pattern.length).toBeGreaterThanOrEqual(4)
    expect(Math.max(...pattern.map((note) => note.fret))).toBeLessThanOrEqual(to)
    expect(Math.min(...pattern.map((note) => note.fret))).toBeGreaterThanOrEqual(from)
  })

  it('plays the box from low to high', () => {
    const chord = parseChord('Em7')
    const midis = verticalPattern(chord, { startFret: 0 }).map((note) => note.midi)
    for (let i = 1; i < midis.length; i++) {
      expect(midis[i]).toBeGreaterThanOrEqual(midis[i - 1])
    }
  })
})
