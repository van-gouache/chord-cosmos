import { describe, expect, it } from 'vitest'

import { romanForChord } from '../theory/diatonic'
import { defaultStarterSongs } from './starter'

describe('starter sequence', () => {
  it('loads Autumn Leafs as the empty-library default', () => {
    const songs = defaultStarterSongs()
    expect(songs).toHaveLength(1)
    expect(songs[0].name).toContain('Autumn Leafs')
    expect(songs[0].bpm).toBe(111)
    expect(songs[0].sections.map((section) => section.name)).toEqual([
      'A1',
      'A2',
      'B1',
    ])
  })

  it('groups each phrase by its key center', () => {
    const [song] = defaultStarterSongs()
    const groups = song.sections.map((section) =>
      section.bars.map((bar) => ({
        name: bar.name,
        keyRoot: bar.keyRoot,
        mode: bar.mode,
        chords: bar.slots.map((slot) => slot?.chordSymbol),
      })),
    )

    expect(groups).toEqual([
      [
        {
          name: 'G major',
          keyRoot: 'G',
          mode: 'ionian',
          chords: ['A-7', 'A-7', 'D9', 'GΔ7', 'GΔ7', 'G♭ D G', 'CΔ9'],
        },
        {
          name: 'E minor',
          keyRoot: 'E',
          mode: 'harmonic-minor',
          chords: ['F♯ø7', 'F♯ø7', 'B11', 'E-9', 'E-6', 'E line'],
        },
      ],
      [
        {
          name: 'G major',
          keyRoot: 'G',
          mode: 'ionian',
          chords: ['Asus2', 'D7sus4', 'GΔ7', 'Gadd9', 'CΔ7', 'CΔ7'],
        },
        {
          name: 'E minor',
          keyRoot: 'E',
          mode: 'harmonic-minor',
          chords: ['F♯ø7', 'B11', 'C D♯ F♯', 'E-9', 'E-'],
        },
      ],
      [
        {
          name: 'E minor',
          keyRoot: 'E',
          mode: 'harmonic-minor',
          chords: ['F♯ø7', 'B7♭13', 'B7♭13', 'E-9', 'E-6', 'E-6/9'],
        },
        {
          name: 'G major',
          keyRoot: 'G',
          mode: 'ionian',
          chords: [
            'A-7',
            'A-7',
            'A[9,b3,5,b7]',
            'A-7',
            'D7',
            'D7',
            'GΔ13',
            'GΔ13',
            'CΔ7',
            'C[9,3,5,7]',
          ],
        },
      ],
    ])

    expect(romanForChord('A-7', 'G', 'ionian')).toBe('II-7')
    expect(romanForChord('D9', 'G', 'ionian')).toBe('V9')
    expect(romanForChord('GΔ7', 'G', 'ionian')).toBe('IΔ7')
    expect(romanForChord('CΔ9', 'G', 'ionian')).toBe('IVΔ9')
    expect(romanForChord('F♯ø7', 'E', 'harmonic-minor')).toBe('IIø7')
    expect(romanForChord('B11', 'E', 'harmonic-minor')).toBe('V11')
    expect(romanForChord('E-9', 'E', 'harmonic-minor')).toBe('I-9')
  })
})
